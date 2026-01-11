// Order history repository interface - audit trail for all order state changes
import type { DomainEvent } from '../events/';

// Order history record - immutable record of an order event
export interface OrderHistoryRecord {
  id: string;
  orderId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  timestamp: Date;
  version: number;
  metadata?: Record<string, unknown>;
}

// Order history repository interface - append-only event store
export interface OrderHistoryRepository {
  // Append event to order history (append-only, no updates/deletes)
  append(historyRecord: Omit<OrderHistoryRecord, 'id' | 'timestamp'>): Promise<OrderHistoryRecord>;

  // Get full history for an order
  getOrderHistory(orderId: string): Promise<OrderHistoryRecord[]>;

  // Get history by event type
  getByEventType(orderId: string, eventType: string): Promise<OrderHistoryRecord[]>;

  // Get history within time range
  getByTimeRange(orderId: string, startDate: Date, endDate: Date): Promise<OrderHistoryRecord[]>;

  // Get latest event for order
  getLatestEvent(orderId: string): Promise<OrderHistoryRecord | null>;

  // Count history records
  count(orderId: string): Promise<number>;

  // Rebuild order state from history (Event Sourcing)
  rebuildOrderState(orderId: string): Promise<DomainEvent[]>;
}

// History query filters
export interface HistoryFilters {
  orderId?: string;
  eventType?: string | string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
