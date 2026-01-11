// Order Execution Engine - Main entry point

import { Logger } from '@/common/logger';
import { env } from '@/order-execution-engine/config';
import { startServer, stopServer } from './server';
import { createWorker, stopWorker } from './queue';
import { initializeEventListeners } from '@/order-execution-engine/eventmanager';
import type { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';

// Global instances
let server: FastifyInstance;
let worker: Worker;

// Bootstrap application
async function bootstrap(): Promise<void> {
  try {

    Logger.getInstance().info('Starting Order Execution Engine...', {
      environment: env.NODE_ENV,
      port: env.PORT,
      host: '0.0.0.0',
    });

    // Initialize event listeners
    initializeEventListeners();

    // Start HTTP server
    server = await startServer();

    // Start BullMQ worker
    worker = createWorker();

    Logger.getInstance().info('Order Execution Engine started successfully', {
      server: `0.0.0.0:${env.PORT}`,
      worker: `1 worker with concurrency ${env.QUEUE_CONCURRENCY}`,
    });

    // Log available endpoints
    Logger.getInstance().info('Available endpoints', {
      health: `GET http://localhost:${env.PORT}/health`,
      createOrder: `POST http://localhost:${env.PORT}/api/orders`,
      getOrder: `GET http://localhost:${env.PORT}/api/orders/:orderId`,
      listOrders: `GET http://localhost:${env.PORT}/api/orders`,
      cancelOrder: `DELETE http://localhost:${env.PORT}/api/orders/:orderId`,
      orderCount: `GET http://localhost:${env.PORT}/api/orders/count`,
      websocket: `WS ws://localhost:${env.PORT}/api/orders/execute`,
    });
  } catch (error) {
    Logger.getInstance().error('Failed to bootstrap application', { error });
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  Logger.getInstance().info(`Received ${signal}, shutting down gracefully...`);

  try {
    if (worker) {
      await stopWorker(worker);
    }

    if (server) {
      await stopServer(server);
    }

    Logger.getInstance().info('Shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    Logger.getInstance().error('Error during shutdown', { error });
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  Logger.getInstance().error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  Logger.getInstance().error('Unhandled rejection', { reason });
  process.exit(1);
});

// Start application
bootstrap();
