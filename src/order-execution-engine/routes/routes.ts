// Routes Module - Registers all API endpoints with Fastify server
// Maps HTTP/WebSocket routes to their respective handlers

import type { FastifyInstance } from 'fastify';
import { Logger } from '@/common/logger';
import {
  createOrderHandler,
  getOrderHandler,
  getAllOrdersHandler,
  cancelOrderHandler,
  getOrderCountHandler,
  handleOrderExecution,
} from '@/order-execution-engine/handler';

// Register all routes on the Fastify server
export async function registerRoutes(server: FastifyInstance): Promise<void> {
  Logger.getInstance().info('Registering routes');

  // ===== Health Check =====
  server.get('/health', async (request, reply) => {
    return {
      success: true,
      message: 'Order Execution Engine is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // ===== Order Routes =====
  
  // Create new order
  server.post('/api/orders', createOrderHandler);

  // Get order by ID
  server.get('/api/orders/:orderId', getOrderHandler);

  // Get all orders (with optional filters)
  server.get('/api/orders', getAllOrdersHandler);

  // Cancel order
  server.delete('/api/orders/:orderId', cancelOrderHandler);

  // Get order count (with optional status filter)
  server.get('/api/orders/count', getOrderCountHandler);

  // ===== WebSocket Routes =====

  // WebSocket endpoint for real-time order execution
  // Client workflow:
  // 1. Connect via WebSocket to ws://localhost:3000/api/orders/execute
  // 2. Send: { action: 'execute', order: { tokenIn, tokenOut, amount, slippageTolerance } }
  // 3. Receive orderId confirmation
  // 4. Receive real-time status updates: pending → routing → building → submitted → confirmed/failed
  // Note: Requires @fastify/websocket plugin to be registered on server before this route
  // @ts-ignore - WebSocket option added by @fastify/websocket plugin
  server.get('/api/orders/execute', { websocket: true }, handleOrderExecution);

  Logger.getInstance().info('All routes registered successfully', {
    orderRoutes: 5,
    websocketRoutes: 1,
  });
}
