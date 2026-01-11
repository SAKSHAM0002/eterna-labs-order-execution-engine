// PostgreSQL Order Repository Implementation - Implements OrderRepository using PostgreSQL

import { database } from './database';
import { Logger } from '@/common/logger';
import { NotFoundError } from '@/common/errors/errors';
import type {
  OrderRepository,
  OrderFilters,
  PaginatedOrders,
} from '@/order-execution-engine/model';
import type { Order, OrderStatus } from '@/order-execution-engine/model';
import { v4 as uuidv4 } from 'uuid';

// Database Row Type (snake_case columns from PostgreSQL)
interface OrderRow {
  id: string;
  token_in: string;
  token_out: string;
  amount: number;
  status: string;
  selected_dex: string | null;
  executed_price: number | null;
  transaction_hash: string | null;
  slippage_tolerance: number;
  max_retries: number;
  retry_count: number;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
  confirmed_at: Date | null;
}

// Create order input (subset of Order for creation)
interface CreateOrderInput {
  tokenIn: string;
  tokenOut: string;
  amount: number;
  status?: OrderStatus;
  selectedDex?: string;
  slippageTolerance: number;
  maxRetries: number;
}

// Update order input (partial update fields)
interface UpdateOrderInput {
  status?: OrderStatus;
  selectedDex?: string;
  executedPrice?: number;
  transactionHash?: string;
  retryCount?: number;
  errorMessage?: string;
  confirmedAt?: Date;
}

// PostgreSQL Order Repository - Singleton implementation
export class PostgresOrderRepository implements OrderRepository {
  private static instance: PostgresOrderRepository;
  private readonly tableName = 'orders';

  private constructor() {}

  // Get singleton instance
  static getInstance(): PostgresOrderRepository {
    if (!PostgresOrderRepository.instance) {
      PostgresOrderRepository.instance = new PostgresOrderRepository();
      Logger.getInstance().info('PostgreSQL Order Repository initialized');
    }
    return PostgresOrderRepository.instance;
  }

  // Create a new order
  async create(orderInput: CreateOrderInput): Promise<Order> {
    const orderId = uuidv4();
    const now = new Date();

    const insertQuery = `
      INSERT INTO ${this.tableName} (
        id, token_in, token_out, amount, status,
        selected_dex, slippage_tolerance, max_retries, retry_count,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const queryValues = [
      orderId,
      orderInput.tokenIn,
      orderInput.tokenOut,
      orderInput.amount,
      orderInput.status || 'pending',
      orderInput.selectedDex || null,
      orderInput.slippageTolerance,
      orderInput.maxRetries,
      0, // retry_count starts at 0
      now,
      now,
    ];

    try {
      const queryResult = await database.query<OrderRow>(insertQuery, queryValues);

      if (!queryResult.rows[0]) {
        throw new Error('Failed to create order: No rows returned');
      }

      const createdOrder = this.mapRowToOrder(queryResult.rows[0]);
      Logger.getInstance().info('Order created in database', { orderId: createdOrder.id });

      return createdOrder;
    } catch (error) {
      Logger.getInstance().error('Failed to create order', {
        error: error instanceof Error ? error.message : String(error),
        orderInput,
      });
      throw error;
    }
  }

  // Find order by ID
  async findById(orderId: string): Promise<Order | null> {
    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE id = $1
    `;

    try {
      const queryResult = await database.query<OrderRow>(selectQuery, [orderId]);

      if (queryResult.rows.length === 0) {
        Logger.getInstance().debug('Order not found', { orderId });
        return null;
      }

      return this.mapRowToOrder(queryResult.rows[0]);
    } catch (error) {
      Logger.getInstance().error('Failed to find order by ID', {
        error: error instanceof Error ? error.message : String(error),
        orderId,
      });
      throw error;
    }
  }

  // Find multiple orders by IDs
  async findByIds(orderIds: string[]): Promise<Order[]> {
    if (orderIds.length === 0) {
      return [];
    }

    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE id = ANY($1::uuid[])
    `;

    try {
      const queryResult = await database.query<OrderRow>(selectQuery, [orderIds]);

      return queryResult.rows.map((orderRow: OrderRow) => this.mapRowToOrder(orderRow));
    } catch (error) {
      Logger.getInstance().error('Failed to find orders by IDs', {
        error: error instanceof Error ? error.message : String(error),
        orderIds,
      });
      throw error;
    }
  }

  // Find all orders with optional filtering
  async findAll(filters?: OrderFilters): Promise<Order[]> {
    const { whereClause, queryParameters } = this.buildWhereClause(filters);
    const sortClause = this.buildSortClause(filters);
    const limitClause = filters?.limit ? `LIMIT ${filters.limit}` : '';
    const offsetClause = filters?.offset ? `OFFSET ${filters.offset}` : '';

    const selectQuery = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ${sortClause}
      ${limitClause}
      ${offsetClause}
    `;

    try {
      const queryResult = await database.query<OrderRow>(selectQuery, queryParameters);

      Logger.getInstance().debug('Orders retrieved', {
        count: queryResult.rows.length,
        filters,
      });

      return queryResult.rows.map((orderRow: OrderRow) => this.mapRowToOrder(orderRow));
    } catch (error) {
      Logger.getInstance().error('Failed to find orders', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  // Update an existing order
  async update(orderId: string, orderUpdate: UpdateOrderInput): Promise<Order> {
    const updateFields: string[] = [];
    const queryValues: unknown[] = [];
    let parameterIndex = 1;

    // Build dynamic UPDATE clause
    if (orderUpdate.status !== undefined) {
      updateFields.push(`status = $${parameterIndex++}`);
      queryValues.push(orderUpdate.status);
    }
    if (orderUpdate.selectedDex !== undefined) {
      updateFields.push(`selected_dex = $${parameterIndex++}`);
      queryValues.push(orderUpdate.selectedDex);
    }
    if (orderUpdate.executedPrice !== undefined) {
      updateFields.push(`executed_price = $${parameterIndex++}`);
      queryValues.push(orderUpdate.executedPrice);
    }
    if (orderUpdate.transactionHash !== undefined) {
      updateFields.push(`transaction_hash = $${parameterIndex++}`);
      queryValues.push(orderUpdate.transactionHash);
    }
    if (orderUpdate.retryCount !== undefined) {
      updateFields.push(`retry_count = $${parameterIndex++}`);
      queryValues.push(orderUpdate.retryCount);
    }
    if (orderUpdate.errorMessage !== undefined) {
      updateFields.push(`error_message = $${parameterIndex++}`);
      queryValues.push(orderUpdate.errorMessage);
    }
    if (orderUpdate.confirmedAt !== undefined) {
      updateFields.push(`confirmed_at = $${parameterIndex++}`);
      queryValues.push(orderUpdate.confirmedAt);
    }

    // Always update updated_at
    updateFields.push(`updated_at = $${parameterIndex++}`);
    queryValues.push(new Date());

    // Add orderId as last parameter
    queryValues.push(orderId);

    const updateQuery = `
      UPDATE ${this.tableName}
      SET ${updateFields.join(', ')}
      WHERE id = $${parameterIndex}
      RETURNING *
    `;

    try {
      const queryResult = await database.query<OrderRow>(updateQuery, queryValues);

      if (queryResult.rows.length === 0) {
        throw new NotFoundError(`Order not found: ${orderId}`);
      }

      const updatedOrder = this.mapRowToOrder(queryResult.rows[0]);
      Logger.getInstance().info('Order updated', { orderId, updateFields: Object.keys(orderUpdate) });

      return updatedOrder;
    } catch (error) {
      Logger.getInstance().error('Failed to update order', {
        error: error instanceof Error ? error.message : String(error),
        orderId,
        orderUpdate,
      });
      throw error;
    }
  }

  // Update order status
  async updateStatus(orderId: string, newStatus: OrderStatus): Promise<Order> {
    return this.update(orderId, { status: newStatus });
  }

  // Delete order (soft delete recommended in production)
  async delete(orderId: string): Promise<void> {
    const deleteQuery = `
      DELETE FROM ${this.tableName}
      WHERE id = $1
    `;

    try {
      await database.query(deleteQuery, [orderId]);

      Logger.getInstance().info('Order deleted', { orderId });
    } catch (error) {
      Logger.getInstance().error('Failed to delete order', {
        error: error instanceof Error ? error.message : String(error),
        orderId,
      });
      throw error;
    }
  }

  // Count orders matching filters
  async count(filters?: OrderFilters): Promise<number> {
    const { whereClause, queryParameters } = this.buildWhereClause(filters);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.tableName}
      ${whereClause}
    `;

    try {
      const queryResult = await database.query<{ total: string }>(countQuery, queryParameters);

      return parseInt(queryResult.rows[0]?.total || '0', 10);
    } catch (error) {
      Logger.getInstance().error('Failed to count orders', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  // Check if order exists
  async exists(orderId: string): Promise<boolean> {
    const existsQuery = `
      SELECT 1 FROM ${this.tableName}
      WHERE id = $1
      LIMIT 1
    `;

    try {
      const queryResult = await database.query(existsQuery, [orderId]);

      return queryResult.rows.length > 0;
    } catch (error) {
      Logger.getInstance().error('Failed to check order existence', {
        error: error instanceof Error ? error.message : String(error),
        orderId,
      });
      throw error;
    }
  }

  // Build WHERE clause from filters
  private buildWhereClause(filters?: OrderFilters): {
    whereClause: string;
    queryParameters: unknown[];
  } {
    if (!filters) {
      return { whereClause: '', queryParameters: [] };
    }

    const conditions: string[] = [];
    const queryParameters: unknown[] = [];
    let parameterIndex = 1;

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(`status = ANY($${parameterIndex++}::text[])`);
        queryParameters.push(filters.status);
      } else {
        conditions.push(`status = $${parameterIndex++}`);
        queryParameters.push(filters.status);
      }
    }

    if (filters.tokenIn) {
      conditions.push(`token_in = $${parameterIndex++}`);
      queryParameters.push(filters.tokenIn);
    }

    if (filters.tokenOut) {
      conditions.push(`token_out = $${parameterIndex++}`);
      queryParameters.push(filters.tokenOut);
    }

    if (filters.selectedDex) {
      conditions.push(`selected_dex = $${parameterIndex++}`);
      queryParameters.push(filters.selectedDex);
    }

    if (filters.minAmount !== undefined) {
      conditions.push(`amount >= $${parameterIndex++}`);
      queryParameters.push(filters.minAmount);
    }

    if (filters.maxAmount !== undefined) {
      conditions.push(`amount <= $${parameterIndex++}`);
      queryParameters.push(filters.maxAmount);
    }

    if (filters.createdAfter) {
      conditions.push(`created_at >= $${parameterIndex++}`);
      queryParameters.push(filters.createdAfter);
    }

    if (filters.createdBefore) {
      conditions.push(`created_at <= $${parameterIndex++}`);
      queryParameters.push(filters.createdBefore);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { whereClause, queryParameters };
  }

  // Build ORDER BY clause
  private buildSortClause(filters?: OrderFilters): string {
    if (!filters?.sortBy) {
      return 'ORDER BY created_at DESC'; // Default sort
    }

    const sortColumn = filters.sortBy === 'createdAt' ? 'created_at' :
                       filters.sortBy === 'updatedAt' ? 'updated_at' :
                       filters.sortBy;

    const sortDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';

    return `ORDER BY ${sortColumn} ${sortDirection}`;
  }

  // Map database row to Order domain model
  private mapRowToOrder(orderRow: OrderRow): Order {
    return {
      id: orderRow.id,
      tokenIn: orderRow.token_in,
      tokenOut: orderRow.token_out,
      amount: orderRow.amount,
      status: orderRow.status as OrderStatus,
      selectedDex: orderRow.selected_dex || undefined,
      executedPrice: orderRow.executed_price || undefined,
      transactionHash: orderRow.transaction_hash || undefined,
      slippageTolerance: orderRow.slippage_tolerance,
      maxRetries: orderRow.max_retries,
      retryCount: orderRow.retry_count,
      errorMessage: orderRow.error_message || undefined,
      createdAt: orderRow.created_at,
      updatedAt: orderRow.updated_at,
      confirmedAt: orderRow.confirmed_at || undefined,
    };
  }
}

// Export singleton instance
export const orderRepository = PostgresOrderRepository.getInstance();
