// WebSocket Service - Manages WebSocket connections and real-time updates
// Handles connection lifecycle and message broadcasting

import { Logger } from '@/common/logger';

// WebSocket type (from ws library used by @fastify/websocket)
type WebSocket = any;

// WebSocket message structure
interface WebSocketMessage {
  type: 'status' | 'error' | 'success';
  orderId?: string;
  status?: string;
  data?: any;
  message?: string;
  timestamp: string;
}

// WebSocket service for managing connections and sending updates
export class WebSocketService {
  private static instance: WebSocketService;
  private connections: Map<string, WebSocket>;

  private constructor() {
    this.connections = new Map();
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  // Register a WebSocket connection for an order
  registerConnection(orderId: string, socket: WebSocket): void {
    this.connections.set(orderId, socket);
    Logger.getInstance().debug('WebSocket connection registered', { orderId });
  }

  // Remove a WebSocket connection
  removeConnection(orderId: string): void {
    this.connections.delete(orderId);
    Logger.getInstance().debug('WebSocket connection removed', { orderId });
  }

  // Remove all connections for a specific socket (on disconnect)
  removeConnectionsBySocket(socket: WebSocket): void {
    for (const [orderId, conn] of this.connections.entries()) {
      if (conn === socket) {
        this.connections.delete(orderId);
        Logger.getInstance().debug('WebSocket connection removed on disconnect', { orderId });
      }
    }
  }

  // Send status update to a specific order
  sendOrderUpdate(orderId: string, status: string, data?: any): void {
    const socket = this.connections.get(orderId);

    if (!socket || socket.readyState !== 1) {
      Logger.getInstance().debug('No active WebSocket connection for order', {
        orderId,
        status,
        hasSocket: !!socket,
        readyState: socket?.readyState,
      });
      return;
    }

    const message: WebSocketMessage = {
      type: 'status',
      orderId,
      status,
      data,
      timestamp: new Date().toISOString(),
    };

    try {
      socket.send(JSON.stringify(message));
      Logger.getInstance().debug('Sent order update via WebSocket', { orderId, status });
    } catch (error) {
      Logger.getInstance().error('Failed to send WebSocket update', {
        orderId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      // Clean up dead connection
      this.connections.delete(orderId);
    }
  }

  // Send a message to a socket
  sendMessage(socket: WebSocket, message: WebSocketMessage): void {
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify(message));
      Logger.getInstance().debug('WebSocket message sent', {
        type: message.type,
        status: message.status,
      });
    } else {
      Logger.getInstance().warn('Cannot send message - socket not open', {
        readyState: socket?.readyState,
        messageType: message.type,
      });
    }
  }

  // Get count of active connections
  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  // Check if an order has an active connection
  hasConnection(orderId: string): boolean {
    return this.connections.has(orderId);
  }
}

// Singleton instance export
export const webSocketService = WebSocketService.getInstance();
