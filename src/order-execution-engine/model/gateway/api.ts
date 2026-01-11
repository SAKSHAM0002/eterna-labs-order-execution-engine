// RPC request and response structures for DEX gateway interactions

// DEX quote with route information
export interface DexQuote {
  dexName: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  pricePerToken: number;
  priceImpact: number;
  minimumAmountOut: number;
  estimatedFee: number;
  route: DexRoute;
  timestamp: Date;
  expiresIn: number;
}

// Route information for multi-hop swaps
export interface DexRoute {
  poolAddresses: string[];
  tokenPath: string[];
  poolTypes: string[];
  description: string;
}

// Swap transaction result
export interface SwapTransaction {
  signature: string;
  dexName: string;
  tokenIn: string;
  amountIn: number;
  tokenOut: string;
  amountOut: number;
  executionPrice: number;
  transactionFee: number;
  executedAt: Date;
  blockNumber?: number;
  status: 'pending' | 'completed' | 'failed';
}

// Gateway configuration
export interface DexGatewayConfig {
  rpcEndpoint: string;
  apiKey?: string;
  timeout: number;
  maxRetries: number;
  enabled: boolean;
}
