// Execution types - BullMQ job and execution result
import { Order } from '../order/';
import { DexQuote } from '../Quote';

// Execution job for BullMQ queue
export interface ExecutionJob {
  id: string;
  orderId: string;
  order: Order;
  walletAddress?: string;
  retryCount: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// Execution result - outcome of order execution
export interface ExecutionResult {
  success: boolean;
  orderId: string;
  status: 'completed' | 'failed' | 'retrying';
  selectedDex: string;
  quote: DexQuote;
  transactionHash?: string;
  executedPrice?: number;
  errorMessage?: string;
  timestamp: Date;
}
