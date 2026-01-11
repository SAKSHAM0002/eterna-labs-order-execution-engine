// Order Event Listener - Listens to order-related events and maintains order history/audit trail
// Stores all state changes for compliance and debugging

import { eventEmitter } from '../emitter';
import { Logger } from '@/common/logger';
import { EVENT_NAMES } from '@/order-execution-engine/config';
import type {
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  OrderFailedEvent,
  OrderConfirmedEvent,
} from '@/order-execution-engine/model';

// Order History Record - Represents a single state change in order lifecycle
interface OrderHistoryRecord {
  orderId: string;
  eventType: string;
  timestamp: Date;
  details: Record<string, unknown>;
}

// Order Event Listener - Singleton that listens to all order events
class OrderEventListener {
  private static instance: OrderEventListener;
  private isRegistered = false;
  private orderHistory: Map<string, OrderHistoryRecord[]> = new Map();

  private constructor() {}

  // Get singleton instance
  static getInstance(): OrderEventListener {
    if (!OrderEventListener.instance) {
      OrderEventListener.instance = new OrderEventListener();
    }
    return OrderEventListener.instance;
  }

  // Register all order event listeners
  register(): void {
    if (this.isRegistered) {
      Logger.getInstance().warn('Order event listener already registered');
      return;
    }

    // Listen to order creation
    eventEmitter.on(EVENT_NAMES.ORDER_CREATED, async (orderCreatedEvent: OrderCreatedEvent) => {
      await this.handleOrderCreated(orderCreatedEvent);
    });

    // Listen to order status changes
    eventEmitter.on(EVENT_NAMES.ORDER_STATUS_CHANGED, async (statusChangedEvent: OrderStatusChangedEvent) => {
      await this.handleOrderStatusChanged(statusChangedEvent);
    });

    // Listen to order failures
    eventEmitter.on(EVENT_NAMES.ORDER_FAILED, async (orderFailedEvent: OrderFailedEvent) => {
      await this.handleOrderFailed(orderFailedEvent);
    });

    // Listen to order confirmations
    eventEmitter.on(EVENT_NAMES.ORDER_CONFIRMED, async (orderConfirmedEvent: OrderConfirmedEvent) => {
      await this.handleOrderConfirmed(orderConfirmedEvent);
    });

    this.isRegistered = true;
    Logger.getInstance().info('Order event listener registered');
  }

  // Handle ORDER_CREATED event
  private async handleOrderCreated(orderCreatedEvent: OrderCreatedEvent): Promise<void> {
    try {
      const { aggregateId, data, timestamp } = orderCreatedEvent;

      Logger.getInstance().info('Order created event received', {
        orderId: aggregateId,
        tokenIn: data.order.tokenIn,
        tokenOut: data.order.tokenOut,
        amount: data.order.amount,
      });

      // Store in history
      this.addToHistory(aggregateId, {
        orderId: aggregateId,
        eventType: 'ORDER_CREATED',
        timestamp,
        details: {
          order: data.order,
        },
      });

      // TODO: Persist to database (ORDER_HISTORY table)

    } catch (error) {
      Logger.getInstance().error('Failed to handle ORDER_CREATED event', {
        error: error instanceof Error ? error.message : String(error),
        aggregateId: orderCreatedEvent.aggregateId,
      });
    }
  }

  // Handle ORDER_STATUS_CHANGED event
  private async handleOrderStatusChanged(statusChangedEvent: OrderStatusChangedEvent): Promise<void> {
    try {
      const { aggregateId, data, timestamp } = statusChangedEvent;

      Logger.getInstance().info('Order status changed', {
        orderId: aggregateId,
        from: data.previousStatus,
        to: data.newStatus,
      });

      // Store in history
      this.addToHistory(aggregateId, {
        orderId: aggregateId,
        eventType: 'ORDER_STATUS_CHANGED',
        timestamp,
        details: {
          previousStatus: data.previousStatus,
          newStatus: data.newStatus,
        },
      });

      // TODO: Persist to database

    } catch (error) {
      Logger.getInstance().error('Failed to handle ORDER_STATUS_CHANGED event', {
        error: error instanceof Error ? error.message : String(error),
        aggregateId: statusChangedEvent.aggregateId,
      });
    }
  }

  // Handle ORDER_FAILED event
  private async handleOrderFailed(orderFailedEvent: OrderFailedEvent): Promise<void> {
    try {
      const { aggregateId, data, timestamp } = orderFailedEvent;

      Logger.getInstance().error('Order failed event received', {
        error: data.errorMessage,
        orderId: aggregateId,
        retryCount: data.retryCount,
        maxRetries: data.maxRetries,
      });

      // Store in history
      this.addToHistory(aggregateId, {
        orderId: aggregateId,
        eventType: 'ORDER_FAILED',
        timestamp,
        details: {
          errorMessage: data.errorMessage,
          retryCount: data.retryCount,
          maxRetries: data.maxRetries,
        },
      });

      // TODO: Persist to database

    } catch (error) {
      Logger.getInstance().error('Failed to handle ORDER_FAILED event', {
        error: error instanceof Error ? error.message : String(error),
        aggregateId: orderFailedEvent.aggregateId,
      });
    }
  }

  // Handle ORDER_CONFIRMED event
  private async handleOrderConfirmed(orderConfirmedEvent: OrderConfirmedEvent): Promise<void> {
    try {
      const { aggregateId, data, timestamp } = orderConfirmedEvent;

      Logger.getInstance().info('Order confirmed event received', {
        orderId: aggregateId,
        transactionHash: data.transactionHash,
        amountOut: data.amountOut,
      });

      // Store in history
      this.addToHistory(aggregateId, {
        orderId: aggregateId,
        eventType: 'ORDER_CONFIRMED',
        timestamp,
        details: {
          transactionHash: data.transactionHash,
          executedPrice: data.executedPrice,
          amountOut: data.amountOut,
        },
      });

      // TODO: Persist to database

    } catch (error) {
      Logger.getInstance().error('Failed to handle ORDER_CONFIRMED event', {
        error: error instanceof Error ? error.message : String(error),
        aggregateId: orderConfirmedEvent.aggregateId,
      });
    }
  }

  // Add record to in-memory history
  private addToHistory(orderId: string, historyRecord: OrderHistoryRecord): void {
    const existingHistory = this.orderHistory.get(orderId) || [];
    existingHistory.push(historyRecord);
    this.orderHistory.set(orderId, existingHistory);
  }

  // Get order history (for debugging/testing)
  getOrderHistory(orderId: string): OrderHistoryRecord[] {
    return this.orderHistory.get(orderId) || [];
  }

  // Clear history (for testing)
  clearHistory(): void {
    this.orderHistory.clear();
  }

  // Unregister all listeners (for testing/shutdown)
  unregister(): void {
    eventEmitter.off(EVENT_NAMES.ORDER_CREATED, this.handleOrderCreated);
    eventEmitter.off(EVENT_NAMES.ORDER_STATUS_CHANGED, this.handleOrderStatusChanged);
    eventEmitter.off(EVENT_NAMES.ORDER_FAILED, this.handleOrderFailed);
    eventEmitter.off(EVENT_NAMES.ORDER_CONFIRMED, this.handleOrderConfirmed);
    this.isRegistered = false;
    Logger.getInstance().info('Order event listener unregistered');
  }
}

// Export singleton instance
export const orderListener = OrderEventListener.getInstance();
