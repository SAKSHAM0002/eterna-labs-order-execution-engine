// BullMQ Worker Manager - Creates and manages workers for background job processing

import { Worker } from 'bullmq';
import { Logger } from '@/common/logger';
import { env, QUEUE_NAMES, getRedisConfig } from '@/order-execution-engine/config';
import { type ExecutionJob } from '@/order-execution-engine/model';
import { processOrderExecutionJob } from './orderexecutionworker';

// Create and start BullMQ worker
// Workers are background processes that:
// 1. Listen to the job queue (Redis)
// 2. Pick up jobs when available
// 3. Process jobs by calling worker functions
// 4. Report results back to queue
export function createWorker(): Worker<ExecutionJob> {
  const workerId = `worker-${process.pid}-${Math.random().toString(36).substring(2, 9)}`;

  Logger.getInstance().info('Initializing BullMQ worker', {
    workerId,
    queue: QUEUE_NAMES.ORDER_EXECUTION,
    concurrency: env.QUEUE_CONCURRENCY,
  });

  const worker = new Worker<ExecutionJob>(
    QUEUE_NAMES.ORDER_EXECUTION,
    async (job) => {
      Logger.getInstance().info('Worker picked up job from queue', {
        workerId,
        jobId: job.id,
        orderId: job.data.orderId,
        attemptNumber: job.attemptsMade + 1,
      });

      const startTime = Date.now();

      try {
        const result = await processOrderExecutionJob(job);

        const executionTime = Date.now() - startTime;
        Logger.getInstance().info('Worker completed job successfully', {
          workerId,
          jobId: job.id,
          orderId: job.data.orderId,
          executionTimeMs: executionTime,
        });

        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        Logger.getInstance().error('Worker job execution failed', {
          error: error instanceof Error ? error.message : String(error),
          workerId,
          jobId: job.id,
          orderId: job.data.orderId,
          executionTimeMs: executionTime,
        });
        throw error;
      }
    },
    {
      connection: getRedisConfig(),
      concurrency: env.QUEUE_CONCURRENCY,
      limiter: {
        max: 100,
        duration: 1000,
      },
    }
  );

  // Event listeners
  worker.on('completed', (job) => {
    Logger.getInstance().info('Worker job completed event', {
      workerId,
      jobId: job.id,
      orderId: job.data.orderId,
    });
  });

  worker.on('failed', (job, error) => {
    if (job) {
      Logger.getInstance().error('Worker job failed event', {
        error: error.message,
        workerId,
        jobId: job.id,
        orderId: job.data.orderId,
        attemptsMade: job.attemptsMade,
      });
    }
  });

  worker.on('stalled', (jobId) => {
    Logger.getInstance().warn('Worker job stalled', {
      workerId,
      jobId,
    });
  });

  worker.on('error', (error) => {
    Logger.getInstance().error('Worker error', {
      error: error.message,
      workerId,
    });
  });

  Logger.getInstance().info('BullMQ worker started successfully', { workerId });

  return worker;
}

// Stop the worker gracefully
export async function stopWorker(worker: Worker): Promise<void> {
  try {
    await worker.close();
    Logger.getInstance().info('Worker stopped successfully');
  } catch (error) {
    Logger.getInstance().error('Failed to stop worker', { error });
    throw error;
  }
}
