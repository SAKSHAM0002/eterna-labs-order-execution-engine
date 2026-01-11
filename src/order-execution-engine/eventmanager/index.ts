// Event System Module - Exports all event-related components

import { orderListener as orderListenerInstance } from './listeners/orderlistener';
import { executionListener as executionListenerInstance } from './listeners/executionlistener';
import { notificationListener as notificationListenerInstance } from './listeners/notificationlistener';

export { eventEmitter, DomainEventEmitter } from './emitter';
export { orderListener } from './listeners/orderlistener';
export { executionListener } from './listeners/executionlistener';
export { notificationListener } from './listeners/notificationlistener';

// Initialize all event listeners - Call this during application startup
export function initializeEventListeners(): void {
  orderListenerInstance.register();
  executionListenerInstance.register();
  notificationListenerInstance.register();
}

// Shutdown all event listeners - Call this during application shutdown
export function shutdownEventListeners(): void {
  orderListenerInstance.unregister();
  executionListenerInstance.unregister();
  notificationListenerInstance.unregister();
}
