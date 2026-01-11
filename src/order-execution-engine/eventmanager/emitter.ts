// Event Emitter Singleton - Central event bus for domain events across the application
// Enables loose coupling between services through event-driven architecture

import { EventEmitter } from 'events';
import { Logger } from '@/common/logger';
import { EVENT_NAMES } from '@/order-execution-engine/config';
import type {
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  OrderFailedEvent,
  OrderConfirmedEvent,
  ExecutionStartedEvent,
  ExecutionFailedEvent,
  ExecutionRetryingEvent,
  QuotesFetchedEvent,
  DexSelectedEvent,
  SwapSubmittedEvent,
  SwapConfirmedEvent,
  RoutingStartedEvent,
  RoutingCompletedEvent,
  SystemErrorEvent,
  QueueJobAddedEvent,
} from '@/order-execution-engine/model';

// Type-safe event map - Maps event names to their payload types
interface EventMap {
  [EVENT_NAMES.ORDER_CREATED]: OrderCreatedEvent;
  [EVENT_NAMES.ORDER_STATUS_CHANGED]: OrderStatusChangedEvent;
  [EVENT_NAMES.ORDER_FAILED]: OrderFailedEvent;
  [EVENT_NAMES.ORDER_CONFIRMED]: OrderConfirmedEvent;
  [EVENT_NAMES.EXECUTION_STARTED]: ExecutionStartedEvent;
  [EVENT_NAMES.EXECUTION_FAILED]: ExecutionFailedEvent;
  [EVENT_NAMES.EXECUTION_RETRYING]: ExecutionRetryingEvent;
  [EVENT_NAMES.EXECUTION_QUOTES_FETCHED]: QuotesFetchedEvent;
  [EVENT_NAMES.EXECUTION_DEX_SELECTED]: DexSelectedEvent;
  [EVENT_NAMES.EXECUTION_SWAP_SUBMITTED]: SwapSubmittedEvent;
  [EVENT_NAMES.EXECUTION_SWAP_CONFIRMED]: SwapConfirmedEvent;
  [EVENT_NAMES.ROUTING_STARTED]: RoutingStartedEvent;
  [EVENT_NAMES.ROUTING_COMPLETED]: RoutingCompletedEvent;
  [EVENT_NAMES.SYSTEM_ERROR]: SystemErrorEvent;
  [EVENT_NAMES.QUEUE_JOB_ADDED]: QueueJobAddedEvent;
}

// Type-safe event emitter - Extends Node.js EventEmitter with type safety
class TypedEventEmitter extends EventEmitter {
  // Emit a typed event
  emit<K extends keyof EventMap>(eventName: K, eventPayload: EventMap[K]): boolean {
    Logger.getInstance().debug(`Event emitted: ${eventName}`, {
      aggregateId: eventPayload.aggregateId,
      timestamp: eventPayload.timestamp,
    });
    return super.emit(eventName, eventPayload);
  }

  // Listen to a typed event
  on<K extends keyof EventMap>(
    eventName: K,
    listener: (eventPayload: EventMap[K]) => void | Promise<void>
  ): this {
    return super.on(eventName, listener);
  }

  // Listen to a typed event once
  once<K extends keyof EventMap>(
    eventName: K,
    listener: (eventPayload: EventMap[K]) => void | Promise<void>
  ): this {
    return super.once(eventName, listener);
  }

  // Remove listener for a typed event
  off<K extends keyof EventMap>(
    eventName: K,
    listener: (eventPayload: EventMap[K]) => void | Promise<void>
  ): this {
    return super.off(eventName, listener);
  }
}

// Domain Event Emitter Singleton - Single instance for all domain events
class DomainEventEmitter {
  private static instance: TypedEventEmitter;
  private static isInitialized = false;

  // Get singleton instance
  static getInstance(): TypedEventEmitter {
    if (!DomainEventEmitter.instance) {
      DomainEventEmitter.instance = new TypedEventEmitter();
      DomainEventEmitter.configure();
      Logger.getInstance().info('Domain event emitter initialized');
    }
    return DomainEventEmitter.instance;
  }

  // Configure event emitter
  private static configure(): void {
    if (DomainEventEmitter.isInitialized) {
      return;
    }

    const emitter = DomainEventEmitter.instance;

    // Increase max listeners (we have 3 listeners per event: order, execution, notification)
    emitter.setMaxListeners(50);

    // Global error handler for async listeners
    emitter.on('error' as keyof EventMap, (errorEvent: any) => {
      Logger.getInstance().error('Event listener error', { error: String(errorEvent) });
    });

    DomainEventEmitter.isInitialized = true;
  }

  // Get event statistics
  static getStats() {
    const emitter = DomainEventEmitter.getInstance();
    const eventNames = emitter.eventNames();
    
    return {
      totalEvents: eventNames.length,
      events: eventNames.map((eventName) => ({
        name: eventName,
        listenerCount: emitter.listenerCount(eventName as string),
      })),
      maxListeners: emitter.getMaxListeners(),
    };
  }

  // Remove all listeners (for testing/shutdown)
  static removeAllListeners(): void {
    const emitter = DomainEventEmitter.getInstance();
    emitter.removeAllListeners();
    Logger.getInstance().info('All event listeners removed');
  }
}

// Export singleton instance
export const eventEmitter = DomainEventEmitter.getInstance();

// Export class for testing
export { DomainEventEmitter };
