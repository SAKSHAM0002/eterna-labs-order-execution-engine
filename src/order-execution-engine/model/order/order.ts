// Order domain model - represents the core business entity
import { z } from 'zod';

// Order status enum - tracks order lifecycle
export const OrderStatusSchema = z.enum([
  'pending',
  'processing',
  'routing',
  'submitted',
  'completed',
  'failed',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// Order entity - main business object
export interface Order {
  id: string;
  tokenIn: string;
  tokenOut: string;
  amount: number;
  status: OrderStatus;
  
  selectedDex?: string;
  executedPrice?: number;
  transactionHash?: string;
  
  slippageTolerance: number;
  maxRetries: number;
  retryCount: number;
  
  errorMessage?: string;
  
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
}

// Order creation input
export interface CreateOrderInput {
  tokenIn: string;
  tokenOut: string;
  amount: number;
  status?: OrderStatus;
  selectedDex?: string;
  slippageTolerance?: number;
  maxRetries?: number;
}

// Order update input
export interface UpdateOrderInput {
  status?: OrderStatus;
  selectedDex?: string;
  executedPrice?: number;
  transactionHash?: string;
  retryCount?: number;
  errorMessage?: string;
  confirmedAt?: Date;
}
