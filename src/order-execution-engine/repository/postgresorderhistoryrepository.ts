// PostgreSQL Order History Repository Implementation - Implements OrderHistoryRepository using PostgreSQL
// Append-only event store for audit trail and event sourcing

import { database } from './database';
import { Logger } from '@/common/logger';
import type {
  OrderHistoryRepository,
  OrderHistoryRecord,
  HistoryFilters,
} from '@/order-execution-engine/model';
import { v4 as uuidv4 } from 'uuid';

// Database Row Type (snake_case columns from PostgreSQL)
interface OrderHistoryRow {
  id: string;
  order_id: string;
  event_type: string;
  event_data: string | Record<string, unknown>; // JSONB can be parsed or not
  event_version: number;
  metadata: string | Record<string, unknown> | null;
  timestamp: Date;
}

// Domain Event type for event sourcing
interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  timestamp: Date;
  version: number;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// PostgreSQL Order History Repository - Singleton implementation for immutable event log
export class PostgresOrderHistoryRepository implements OrderHistoryRepository {
  private static instance: PostgresOrderHistoryRepository;
  private readonly tableName = 'order_history';

  private constructor() {}

  // Get singleton instance
  static getInstance(): PostgresOrderHistoryRepository {
    if (!PostgresOrderHistoryRepository.instance) {
      PostgresOrderHistoryRepository.instance = new PostgresOrderHistoryRepository();
      Logger.getInstance().info('PostgreSQL Order History Repository initialized');
    }
    return PostgresOrderHistoryRepository.instance;
  }

  // Append event to order history - This is append-only (no updates/deletes allowed)
  async append(
    historyRecord: Omit<OrderHistoryRecord, 'id' | 'timestamp'>
  ): Promise<OrderHistoryRecord> {
    const recordId = uuidv4();
    const now = new Date();

    const insertQuery = `
      INSERT INTO ${this.tableName} (
        id, order_id, event_type, event_data, 
        event_version, metadata, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const queryValues = [
      recordId,
      historyRecord.orderId,
      historyRecord.eventType,
      JSON.stringify(historyRecord.eventData),
      historyRecord.version,
      historyRecord.metadata ? JSON.stringify(historyRecord.metadata) : null,
      now,
    ];

    try {
      const queryResult = await database.query<OrderHistoryRow>(insertQuery, queryValues);

      if (!queryResult.rows[0]) {
        throw new Error('Failed to append history: No rows returned');
      }

      const appendedRecord = this.mapRowToHistoryRecord(queryResult.rows[0]);
      Logger.getInstance().debug('History record appended', {
        recordId: appendedRecord.id,
        orderId: appendedRecord.orderId,
        eventType: appendedRecord.eventType,
      });

      return appendedRecord;
    } catch (error) {
      Logger.getInstance().error('Failed to append history record', {
        error: error instanceof Error ? error.message : String(error),
        orderId: historyRecord.orderId,
        eventType: historyRecord.eventType,
      });
      throw error;
    }
  }

  // Get full history for an order
  async getOrderHistory(orderId: string): Promise<OrderHistoryRecord[]> {
    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE order_id = $1
      ORDER BY timestamp ASC, event_version ASC
    `;

    try {
      const queryResult = await database.query<OrderHistoryRow>(selectQuery, [orderId]);

      Logger.getInstance().debug('Order history retrieved', {
        orderId,
        recordCount: queryResult.rows.length,
      });

      return queryResult.rows.map((historyRow: OrderHistoryRow) =>
        this.mapRowToHistoryRecord(historyRow)
      );
    } catch (error) {
      Logger.getInstance().error('Failed to get order history', {
        error: error instanceof Error ? error.message : String(error),
        orderId,
      });
      throw error;
    }
  }

  // Get history by event type
  async getByEventType(orderId: string, eventType: string): Promise<OrderHistoryRecord[]> {
    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE order_id = $1 AND event_type = $2
      ORDER BY timestamp ASC
    `;

    try {
      const queryResult = await database.query<OrderHistoryRow>(selectQuery, [
        orderId,
        eventType,
      ]);

      return queryResult.rows.map((historyRow: OrderHistoryRow) =>
        this.mapRowToHistoryRecord(historyRow)
      );
    } catch (error) {
      Logger.getInstance().error('Failed to get history by event type', {
        error: error instanceof Error ? error.message : String(error),
        orderId,
        eventType,
      });
      throw error;
    }
  }

  // Get history within time range
  async getByTimeRange(
    orderId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OrderHistoryRecord[]> {
    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE order_id = $1 
        AND timestamp >= $2 
        AND timestamp <= $3
      ORDER BY timestamp ASC
    `;

    try {
      const queryResult = await database.query<OrderHistoryRow>(selectQuery, [
        orderId,
        startDate,
        endDate,
      ]);

      return queryResult.rows.map((historyRow: OrderHistoryRow) =>
        this.mapRowToHistoryRecord(historyRow)
      );
    } catch (error) {
      Logger.getInstance().error('Failed to get history by time range', {
        error: error instanceof Error ? error.message : String(error),
        orderId,
        startDate,
        endDate,
      });
      throw error;
    }
  }

  // Get latest event for order
  async getLatestEvent(orderId: string): Promise<OrderHistoryRecord | null> {
    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE order_id = $1
      ORDER BY timestamp DESC, event_version DESC
      LIMIT 1
    `;

    try {
      const queryResult = await database.query<OrderHistoryRow>(selectQuery, [orderId]);

      if (queryResult.rows.length === 0) {
        Logger.getInstance().debug('No history found for order', { orderId });
        return null;
      }

      return this.mapRowToHistoryRecord(queryResult.rows[0]);
    } catch (error) {
      Logger.getInstance().error('Failed to get latest event', {
        error: error instanceof Error ? error.message : String(error),
        orderId,
      });
      throw error;
    }
  }

  // Count history records
  async count(orderId: string): Promise<number> {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.tableName}
      WHERE order_id = $1
    `;

    try {
      const queryResult = await database.query<{ total: string }>(countQuery, [orderId]);

      return parseInt(queryResult.rows[0]?.total || '0', 10);
    } catch (error) {
      Logger.getInstance().error('Failed to count history records', {
        error: error instanceof Error ? error.message : String(error),
        orderId,
      });
      throw error;
    }
  }

  // Rebuild order state from history (Event Sourcing) - Returns all domain events in chronological order
  async rebuildOrderState(orderId: string): Promise<DomainEvent[]> {
    const historyRecords = await this.getOrderHistory(orderId);

    // Convert history records to domain events
    const domainEvents: DomainEvent[] = historyRecords.map((historyRecord) => ({
      id: historyRecord.id,
      type: historyRecord.eventType,
      aggregateId: historyRecord.orderId,
      timestamp: historyRecord.timestamp,
      version: historyRecord.version,
      data: historyRecord.eventData,
      metadata: historyRecord.metadata,
    }));

    Logger.getInstance().debug('Order state rebuilt from history', {
      orderId,
      eventCount: domainEvents.length,
    });

    return domainEvents;
  }

  // Map database row to OrderHistoryRecord
  private mapRowToHistoryRecord(historyRow: OrderHistoryRow): OrderHistoryRecord {
    return {
      id: historyRow.id,
      orderId: historyRow.order_id,
      eventType: historyRow.event_type,
      eventData:
        typeof historyRow.event_data === 'string'
          ? JSON.parse(historyRow.event_data)
          : historyRow.event_data,
      timestamp: historyRow.timestamp,
      version: historyRow.event_version,
      metadata:
        historyRow.metadata
          ? typeof historyRow.metadata === 'string'
            ? JSON.parse(historyRow.metadata)
            : historyRow.metadata
          : undefined,
    };
  }
}

// Export singleton instance
export const orderHistoryRepository = PostgresOrderHistoryRepository.getInstance();
