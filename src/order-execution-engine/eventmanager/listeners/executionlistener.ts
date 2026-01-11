// Execution Event Listener - Listens to ORDER_CREATED events and creates BullMQ jobs for async execution
// This is the bridge between the synchronous HTTP layer and async queue processing

import { eventEmitter } from '../emitter';
import { Logger } from '@/common/logger';
import { EVENT_NAMES } from '@/order-execution-engine/config';
import { queueManager } from '@/order-execution-engine/queue';
import type { OrderCreatedEvent } from '@/order-execution-engine/model';
import type { ExecutionJob } from '@/order-execution-engine/model';

// Execution Event Listener - Singleton that creates queue jobs when orders are created
class ExecutionEventListener {
  private static instance: ExecutionEventListener;
  private isRegistered = false;

  private constructor() {}

  // Get singleton instance
  static getInstance(): ExecutionEventListener {
    if (!ExecutionEventListener.instance) {
      ExecutionEventListener.instance = new ExecutionEventListener();
    }
    return ExecutionEventListener.instance;
  }

  // Register execution event listeners
  register(): void {
    if (this.isRegistered) {
      Logger.getInstance().warn('Execution event listener already registered');
      return;
    }

    // Listen to order creation and queue execution
    eventEmitter.on(EVENT_NAMES.ORDER_CREATED, async (orderCreatedEvent: OrderCreatedEvent) => {
      await this.handleOrderCreated(orderCreatedEvent);
    });

    this.isRegistered = true;
    Logger.getInstance().info('Execution event listener registered');
  }

  // Handle ORDER_CREATED event - Creates a BullMQ job for async order execution
  private async handleOrderCreated(orderCreatedEvent: OrderCreatedEvent): Promise<void> {
    try {
      const { aggregateId, data } = orderCreatedEvent;
      const { order } = data;

      Logger.getInstance().info('Creating execution job for order', {
        orderId: aggregateId,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amount: order.amount,
      });

      // Create execution job payload
      const executionJobData: ExecutionJob = {
        id: `job-${order.id}-${Date.now()}`, // Generate unique job ID
        orderId: order.id,
        order: order,
        retryCount: 0,
        createdAt: new Date(),
      };

      // Add job to BullMQ queue
      const jobId = await queueManager.addJob(executionJobData);

      Logger.getInstance().info('Execution job created successfully', {
        orderId: order.id,
        jobId: jobId,
      });

      // TODO: Emit QUEUE_JOB_ADDED event

    } catch (error) {
      Logger.getInstance().error('Failed to create execution job', {
        error: error instanceof Error ? error.message : String(error),
        aggregateId: orderCreatedEvent.aggregateId,
      });

      // TODO: Emit SYSTEM_ERROR event
      // This should trigger retry mechanism or manual intervention
    }
  }

  // Unregister all listeners (for testing/shutdown)
  unregister(): void {
    eventEmitter.off(EVENT_NAMES.ORDER_CREATED, this.handleOrderCreated);
    this.isRegistered = false;
    Logger.getInstance().info('Execution event listener unregistered');
  }
}

// Export singleton instance
export const executionListener = ExecutionEventListener.getInstance();
