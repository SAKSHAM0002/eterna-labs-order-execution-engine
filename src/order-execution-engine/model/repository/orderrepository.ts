// Order repository interface - defines the contract for order data persistence
import type { Order, CreateOrderInput, UpdateOrderInput, OrderStatus } from '../order/';

// Order repository interface - CRUD operations for Order entity
export interface OrderRepository {
  // Create a new order
  create(orderInput: CreateOrderInput): Promise<Order>;

  // Find order by ID
  findById(orderId: string): Promise<Order | null>;

  // Find multiple orders by IDs
  findByIds(orderIds: string[]): Promise<Order[]>;

  // Find all orders with optional filtering
  findAll(filters?: OrderFilters): Promise<Order[]>;

  // Update an existing order
  update(orderId: string, orderUpdate: UpdateOrderInput): Promise<Order>;

  // Update order status
  updateStatus(orderId: string, newStatus: OrderStatus): Promise<Order>;

  // Delete order (soft delete recommended)
  delete(orderId: string): Promise<void>;

  // Count orders matching filters
  count(filters?: OrderFilters): Promise<number>;

  // Check if order exists
  exists(orderId: string): Promise<boolean>;
}

// Order query filters
export interface OrderFilters {
  status?: OrderStatus | OrderStatus[];
  tokenIn?: string;
  tokenOut?: string;
  selectedDex?: string;
  minAmount?: number;
  maxAmount?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

// Pagination result
export interface PaginatedOrders {
  orders: Order[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
