// Event types - defines all domain events that flow through the system
import { Order } from '../order/';
import { DexQuote } from '../Quote';

// Base domain event - all events extend this
export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  timestamp: Date;
  version: number;
  metadata?: Record<string, any>;
}

// Order events
export interface OrderCreatedEvent extends DomainEvent {
  type: 'order:created';
  data: {
    order: Order;
  };
}

export interface OrderStatusChangedEvent extends DomainEvent {
  type: 'order:status-changed';
  data: {
    orderId: string;
    previousStatus: string;
    newStatus: string;
  };
}

export interface OrderFailedEvent extends DomainEvent {
  type: 'order:failed';
  data: {
    orderId: string;
    errorMessage: string;
    retryCount: number;
    maxRetries: number;
  };
}

export interface OrderConfirmedEvent extends DomainEvent {
  type: 'order:confirmed';
  data: {
    orderId: string;
    transactionHash: string;
    executedPrice: number;
    amountOut: number;
  };
}

// Execution events
export interface ExecutionStartedEvent extends DomainEvent {
  type: 'execution:started';
  data: {
    orderId: string;
    order: Order;
  };
}

export interface QuotesFetchedEvent extends DomainEvent {
  type: 'execution:quotes-fetched';
  data: {
    orderId: string;
    quotes: DexQuote[];
  };
}

export interface DexSelectedEvent extends DomainEvent {
  type: 'execution:dex-selected';
  data: {
    orderId: string;
    selectedDex: string;
    quote: DexQuote;
  };
}

export interface SwapSubmittedEvent extends DomainEvent {
  type: 'execution:swap-submitted';
  data: {
    orderId: string;
    transactionHash: string;
    dex: string;
  };
}

export interface SwapConfirmedEvent extends DomainEvent {
  type: 'execution:swap-confirmed';
  data: {
    orderId: string;
    transactionHash: string;
    executedPrice: number;
    confirmationTime: number;
  };
}

export interface ExecutionFailedEvent extends DomainEvent {
  type: 'execution:failed';
  data: {
    orderId: string;
    errorMessage: string;
    step: string;
  };
}

export interface ExecutionRetryingEvent extends DomainEvent {
  type: 'execution:retrying';
  data: {
    orderId: string;
    retryCount: number;
    maxRetries: number;
    nextRetryAt: Date;
  };
}

// Routing events
export interface RoutingStartedEvent extends DomainEvent {
  type: 'routing:started';
  data: {
    orderId: string;
  };
}

export interface RoutingCompletedEvent extends DomainEvent {
  type: 'routing:completed';
  data: {
    orderId: string;
    selectedRoute: string;
  };
}

// System events
export interface SystemErrorEvent extends DomainEvent {
  type: 'system:error';
  data: {
    message: string;
    error: string;
    context?: Record<string, any>;
  };
}

export interface QueueJobAddedEvent extends DomainEvent {
  type: 'queue:job-added';
  data: {
    orderId: string;
    jobId: string;
    queue: string;
  };
}

// Union type for all events
export type AllDomainEvents =
  | OrderCreatedEvent
  | OrderStatusChangedEvent
  | OrderFailedEvent
  | OrderConfirmedEvent
  | ExecutionStartedEvent
  | QuotesFetchedEvent
  | DexSelectedEvent
  | SwapSubmittedEvent
  | SwapConfirmedEvent
  | ExecutionFailedEvent
  | ExecutionRetryingEvent
  | RoutingStartedEvent
  | RoutingCompletedEvent
  | SystemErrorEvent
  | QueueJobAddedEvent;

// Event listener interface
export interface EventListener {
  eventType: string;
  handle(event: DomainEvent): Promise<void>;
}
