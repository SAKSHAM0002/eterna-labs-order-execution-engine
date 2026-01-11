// Fastify Server - HTTP server configuration with WebSocket support

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { Logger } from '@/common/logger';
import { env } from '@/order-execution-engine/config';
import { registerRoutes } from '@/order-execution-engine/routes';

// Create and configure Fastify server
export async function createServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false,
    requestIdLogLabel: 'requestId',
    disableRequestLogging: true,
    trustProxy: true,
  });

  // Register CORS
  await server.register(cors, {
    origin: '*',
    credentials: true,
  });

  // Register WebSocket support
  await server.register(websocket, {
    options: {
      maxPayload: 1048576,
      perMessageDeflate: false,
    },
  });

  // Request logging middleware
  server.addHook('onRequest', async (request) => {
    Logger.getInstance().info('Incoming request', {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  });

  // Response logging middleware
  server.addHook('onResponse', async (request, reply) => {
    Logger.getInstance().info('Response sent', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime(),
    });
  });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    Logger.getInstance().error('Request error', {
      error: error.message,
      method: request.method,
      url: request.url,
    });

    reply.status(error.statusCode || 500).send({
      success: false,
      error: error.message || 'Internal server error',
      statusCode: error.statusCode || 500,
    });
  });

  // Register routes
  await registerRoutes(server);

  return server;
}

// Start the server
export async function startServer(): Promise<FastifyInstance> {
  try {
    const server = await createServer();

    await server.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });

    Logger.getInstance().info('Server started successfully', {
      port: env.PORT,
      host: '0.0.0.0',
      environment: env.NODE_ENV,
    });

    return server;
  } catch (error) {
    Logger.getInstance().error('Failed to start server', { error });
    throw error;
  }
}

// Stop the server
export async function stopServer(server: FastifyInstance): Promise<void> {
  try {
    await server.close();
    Logger.getInstance().info('Server stopped successfully');
  } catch (error) {
    Logger.getInstance().error('Failed to stop server', { error });
    throw error;
  }
}
