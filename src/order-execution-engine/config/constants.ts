// Application constants - centralized configuration values that don't change at runtime

// Queue names
export const QUEUE_NAMES = {
  ORDER_EXECUTION: 'order-execution',
} as const;

// Order configuration
export const ORDER_DEFAULTS = {
  SLIPPAGE_TOLERANCE: 1.0,        // 1% default slippage
  MAX_RETRIES: 3,                 // Maximum retry attempts
  RETRY_DELAY: 5000,              // 5 seconds between retries (ms)
  RETRY_BACKOFF_MULTIPLIER: 2,    // Exponential backoff multiplier
} as const;

// Quote configuration
export const QUOTE_CONFIG = {
  EXPIRATION_TIME: 30000,         // Quotes expire after 30 seconds (ms)
  FETCH_TIMEOUT: 5000,            // Timeout for DEX API calls (ms)
  MIN_LIQUIDITY: 1000,            // Minimum pool liquidity to consider
} as const;

// DEX names (supported exchanges)
export const DEX_NAMES = {
  RAYDIUM: 'raydium',
  METEORA: 'meteora',
} as const;

// Transaction configuration
export const TRANSACTION_CONFIG = {
  CONFIRMATION_TIMEOUT: 60000,    // 60 seconds max wait for confirmation
  MAX_CONFIRMATIONS: 32,          // Solana finality confirmations
  POLLING_INTERVAL: 1000,         // Check confirmation every 1 second
} as const;

// API configuration
export const API_CONFIG = {
  RATE_LIMIT_MAX: 100,            // Max requests per window
  RATE_LIMIT_WINDOW: 60000,       // Rate limit window (1 minute)
  REQUEST_TIMEOUT: 30000,         // 30 seconds max request time
  MAX_PAYLOAD_SIZE: '10mb',       // Maximum request body size
} as const;

// WebSocket configuration
export const WEBSOCKET_CONFIG = {
  HEARTBEAT_INTERVAL: 30000,      // Send ping every 30 seconds
  CONNECTION_TIMEOUT: 5000,       // Connection timeout
  MAX_PAYLOAD: 100000,            // Max WebSocket message size
} as const;

// Database configuration
export const DATABASE_CONFIG = {
  QUERY_TIMEOUT: 10000,           // 10 seconds max query time
  CONNECTION_TIMEOUT: 5000,       // 5 seconds connection timeout
  STATEMENT_TIMEOUT: 30000,       // 30 seconds statement timeout
} as const;

// Logging configuration
export const LOG_CONFIG = {
  MAX_FILE_SIZE: 10485760,        // 10MB max log file size
  MAX_FILES: 5,                   // Keep 5 log files
  DATE_FORMAT: 'YYYY-MM-DD HH:mm:ss',
} as const;

// Event names (domain events)
export const EVENT_NAMES = {
  // Order events
  ORDER_CREATED: 'order:created',
  ORDER_STATUS_CHANGED: 'order:status-changed',
  ORDER_FAILED: 'order:failed',
  ORDER_CONFIRMED: 'order:confirmed',

  // Execution events
  EXECUTION_STARTED: 'execution:started',
  EXECUTION_QUOTES_FETCHED: 'execution:quotes-fetched',
  EXECUTION_DEX_SELECTED: 'execution:dex-selected',
  EXECUTION_SWAP_SUBMITTED: 'execution:swap-submitted',
  EXECUTION_SWAP_CONFIRMED: 'execution:swap-confirmed',
  EXECUTION_FAILED: 'execution:failed',
  EXECUTION_RETRYING: 'execution:retrying',

  // Routing events
  ROUTING_STARTED: 'routing:started',
  ROUTING_COMPLETED: 'routing:completed',

  // System events
  SYSTEM_ERROR: 'system:error',
  QUEUE_JOB_ADDED: 'queue:job-added',
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error codes (application-specific)
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  DEX_UNAVAILABLE: 'DEX_UNAVAILABLE',
  INSUFFICIENT_LIQUIDITY: 'INSUFFICIENT_LIQUIDITY',
  SLIPPAGE_EXCEEDED: 'SLIPPAGE_EXCEEDED',
  SWAP_FAILED: 'SWAP_FAILED',
  TRANSACTION_TIMEOUT: 'TRANSACTION_TIMEOUT',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Type exports for constants
export type DexName = typeof DEX_NAMES[keyof typeof DEX_NAMES];
export type EventName = typeof EVENT_NAMES[keyof typeof EVENT_NAMES];
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
