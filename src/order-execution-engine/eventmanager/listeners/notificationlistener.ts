// Notification Event Listener - Listens to all events and broadcasts updates to connected WebSocket clients
// Enables real-time order status updates in the UI

import { eventEmitter } from '../emitter';
import { Logger } from '@/common/logger';
import { EVENT_NAMES } from '@/order-execution-engine/config';
import type { DomainEvent } from '@/order-execution-engine/model';

// WebSocket Notification Payload
interface WebSocketNotification {
  type: string;
  orderId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

// Notification Event Listener - Singleton that broadcasts events to WebSocket clients
class NotificationEventListener {
  private static instance: NotificationEventListener;
  private isRegistered = false;
  private connectedClients: Set<string> = new Set(); // TODO: Replace with actual WebSocket connections

  private constructor() {}

  // Get singleton instance
  static getInstance(): NotificationEventListener {
    if (!NotificationEventListener.instance) {
      NotificationEventListener.instance = new NotificationEventListener();
    }
    return NotificationEventListener.instance;
  }

  // Register notification event listeners
  register(): void {
    if (this.isRegistered) {
      Logger.getInstance().warn('Notification event listener already registered');
      return;
    }

    // Listen to all order lifecycle events
    eventEmitter.on(EVENT_NAMES.ORDER_CREATED, async (domainEvent) => {
      await this.broadcastEvent(domainEvent);
    });

    eventEmitter.on(EVENT_NAMES.ORDER_STATUS_CHANGED, async (domainEvent) => {
      await this.broadcastEvent(domainEvent);
    });

    eventEmitter.on(EVENT_NAMES.ORDER_FAILED, async (domainEvent) => {
      await this.broadcastEvent(domainEvent);
    });

    eventEmitter.on(EVENT_NAMES.ORDER_CONFIRMED, async (domainEvent) => {
      await this.broadcastEvent(domainEvent);
    });

    // Listen to execution events
    eventEmitter.on(EVENT_NAMES.EXECUTION_STARTED, async (domainEvent) => {
      await this.broadcastEvent(domainEvent);
    });

    eventEmitter.on(EVENT_NAMES.EXECUTION_QUOTES_FETCHED, async (domainEvent) => {
      await this.broadcastEvent(domainEvent);
    });

    eventEmitter.on(EVENT_NAMES.EXECUTION_DEX_SELECTED, async (domainEvent) => {
      await this.broadcastEvent(domainEvent);
    });

    eventEmitter.on(EVENT_NAMES.EXECUTION_SWAP_SUBMITTED, async (domainEvent) => {
      await this.broadcastEvent(domainEvent);
    });

    eventEmitter.on(EVENT_NAMES.EXECUTION_SWAP_CONFIRMED, async (domainEvent) => {
      await this.broadcastEvent(domainEvent);
    });

    eventEmitter.on(EVENT_NAMES.EXECUTION_FAILED, async (domainEvent) => {
      await this.broadcastEvent(domainEvent);
    });

    eventEmitter.on(EVENT_NAMES.EXECUTION_RETRYING, async (domainEvent) => {
      await this.broadcastEvent(domainEvent);
    });

    this.isRegistered = true;
    Logger.getInstance().info('Notification event listener registered');
  }

  // Broadcast event to all connected WebSocket clients
  private async broadcastEvent(domainEvent: DomainEvent): Promise<void> {
    try {
      const notification: WebSocketNotification = {
        type: domainEvent.type,
        orderId: domainEvent.aggregateId,
        timestamp: domainEvent.timestamp,
        data: (domainEvent as any).data || {},
      };

      Logger.getInstance().debug('Broadcasting event to WebSocket clients', {
        type: notification.type,
        orderId: notification.orderId,
        clientCount: this.connectedClients.size,
      });

      // TODO: Implement actual WebSocket broadcast
      // For now, just log
      if (this.connectedClients.size > 0) {
        Logger.getInstance().info('Event broadcast (mock)', {
          type: notification.type,
          orderId: notification.orderId,
        });
      }

    } catch (error) {
      Logger.getInstance().error('Failed to broadcast event', {
        error: error instanceof Error ? error.message : String(error),
        eventType: domainEvent.type,
        aggregateId: domainEvent.aggregateId,
      });
    }
  }

  // Register a WebSocket client (for testing)
  addClient(clientId: string): void {
    this.connectedClients.add(clientId);
    Logger.getInstance().debug('WebSocket client added', { clientId, totalClients: this.connectedClients.size });
  }

  // Unregister a WebSocket client (for testing)
  removeClient(clientId: string): void {
    this.connectedClients.delete(clientId);
    Logger.getInstance().debug('WebSocket client removed', { clientId, totalClients: this.connectedClients.size });
  }

  // Get connected client count (for monitoring)
  getClientCount(): number {
    return this.connectedClients.size;
  }

  // Unregister all listeners (for testing/shutdown)
  unregister(): void {
    eventEmitter.off(EVENT_NAMES.ORDER_CREATED, this.broadcastEvent);
    eventEmitter.off(EVENT_NAMES.ORDER_STATUS_CHANGED, this.broadcastEvent);
    eventEmitter.off(EVENT_NAMES.ORDER_FAILED, this.broadcastEvent);
    eventEmitter.off(EVENT_NAMES.ORDER_CONFIRMED, this.broadcastEvent);
    eventEmitter.off(EVENT_NAMES.EXECUTION_STARTED, this.broadcastEvent);
    eventEmitter.off(EVENT_NAMES.EXECUTION_QUOTES_FETCHED, this.broadcastEvent);
    eventEmitter.off(EVENT_NAMES.EXECUTION_DEX_SELECTED, this.broadcastEvent);
    eventEmitter.off(EVENT_NAMES.EXECUTION_SWAP_SUBMITTED, this.broadcastEvent);
    eventEmitter.off(EVENT_NAMES.EXECUTION_SWAP_CONFIRMED, this.broadcastEvent);
    eventEmitter.off(EVENT_NAMES.EXECUTION_FAILED, this.broadcastEvent);
    eventEmitter.off(EVENT_NAMES.EXECUTION_RETRYING, this.broadcastEvent);
    this.isRegistered = false;
    Logger.getInstance().info('Notification event listener unregistered');
  }
}

// Export singleton instance
export const notificationListener = NotificationEventListener.getInstance();
