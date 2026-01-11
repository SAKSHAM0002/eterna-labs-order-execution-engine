// Services module - business logic layer
// Exports service classes and singleton instances

import { OrderService } from './orderservice';
import { DexService } from './dexservice';
import { ExecutionService } from './executionservice';
import { PostgresOrderRepository, PostgresOrderHistoryRepository } from '../repository';
import { raydiumGateway, meteoraGateway } from '../gateway/dex';

// Export classes
export { OrderService } from './orderservice';
export { DexService } from './dexservice';
export { ExecutionService } from './executionservice';
export { WebSocketService, webSocketService } from './websocketservice';

// Create singleton instances using getInstance() for repositories
const orderRepository = PostgresOrderRepository.getInstance();
const orderHistoryRepository = PostgresOrderHistoryRepository.getInstance();

// Export singleton service instances
export const orderService = new OrderService(orderRepository);
export const dexService = new DexService([raydiumGateway, meteoraGateway]);
export const executionService = new ExecutionService(orderService, dexService, [raydiumGateway, meteoraGateway]);
