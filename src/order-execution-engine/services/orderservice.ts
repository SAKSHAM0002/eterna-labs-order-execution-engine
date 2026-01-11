// Order service - business logic for order creation, validation, and management
import { Logger } from '@/common/logger';
import { ValidationError, NotFoundError, ConflictError } from '@/common/errors/errors';
import type { Order, CreateOrderInput, UpdateOrderInput, OrderStatus } from '@/order-execution-engine/model';
import type { OrderRequest } from '@/order-execution-engine/model';
import type { OrderRepository, OrderFilters } from '@/order-execution-engine/model';

export class OrderService {
  private readonly orderRepository: OrderRepository;

  constructor(orderRepositoryInstance: OrderRepository) {
    this.orderRepository = orderRepositoryInstance;
  }

  // Create a new order - validates input, saves to database, adds to queue
  async createOrder(orderRequest: OrderRequest): Promise<Order> {
    Logger.getInstance().info('Creating new order', {
      tokenIn: orderRequest.tokenIn,
      tokenOut: orderRequest.tokenOut,
      amount: orderRequest.amount,
    });

    // Validate order request
    this.validateOrderRequest(orderRequest);

    // Create order object with default values
    const newOrder: Omit<Order, 'id'> = {
      tokenIn: orderRequest.tokenIn,
      tokenOut: orderRequest.tokenOut,
      amount: orderRequest.amount,
      status: 'pending',
      selectedDex: undefined,
      executedPrice: undefined,
      transactionHash: undefined,
      slippageTolerance: orderRequest.slippageTolerance || 0.5,
      maxRetries: orderRequest.maxRetries || 3,
      retryCount: 0,
      errorMessage: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      confirmedAt: undefined,
    };

    // Save to database
    const createdOrder = await this.orderRepository.create(newOrder);

    Logger.getInstance().info('Order created successfully', {
      orderId: createdOrder.id,
      status: createdOrder.status,
    });

    // Add to queue for execution (always required - fail fast if Redis unavailable)
    try {
      const { queueManager } = await import('@/order-execution-engine/queue');
      
      await queueManager.addJob({
        id: `job-${createdOrder.id}`,
        orderId: createdOrder.id,
        order: createdOrder,
        retryCount: 0,
        createdAt: new Date(),
      });
      
      Logger.getInstance().info('Order added to execution queue', { orderId: createdOrder.id });
    } catch (queueError) {
      Logger.getInstance().error('Failed to add order to queue - Redis unavailable', {
        orderId: createdOrder.id,
        error: queueError instanceof Error ? queueError.message : 'Unknown error',
      });
      
      // Delete the order since it can't be processed
      await this.orderRepository.delete(createdOrder.id);
      
      throw new Error('Queue service unavailable. Please try again later.');
    }

    return createdOrder;
  }

  // Get order by ID
  async getOrderById(orderId: string): Promise<Order | null> {
    Logger.getInstance().debug('Fetching order by ID', { orderId });

    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      Logger.getInstance().warn('Order not found', { orderId });
      return null;
    }

    return order;
  }

  // Get multiple orders by IDs
  async getOrdersByIds(orderIds: string[]): Promise<Order[]> {
    Logger.getInstance().debug('Fetching multiple orders', { count: orderIds.length });

    const orders = await this.orderRepository.findByIds(orderIds);

    Logger.getInstance().debug('Orders fetched', { requested: orderIds.length, found: orders.length });

    return orders;
  }

  // Get all orders with optional filtering
  async getAllOrders(filters?: OrderFilters): Promise<Order[]> {
    Logger.getInstance().debug('Fetching orders with filters', { filters });

    const orders = await this.orderRepository.findAll(filters);

    Logger.getInstance().debug('Orders fetched', { count: orders.length });

    return orders;
  }

  // Update order status
  async updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<Order> {
    Logger.getInstance().info('Updating order status', { orderId, newStatus });

    const existingOrder = await this.orderRepository.findById(orderId);
    if (!existingOrder) {
      throw new NotFoundError(`Order not found: ${orderId}`);
    }

    // Update status in database
    const updateInput: UpdateOrderInput = {
      status: newStatus,
    };
    
    const updatedOrder = await this.orderRepository.update(orderId, updateInput);

    Logger.getInstance().info('Order status updated successfully', {
      orderId,
      oldStatus: existingOrder.status,
      newStatus: updatedOrder.status,
    });

    return updatedOrder;
  }

  // Update order fields
  async updateOrder(orderId: string, updates: UpdateOrderInput): Promise<Order> {
    Logger.getInstance().info('Updating order', { orderId, updates });

    const existingOrder = await this.orderRepository.findById(orderId);
    if (!existingOrder) {
      throw new NotFoundError(`Order not found: ${orderId}`);
    }

    const updatedOrder = await this.orderRepository.update(orderId, updates);

    Logger.getInstance().info('Order updated successfully', { orderId });

    return updatedOrder;
  }

  // Cancel an order
  async cancelOrder(orderId: string, reason?: string): Promise<Order> {
    Logger.getInstance().info('Cancelling order', { orderId, reason });

    const existingOrder = await this.orderRepository.findById(orderId);
    if (!existingOrder) {
      throw new NotFoundError(`Order not found: ${orderId}`);
    }

    // Check if order can be cancelled
    if (existingOrder.status === 'completed') {
      throw new ConflictError('Cannot cancel completed order');
    }

    if (existingOrder.status === 'failed') {
      Logger.getInstance().warn('Order already failed', { orderId });
      return existingOrder;
    }

    // Update status to failed with cancellation reason
    const updateInput: UpdateOrderInput = {
      status: 'failed' as OrderStatus,
      errorMessage: reason || 'Cancelled by user',
    };
    
    const cancelledOrder = await this.orderRepository.update(orderId, updateInput);

    Logger.getInstance().info('Order cancelled successfully', { orderId });

    return cancelledOrder;
  }

  // Delete an order (soft delete - just marks as cancelled)
  async deleteOrder(orderId: string): Promise<boolean> {
    Logger.getInstance().info('Deleting order', { orderId });

    const existingOrder = await this.orderRepository.findById(orderId);
    if (!existingOrder) {
      Logger.getInstance().warn('Order not found for deletion', { orderId });
      return false;
    }

    // For safety, we'll cancel instead of hard delete - preserves audit trail
    await this.cancelOrder(orderId, 'Deleted by user');

    Logger.getInstance().info('Order deleted (cancelled)', { orderId });

    return true;
  }

  // Get order count with optional filters
  async getOrderCount(filters?: { status?: OrderStatus; tokenIn?: string; tokenOut?: string }): Promise<number> {
    Logger.getInstance().debug('Counting orders', { filters });

    const count = await this.orderRepository.count(filters);

    Logger.getInstance().debug('Order count retrieved', { count, filters });

    return count;
  }

  // Check if order exists
  async orderExists(orderId: string): Promise<boolean> {
    Logger.getInstance().debug('Checking order existence', { orderId });

    const exists = await this.orderRepository.exists(orderId);

    Logger.getInstance().debug('Order existence check', { orderId, exists });

    return exists;
  }

  // Increment retry count for an order
  async incrementRetryCount(orderId: string): Promise<Order> {
    Logger.getInstance().info('Incrementing retry count', { orderId });

    const existingOrder = await this.orderRepository.findById(orderId);
    if (!existingOrder) {
      throw new NotFoundError(`Order not found: ${orderId}`);
    }

    const newRetryCount = existingOrder.retryCount + 1;

    // Check if max retries exceeded
    if (newRetryCount > existingOrder.maxRetries) {
      Logger.getInstance().warn('Max retries exceeded', {
        orderId,
        retryCount: newRetryCount,
        maxRetries: existingOrder.maxRetries,
      });

      // Update to failed status
      const updateInput: UpdateOrderInput = {
        status: 'failed' as OrderStatus,
        errorMessage: `Max retries (${existingOrder.maxRetries}) exceeded`,
      };
      
      return await this.orderRepository.update(orderId, updateInput);
    }

    // Update retry count
    const updateInput: UpdateOrderInput = {
      retryCount: newRetryCount,
    };
    
    const updatedOrder = await this.orderRepository.update(orderId, updateInput);

    Logger.getInstance().info('Retry count incremented', {
      orderId,
      retryCount: newRetryCount,
      maxRetries: existingOrder.maxRetries,
    });

    return updatedOrder;
  }

  // Validate order request
  private validateOrderRequest(orderRequest: OrderRequest): void {
    // Amount validation
    if (orderRequest.amount <= 0) {
      throw new ValidationError('Order amount must be greater than 0');
    }

    // Token validation
    if (orderRequest.tokenIn === orderRequest.tokenOut) {
      throw new ValidationError('Token in and token out cannot be the same');
    }

    // Slippage validation
    if (orderRequest.slippageTolerance && (orderRequest.slippageTolerance < 0 || orderRequest.slippageTolerance > 100)) {
      throw new ValidationError('Slippage tolerance must be between 0 and 100');
    }

    // Max retries validation
    if (orderRequest.maxRetries && orderRequest.maxRetries < 0) {
      throw new ValidationError('Max retries cannot be negative');
    }

    Logger.getInstance().debug('Order request validation passed');
  }
}
