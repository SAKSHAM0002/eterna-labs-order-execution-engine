// Queue Management (BullMQ) - Manages job queues for async order execution
// Singleton pattern ensures single queue instance

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { getRedisConfig, env } from '@/order-execution-engine/config';
import { QUEUE_NAMES, ORDER_DEFAULTS } from '@/order-execution-engine/config';
import { Logger } from '@/common/logger';
import type { ExecutionJob, ExecutionResult } from '@/order-execution-engine/model';

// Queue Manager - Handles order execution queue with BullMQ
class QueueManager {
  private static instance: QueueManager;
  private orderQueue: Queue<ExecutionJob>;
  private queueEvents: QueueEvents;

  private constructor() {
    const redisConnection = getRedisConfig();

    // Initialize order execution queue
    this.orderQueue = new Queue<ExecutionJob>(QUEUE_NAMES.ORDER_EXECUTION, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: env.QUEUE_MAX_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: ORDER_DEFAULTS.RETRY_DELAY,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
          count: 5000, // Keep last 5000 failed jobs
        },
      },
    });

    // Queue events for monitoring
    this.queueEvents = new QueueEvents(QUEUE_NAMES.ORDER_EXECUTION, {
      connection: redisConnection,
    });

    this.setupEventListeners();
  }

  // Get singleton instance
  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  // Setup event listeners for monitoring
  private setupEventListeners(): void {
    this.queueEvents.on('completed', ({ jobId }: { jobId: string }) => {
      Logger.getInstance().info('Job completed', { jobId, queue: QUEUE_NAMES.ORDER_EXECUTION });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
      Logger.getInstance().error('Job failed', {
        error: failedReason,
        jobId,
        queue: QUEUE_NAMES.ORDER_EXECUTION,
      });
    });

    this.queueEvents.on('progress', ({ jobId, data: progressData }: { jobId: string; data: any }) => {
      Logger.getInstance().debug('Job progress', { jobId, progress: progressData });
    });

    this.queueEvents.on('stalled', ({ jobId }: { jobId: string }) => {
      Logger.getInstance().warn('Job stalled', { jobId });
    });
  }

  // Add job to order execution queue
  async addJob(job: ExecutionJob): Promise<string> {
    try {
      const bullJob = await this.orderQueue.add(
        'execute-order', // Job name
        job,
        {
          jobId: job.id, // Use our job ID as BullMQ job ID
          priority: 1, // Can be adjusted based on order size, etc.
        }
      );

      Logger.getInstance().info('Job added to queue', {
        jobId: bullJob.id,
        orderId: job.orderId,
        queue: QUEUE_NAMES.ORDER_EXECUTION,
      });

      return bullJob.id!;
    } catch (error) {
      Logger.getInstance().error('Failed to add job to queue', {
        error: error instanceof Error ? error.message : String(error),
        orderId: job.orderId,
      });
      throw error;
    }
  }

  // Get job by ID
  async getJob(jobId: string): Promise<Job<ExecutionJob> | undefined> {
    return this.orderQueue.getJob(jobId);
  }

  // Get job state (completed, failed, active, etc.)
  async getJobState(jobId: string): Promise<string | 'unknown'> {
    const job = await this.getJob(jobId);
    if (!job) return 'unknown';
    return await job.getState();
  }

  // Remove job from queue
  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
      Logger.getInstance().info('Job removed from queue', { jobId });
    }
  }

  // Get queue statistics
  async getStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.orderQueue.getWaitingCount(),
      this.orderQueue.getActiveCount(),
      this.orderQueue.getCompletedCount(),
      this.orderQueue.getFailedCount(),
      this.orderQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  // Pause queue processing
  async pause(): Promise<void> {
    await this.orderQueue.pause();
    Logger.getInstance().info('Queue paused', { queue: QUEUE_NAMES.ORDER_EXECUTION });
  }

  // Resume queue processing
  async resume(): Promise<void> {
    await this.orderQueue.resume();
    Logger.getInstance().info('Queue resumed', { queue: QUEUE_NAMES.ORDER_EXECUTION });
  }

  // Clean old jobs (maintenance)
  async clean(): Promise<void> {
    // Remove completed jobs older than 24 hours
    await this.orderQueue.clean(86400000, 1000, 'completed');
    // Remove failed jobs older than 7 days
    await this.orderQueue.clean(604800000, 1000, 'failed');
    Logger.getInstance().info('Queue cleaned', { queue: QUEUE_NAMES.ORDER_EXECUTION });
  }

  // Close queue connections (for graceful shutdown)
  async close(): Promise<void> {
    await this.queueEvents.close();
    await this.orderQueue.close();
    Logger.getInstance().info('Queue connections closed');
  }

  // Get the queue instance (for worker registration)
  getQueue(): Queue<ExecutionJob> {
    return this.orderQueue;
  }
}

// Export singleton instance
export const queueManager = QueueManager.getInstance();

// Export class for type definitions
export default QueueManager;
