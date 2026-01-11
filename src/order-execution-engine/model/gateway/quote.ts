// Quote comparison logic - selecting best DEX quote

import type { DexQuote } from './api';

// Quote comparison result - best quote among multiple DEXs
export interface QuoteComparison {
  bestQuote: DexQuote;
  allQuotes: DexQuote[];
  savings: {
    dex: string;
    amountDifference: number;
    percentageDifference: number;
  };
}

// Quote request parameters
export interface QuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippageTolerance?: number;
}

// Quote response from DEX
export interface QuoteResponse {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  priceImpact: number;
  fee?: number;
  minAmountOut?: number;
  routePath?: string[];
  error?: string;
}

// Re-export DexQuote from api.ts for convenience
export type { DexQuote } from './api';
