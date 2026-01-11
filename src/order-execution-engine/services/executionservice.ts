// Execution service - orchestrates the order execution flow
// Flow: Fetch best quote from DEXs → Update order status → Execute swap → Handle results/retries
import { Logger } from '@/common/logger';
import { NotFoundError, ValidationError } from '@/common/errors/errors';
import type { Order, UpdateOrderInput, OrderStatus } from '@/order-execution-engine/model';
import type { DexQuote, SwapTransaction, DexGateway } from '@/order-execution-engine/model';
import type { Job } from 'bullmq';
import type { ExecutionJob } from '@/order-execution-engine/model';
import { webSocketService } from './websocketservice';
import type { OrderService } from './orderservice';
import type { DexService } from './dexservice';

// Execution result - outcome of order execution
export interface ExecutionResult {
  success: boolean;
  order: Order | null;
  transaction?: SwapTransaction;
  errorMessage?: string;
}

export class ExecutionService {
  private orderService: OrderService;
  private dexService: DexService;
  private gateways: Map<string, DexGateway>;

  constructor(orderService: OrderService, dexService: DexService, gateways: DexGateway[]) {
    this.orderService = orderService;
    this.dexService = dexService;
    this.gateways = new Map(gateways.map(g => [g.name, g]));
  }

  // Process order execution job - handles BullMQ job orchestration
  async processOrderExecutionJob(job: Job<ExecutionJob>): Promise<any> {
    const { orderId, order } = job.data;
    const walletAddress = process.env.WALLET_ADDRESS || 'mock_wallet_address';

    Logger.getInstance().info('Processing order execution job', {
      jobId: job.id,
      orderId,
      retryCount: order.retryCount,
      attemptNumber: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts || 3,
    });

    try {
      // Update job progress - fetching quotes phase (10%)
      await job.updateProgress(10);

      // Send WebSocket update: processing
      webSocketService.sendOrderUpdate(orderId, 'processing', {
        message: 'Fetching quotes from DEXs (Raydium, Meteora)',
      });

      // Execute the order - delegates to core execution logic
      const executionResult = await this.executeOrder(orderId, walletAddress);

      // Update job progress - complete (100%)
      await job.updateProgress(100);

      if (executionResult.success) {
        Logger.getInstance().info('Order execution job completed successfully', {
          jobId: job.id,
          orderId,
          txHash: executionResult.transaction?.signature,
          dex: executionResult.transaction?.dexName,
          amountOut: executionResult.transaction?.amountOut,
          executedPrice: executionResult.transaction?.executionPrice,
        });

        // Send WebSocket update: completed
        webSocketService.sendOrderUpdate(orderId, 'completed', {
          message: 'Order executed successfully',
          txHash: executionResult.transaction?.signature,
          executedPrice: executionResult.transaction?.executionPrice,
          amountOut: executionResult.transaction?.amountOut,
          dex: executionResult.transaction?.dexName,
          explorerUrl: `https://solscan.io/tx/${executionResult.transaction?.signature}?cluster=devnet`,
        });

        return {
          success: true,
          orderId,
          txHash: executionResult.transaction?.signature,
          executedPrice: executionResult.transaction?.executionPrice,
        };
      } else {
        // Job failed but might be retried by BullMQ
        Logger.getInstance().warn('Order execution job failed', {
          jobId: job.id,
          orderId,
          error: executionResult.errorMessage,
          attemptsMade: job.attemptsMade,
          attemptsLeft: (job.opts.attempts || 1) - job.attemptsMade,
        });

        // Send WebSocket update: failed
        webSocketService.sendOrderUpdate(orderId, 'failed', {
          message: 'Order execution failed',
          error: executionResult.errorMessage,
          attemptsLeft: (job.opts.attempts || 1) - job.attemptsMade,
        });

        // Throw error to trigger BullMQ retry mechanism
        throw new Error(executionResult.errorMessage || 'Order execution failed');
      }
    } catch (error) {
      Logger.getInstance().error('Order execution job encountered error', {
        jobId: job.id,
        orderId,
        attemptsMade: job.attemptsMade,
        error: error instanceof Error ? error.message : String(error),
      });

      // Send WebSocket update: failed
      webSocketService.sendOrderUpdate(orderId, 'failed', {
        message: 'Order execution failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Re-throw to let BullMQ handle retries
      throw error;
    }
  }

  // Execute an order - main orchestration method
  async executeOrder(orderId: string, walletAddress: string): Promise<ExecutionResult> {
    Logger.getInstance().info('Starting order execution', { orderId, walletAddress });

    try {
      // 1. Fetch order from database
      const order = await this.orderService.getOrderById(orderId);

      if (!order) {
        throw new NotFoundError('Order', orderId);
      }

      // 2. Validate order can be executed
      this.validateOrderForExecution(order);

      // 3. Update status to processing (fetching quotes)
      await this.orderService.updateOrderStatus(orderId, 'processing');

      // 4. Get best quote from DEXs
      const bestQuoteResult = await this.dexService.getBestQuote(
        order.tokenIn,
        order.tokenOut,
        order.amount,
        order.slippageTolerance
      );

      if (!bestQuoteResult) {
        throw new ValidationError('No quotes available from any DEX');
      }

      const { quote, dexName } = bestQuoteResult;

      Logger.getInstance().info('Best quote selected for execution', {
        orderId,
        dex: dexName,
        amountOut: quote.amountOut,
        pricePerToken: quote.pricePerToken,
      });

      // 5. Execute swap transaction
      const swapTransaction = await this.executeSwapTransaction(
        orderId,
        quote,
        dexName,
        walletAddress
      );

      if (!swapTransaction) {
        throw new Error(`Failed to execute swap on ${dexName}`);
      }

      // 6. Update order with execution results
      const updateInput: UpdateOrderInput = {
        status: 'completed' as OrderStatus,
        selectedDex: dexName,
        executedPrice: swapTransaction.executionPrice,
        transactionHash: swapTransaction.signature,
        confirmedAt: swapTransaction.executedAt,
      };
      
      const completedOrder = await this.orderService.updateOrder(orderId, updateInput);

      Logger.getInstance().info('Order executed successfully', {
        orderId,
        dex: dexName,
        transactionHash: swapTransaction.signature,
        executedPrice: swapTransaction.executionPrice,
      });

      return {
        success: true,
        order: completedOrder,
        transaction: swapTransaction,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
      Logger.getInstance().error('Order execution encountered error', {
        orderId,
        error: errorMessage,
      });

      await this.handleExecutionFailure(orderId, errorMessage);

      return {
        success: false,
        order: await this.orderService.getOrderById(orderId),
        errorMessage,
      };
    }
  }

  // Retry failed order execution - called by BullMQ retry mechanism
  async retryOrderExecution(orderId: string, walletAddress: string): Promise<ExecutionResult> {
    Logger.getInstance().info('Retrying order execution', { orderId });

    // Increment retry count
    const order = await this.orderService.incrementRetryCount(orderId);

    // Check if max retries exceeded (already handled in incrementRetryCount)
    if (order.status === 'failed') {
      Logger.getInstance().warn('Max retries exceeded, order marked as failed', {
        orderId,
        retryCount: order.retryCount,
        maxRetries: order.maxRetries,
      });
      return {
        success: false,
        order,
        errorMessage: 'Max retries exceeded',
      };
    }

    // Execute order again
    return await this.executeOrder(orderId, walletAddress);
  }

  // Check transaction status on blockchain
  async checkTransactionStatus(transactionHash: string, dexName: string): Promise<SwapTransaction | null> {
    Logger.getInstance().info('Checking transaction status', { transactionHash, dex: dexName });

    try {
      const gateway = this.gateways.get(dexName.toLowerCase());
      
      if (!gateway) {
        Logger.getInstance().warn('Unknown DEX for transaction status check', { dex: dexName });
        return null;
      }

      const transactionStatus = await gateway.getTransactionStatus(transactionHash);

      Logger.getInstance().info('Transaction status retrieved', {
        transactionHash,
        status: transactionStatus.status,
      });

      return transactionStatus;
    } catch (error) {
      Logger.getInstance().error('Failed to check transaction status', {
        transactionHash,
        dex: dexName,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // Validate order can be executed
  private validateOrderForExecution(order: Order): void {
    // Check if already completed
    if (order.status === 'completed') {
      throw new ValidationError('Order already completed');
    }

    // Check if failed with max retries
    if (order.status === 'failed' && order.retryCount >= order.maxRetries) {
      throw new ValidationError('Order failed with max retries exceeded');
    }

    // Validate amount
    if (order.amount <= 0) {
      throw new ValidationError('Invalid order amount');
    }
  }

  // Execute swap transaction on selected DEX
  private async executeSwapTransaction(
    orderId: string,
    quote: DexQuote,
    dexName: string,
    walletAddress: string
  ): Promise<SwapTransaction | null> {
    Logger.getInstance().info('Executing swap transaction', {
      dex: dexName,
      tokenIn: quote.tokenIn,
      tokenOut: quote.tokenOut,
      amountIn: quote.amountIn,
    });

    try {
      const gateway = this.gateways.get(dexName.toLowerCase());
      
      if (!gateway) {
        Logger.getInstance().error('Unknown DEX for swap execution', { dex: dexName });
        return null;
      }

      const swapTransaction = await gateway.executeSwap(quote, walletAddress);

      Logger.getInstance().info('Swap transaction executed', {
        dex: dexName,
        signature: swapTransaction.signature,
        amountOut: swapTransaction.amountOut,
      });

      return swapTransaction;
    } catch (error) {
      Logger.getInstance().error('Swap transaction failed', {
        dex: dexName,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // Handle execution failure - updates order status and determines if retry should be attempted
  private async handleExecutionFailure(orderId: string, errorMessage: string): Promise<void> {
    Logger.getInstance().warn('Handling execution failure', { orderId, errorMessage });

    const order = await this.orderService.getOrderById(orderId);

    if (!order) {
      Logger.getInstance().error('Order not found during failure handling', { orderId });
      return;
    }

    // Check if can retry
    if (order.retryCount < order.maxRetries) {
      Logger.getInstance().info('Order will be retried', {
        orderId,
        retryCount: order.retryCount,
        maxRetries: order.maxRetries,
      });

      // Update status back to pending for retry
      const updateInput: UpdateOrderInput = {
        status: 'pending' as OrderStatus,
        errorMessage: `Attempt ${order.retryCount + 1} failed: ${errorMessage}`,
      };
      
      await this.orderService.updateOrder(orderId, updateInput);
    } else {
      Logger.getInstance().warn('Max retries reached, marking as failed', {
        orderId,
        retryCount: order.retryCount,
        maxRetries: order.maxRetries,
      });

      // Mark as failed permanently
      const updateInput: UpdateOrderInput = {
        status: 'failed' as OrderStatus,
        errorMessage: `Failed after ${order.maxRetries} retries: ${errorMessage}`,
      };
      
      await this.orderService.updateOrder(orderId, updateInput);
    }
  }

  // Set dependencies (will be called during service initialization)
  setDependencies(orderService: any, dexService: any, gateways: Map<string, any>): void {
    this.orderService = orderService;
    this.dexService = dexService;
    this.gateways = gateways;
  }
}
