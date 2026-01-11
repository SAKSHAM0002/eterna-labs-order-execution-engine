// Order Execution Worker - BullMQ job processor for order execution
// Thin layer that delegates to ExecutionService for all orchestration
// This is NOT a handler - it's a background worker triggered internally by the job queue

import { Job } from 'bullmq';
import { Logger } from '@/common/logger';
import { executionService } from '@/order-execution-engine/services';
import type { ExecutionJob } from '@/order-execution-engine/model';

/**
 * Process order execution job from BullMQ queue
 * 
 * This worker is triggered internally when:
 * 1. HTTP handler creates an order
 * 2. Order service adds job to queue
 * 3. BullMQ picks up job and calls this worker
 * 
 * Worker responsibilities:
 * - Parse job data
 * - Delegate to ExecutionService
 * - Return result for BullMQ tracking
 * 
 * ExecutionService handles:
 * - Job progress updates
 * - WebSocket status notifications
 * - Order execution orchestration
 * - Retry logic
 */
export async function processOrderExecutionJob(job: Job<ExecutionJob>): Promise<any> {
  const { orderId } = job.data;

  Logger.getInstance().debug('Worker received execution job', {
    jobId: job.id,
    orderId,
  });

  // Delegate to service - service handles all orchestration
  return await executionService.processOrderExecutionJob(job);
}
