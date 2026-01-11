// WebSocket message types - real-time push notifications
import { z } from 'zod';
import { OrderStatusSchema } from '../order/';

// WebSocket message sent to clients
export const WebSocketMessageSchema = z.object({
  type: z.enum(['order:status-update', 'order:error', 'order:confirmed']),
  data: z.object({
    orderId: z.string().uuid(),
    status: OrderStatusSchema,
    message: z.string().optional(),
    executedPrice: z.number().positive().optional(),
    transactionHash: z.string().optional(),
  }),
});
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
