// HTTP API contracts - request/response types for REST endpoints
import { z } from 'zod';
import { OrderStatusSchema } from './order/';

// POST /orders - Request body
export const OrderRequestSchema = z.object({
  tokenIn: z.string().min(1, 'tokenIn is required').max(50, 'tokenIn too long'),
  tokenOut: z.string().min(1, 'tokenOut is required').max(50, 'tokenOut too long'),
  amount: z.number().positive('amount must be positive').finite(),
  slippageTolerance: z.number().min(0).max(100).optional().default(1.0),
  maxRetries: z.number().int().min(0).max(10).optional().default(3),
});
export type OrderRequest = z.infer<typeof OrderRequestSchema>;

// POST /orders - Response body
export const OrderResponseSchema = z.object({
  orderId: z.string().uuid(),
  tokenIn: z.string(),
  tokenOut: z.string(),
  amount: z.number().positive(),
  status: OrderStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  selectedDex: z.string().optional(),
  executedPrice: z.number().positive().optional(),
  transactionHash: z.string().optional(),
  errorMessage: z.string().optional(),
});
export type OrderResponse = z.infer<typeof OrderResponseSchema>;
