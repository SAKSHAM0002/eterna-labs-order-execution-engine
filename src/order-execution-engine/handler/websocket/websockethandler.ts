// Order Execution WebSocket Handler - Handles WebSocket connections
// Delegates to OrderService and WebSocketService

import type { FastifyRequest } from 'fastify';
import { Logger } from '@/common/logger';
import { orderService, webSocketService } from '@/order-execution-engine/services';
import type { OrderRequest } from '@/order-execution-engine/model';

// WebSocket type (from ws library used by @fastify/websocket)
type WebSocket = any;

// Handle WebSocket order execution connection
// Delegates business logic to services
export async function handleOrderExecution(
  connection: any,
  request: FastifyRequest
): Promise<void> {
  Logger.getInstance().info('WebSocket connection received', {
    remoteAddress: request.ip,
  });

  // Extract WebSocket from connection
  const socket: WebSocket = connection.socket || connection.ws || connection;

  // Send welcome message
  webSocketService.sendMessage(socket, {
    type: 'success',
    message: 'Connected to Order Execution Engine',
    data: {
      supportedActions: ['execute', 'ping'],
      supportedStatuses: ['pending', 'routing', 'building', 'submitted', 'completed', 'failed'],
    },
    timestamp: new Date().toISOString(),
  });

  // Handle incoming messages
  socket.on('message', async (rawMessage: any) => {
    try {
      const messageText = rawMessage.toString();
      const messageData = JSON.parse(messageText);

      // Handle execute action
      if (messageData.action === 'execute') {
        const orderRequest: OrderRequest = messageData.order;

        try {
          // Delegate to OrderService - it handles validation and creation
          const createdOrder = await orderService.createOrder(orderRequest);

          Logger.getInstance().info('Order created via WebSocket', {
            orderId: createdOrder.id,
            tokenIn: createdOrder.tokenIn,
            tokenOut: createdOrder.tokenOut,
          });

          // Register WebSocket connection for this order
          webSocketService.registerConnection(createdOrder.id, socket);

          // Send initial status
          webSocketService.sendMessage(socket, {
            type: 'status',
            orderId: createdOrder.id,
            status: 'pending',
            data: {
              message: 'Order received and queued for execution',
              orderId: createdOrder.id,
            },
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          Logger.getInstance().error('Order creation failed via WebSocket', {
            error: error instanceof Error ? error.message : String(error),
          });

          webSocketService.sendMessage(socket, {
            type: 'error',
            message: error instanceof Error ? error.message : 'Order creation failed',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Handle ping action
      if (messageData.action === 'ping') {
        webSocketService.sendMessage(socket, {
          type: 'success',
          message: 'pong',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      Logger.getInstance().error('WebSocket message handling error', {
        error: error instanceof Error ? error.message : String(error),
      });

      webSocketService.sendMessage(socket, {
        type: 'error',
        message: 'Failed to process message',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Handle connection close
  socket.on('close', (code: number, reason: Buffer) => {
    Logger.getInstance().info('WebSocket connection closed', {
      remoteAddress: request.ip,
      code,
      reason: reason?.toString() || 'No reason provided',
    });

    // Clean up connections via service
    webSocketService.removeConnectionsBySocket(socket);
  });

  // Handle errors
  socket.on('error', (error: Error) => {
    Logger.getInstance().error('WebSocket error', {
      error: error.message,
    });
  });
}

// Send status update to WebSocket client for a specific order
// Called by queue workers - delegates to WebSocketService
export function sendOrderUpdate(orderId: string, status: string, data?: any): void {
  webSocketService.sendOrderUpdate(orderId, status, data);
}

// Export activeConnections for backward compatibility (deprecated - use webSocketService)
export const activeConnections = {
  set: (orderId: string, socket: WebSocket) => webSocketService.registerConnection(orderId, socket),
  get: (orderId: string) => undefined, // Not supported anymore
  delete: (orderId: string) => webSocketService.removeConnection(orderId),
  has: (orderId: string) => webSocketService.hasConnection(orderId),
};
