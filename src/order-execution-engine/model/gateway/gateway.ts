// DEX gateway interface - contract for DEX implementations

import type { DexQuote, DexGatewayConfig, SwapTransaction } from './api';

// DEX gateway interface - each DEX implements this
export interface DexGateway {
  readonly name: string;
  readonly config: DexGatewayConfig;
  
  // Get a quote for a token swap
  getQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: number,
    slippageTolerance: number
  ): Promise<DexQuote>;
  
  // Execute a swap transaction
  executeSwap(
    quote: DexQuote,
    walletAddress: string
  ): Promise<SwapTransaction>;
  
  // Check transaction status
  getTransactionStatus(signature: string): Promise<SwapTransaction>;
  
  // Health check for the gateway
  healthCheck(): Promise<boolean>;
  
  // Get supported token pairs
  getSupportedPairs(): Promise<Array<{ tokenIn: string; tokenOut: string }>>;
}
