// Environment configuration - loads and validates environment variables with type safety
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from order-execution-engine directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Environment variable schema - validates all required environment variables at startup
const EnvironmentSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1000).max(65535).default(3000),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Database configuration (PostgreSQL)
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('order_execution'),
  DB_SSL: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean()
  ).default(false),
  DB_POOL_MIN: z.coerce.number().int().default(2),
  DB_POOL_MAX: z.coerce.number().int().default(10),

  // Redis configuration (BullMQ)
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  // Queue configuration
  QUEUE_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(10),
  QUEUE_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),

  // DEX configuration
  DEX_RAYDIUM_API_URL: z.string().url().optional().default('https://api.raydium.io'),
  DEX_METEORA_API_URL: z.string().url().optional().default('https://api.meteora.io'),

  // Solana configuration
  SOLANA_RPC_URL: z.string().url().default('https://api.mainnet-beta.solana.com'),
  SOLANA_WALLET_ADDRESS: z.string().optional(),

  // WebSocket configuration
  WS_HEARTBEAT_INTERVAL: z.coerce.number().int().default(30000),

  // Feature flags
  ENABLE_MOCK_DEX: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean()
  ).default(true),
  ENABLE_MOCK_SOLANA: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean()
  ).default(true),
});

// Validated environment type - inferred from schema for type safety
export type Environment = z.infer<typeof EnvironmentSchema>;

// Parse and validate environment variables - throws error if validation fails (fail-fast on startup)
function loadEnvironment(): Environment {
  try {
    const validatedEnvironment = EnvironmentSchema.parse(process.env);
    return validatedEnvironment;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(' Environment validation failed:');
      error.issues.forEach((validationError) => {
        console.error(`  - ${validationError.path.join('.')}: ${validationError.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

// Singleton: validated environment configuration - export as constant for immutability
export const env = loadEnvironment();

// Helper: check if running in production
export const isProduction = env.NODE_ENV === 'production';

// Helper: check if running in development
export const isDevelopment = env.NODE_ENV === 'development';

// Helper: check if running in test
export const isTest = env.NODE_ENV === 'test';

// Helper: database connection string
export const getDatabaseUrl = (): string => {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = env;
  return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
};

// Helper: redis connection options
export const getRedisConfig = () => ({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
});
