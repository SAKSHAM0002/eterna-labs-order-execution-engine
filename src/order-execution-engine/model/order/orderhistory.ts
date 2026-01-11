// Order history - tracks status changes and audit trail
import { OrderStatus } from './order';

// Single history record of order status change
export interface OrderHistory {
  id: string;
  orderId: string;
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  statusChangedAt: Date;
  details?: string;
}

// Order with complete history
export interface OrderWithHistory {
  orderId: string;
  tokenIn: string;
  tokenOut: string;
  amount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  selectedDex?: string;
  executedPrice?: number;
  transactionHash?: string;
  errorMessage?: string;
  history: OrderHistory[];
}
