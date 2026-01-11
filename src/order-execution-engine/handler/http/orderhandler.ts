// Order HTTP Handler - Handles HTTP requests for order management
// Thin layer that delegates to OrderService

import type { FastifyRequest, FastifyReply } from 'fastify';
import { Logger } from '@/common/logger';
import { orderService } from '@/order-execution-engine/services';
import { handleHttpError } from './error';
import type { OrderRequest } from '@/order-execution-engine/model';

// Create new order - POST /api/orders
export async function createOrderHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    Logger.getInstance().info('Create order request received');

    // Extract request data
    const orderRequest = request.body as OrderRequest;

    // Delegate to service - service handles ALL validation
    const createdOrder = await orderService.createOrder(orderRequest);

    Logger.getInstance().info('Order created successfully', { orderId: createdOrder.id });

    // Format response
    reply.code(201).send({
      success: true,
      data: createdOrder,
    });
  } catch (error) {
    handleHttpError(error, reply);
  }
}

// Get order by ID - GET /api/orders/:orderId
export async function getOrderHandler(
  request: FastifyRequest<{ Params: { orderId: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract request data
    const { orderId } = request.params;

    Logger.getInstance().debug('Get order request', { orderId });

    // Delegate to service
    const order = await orderService.getOrderById(orderId);

    // Format response
    reply.code(200).send({
      success: true,
      data: order,
    });
  } catch (error) {
    handleHttpError(error, reply);
  }
}

// Get all orders with filtering - GET /api/orders
export async function getAllOrdersHandler(
  request: FastifyRequest<{
    Querystring: {
      status?: string;
      tokenIn?: string;
      tokenOut?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract query parameters
    const { status, tokenIn, tokenOut, limit, offset } = request.query;

    Logger.getInstance().debug('Get all orders request');

    // Delegate to service
    const orders = await orderService.getAllOrders({
      status: status as any,
      tokenIn,
      tokenOut,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    // Format response
    reply.code(200).send({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    handleHttpError(error, reply);
  }
}

// Cancel order - DELETE /api/orders/:orderId
export async function cancelOrderHandler(
  request: FastifyRequest<{ Params: { orderId: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract request data
    const { orderId } = request.params;

    Logger.getInstance().info('Cancel order request', { orderId });

    // Delegate to service
    const cancelledOrder = await orderService.cancelOrder(orderId, 'Cancelled via API');

    // Format response
    reply.code(200).send({
      success: true,
      data: cancelledOrder,
      message: 'Order cancelled successfully',
    });
  } catch (error) {
    handleHttpError(error, reply);
  }
}

// Get order count - GET /api/orders/count
export async function getOrderCountHandler(
  request: FastifyRequest<{
    Querystring: {
      status?: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract query parameters
    const { status } = request.query;

    // Delegate to service
    const count = await orderService.getOrderCount({ status: status as any });

    // Format response
    reply.code(200).send({
      success: true,
      data: { count },
    });
  } catch (error) {
    handleHttpError(error, reply);
  }
}
