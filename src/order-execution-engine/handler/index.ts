// Handler Module - Exports HTTP and WebSocket handlers
// Handlers handle incoming requests from EXTERNAL clients only

// HTTP Handlers - REST API endpoints
export {
  createOrderHandler,
  getOrderHandler,
  getAllOrdersHandler,
  cancelOrderHandler,
  getOrderCountHandler,
} from './http/orderhandler';

// WebSocket Handlers - Real-time connections
export { handleOrderExecution, sendOrderUpdate, activeConnections } from './websocket/websockethandler';

