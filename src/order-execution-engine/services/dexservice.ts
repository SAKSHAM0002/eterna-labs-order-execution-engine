// DEX service - business logic for fetching quotes from multiple DEXs and selecting best route
import { Logger } from '@/common/logger';
import { ServiceUnavailableError } from '@/common/errors/errors';
import type { DexGateway, DexQuote } from '@/order-execution-engine/model';

// Best quote result - includes comparison data
export interface BestQuoteResult {
  quote: DexQuote;
  dexName: string;
  allQuotes: DexQuote[];
  comparisonData: {
    dexName: string;
    amountOut: number;
    pricePerToken: number;
    priceImpact: number;
    estimatedFee: number;
    isHealthy: boolean;
  }[];
}

export class DexService {
  private readonly dexGateways: DexGateway[];

  constructor(gateways: DexGateway[]) {
    this.dexGateways = gateways;
  }

  // Get quotes from all available DEXs - fetches in parallel for best performance
  async getAllQuotes(
    tokenIn: string,
    tokenOut: string,
    amountIn: number,
    slippageTolerance: number
  ): Promise<DexQuote[]> {
    Logger.getInstance().info('Fetching quotes from all DEXs', {
      tokenIn,
      tokenOut,
      amountIn,
      slippageTolerance,
      dexCount: this.dexGateways.length,
    });

    // Filter enabled gateways
    const enabledGateways = this.dexGateways.filter((gateway) => gateway.config.enabled);

    if (enabledGateways.length === 0) {
      Logger.getInstance().warn('No enabled DEX gateways available');
      return [];
    }

    // Fetch quotes in parallel
    const quotePromises = enabledGateways.map(async (gateway) => {
      try {
        const quote = await gateway.getQuote(tokenIn, tokenOut, amountIn, slippageTolerance);
        Logger.getInstance().debug('Quote received', {
          dex: gateway.name,
          amountOut: quote.amountOut,
          pricePerToken: quote.pricePerToken,
        });
        return quote;
      } catch (error) {
        Logger.getInstance().error(`Failed to get quote from ${gateway.name}`, {
          dex: gateway.name,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    });

    const quoteResults = await Promise.all(quotePromises);

    // Filter out failed quotes
    const successfulQuotes = quoteResults.filter((quote): quote is DexQuote => quote !== null);

    Logger.getInstance().info('Quotes fetched successfully', {
      total: enabledGateways.length,
      successful: successfulQuotes.length,
      failed: enabledGateways.length - successfulQuotes.length,
    });

    return successfulQuotes;
  }

  // Get best quote from all DEXs - selects based on highest amountOut (best price for user)
  async getBestQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: number,
    slippageTolerance: number
  ): Promise<BestQuoteResult> {
    Logger.getInstance().info('Finding best quote across DEXs', {
      tokenIn,
      tokenOut,
      amountIn,
      slippageTolerance,
    });

    // Get all quotes
    const allQuotes = await this.getAllQuotes(tokenIn, tokenOut, amountIn, slippageTolerance);

    if (allQuotes.length === 0) {
      Logger.getInstance().warn('No quotes available from any DEX');
      throw new ServiceUnavailableError('DEX Quotes', 'Unable to fetch quotes from any DEX', {
        tokenIn,
        tokenOut,
        amountIn,
      });
    }

    // Get health status for all gateways (in parallel)
    const healthChecks = await this.checkAllGatewaysHealth();

    // Sort quotes by amountOut (descending) - best quote first
    const sortedQuotes = [...allQuotes].sort((quoteA, quoteB) => quoteB.amountOut - quoteA.amountOut);

    const bestQuote = sortedQuotes[0];

    Logger.getInstance().info('Best quote selected', {
      dex: bestQuote.dexName,
      amountOut: bestQuote.amountOut,
      pricePerToken: bestQuote.pricePerToken,
      priceImpact: bestQuote.priceImpact,
      savings: sortedQuotes.length > 1
        ? `${((bestQuote.amountOut - sortedQuotes[sortedQuotes.length - 1].amountOut) / sortedQuotes[sortedQuotes.length - 1].amountOut * 100).toFixed(2)}%`
        : 'N/A',
    });

    // Build comparison data
    const comparisonData = allQuotes.map((quote) => ({
      dexName: quote.dexName,
      amountOut: quote.amountOut,
      pricePerToken: quote.pricePerToken,
      priceImpact: quote.priceImpact,
      estimatedFee: quote.estimatedFee,
      isHealthy: healthChecks[quote.dexName] || false,
    }));

    return {
      quote: bestQuote,
      dexName: bestQuote.dexName,
      allQuotes: sortedQuotes,
      comparisonData,
    };
  }

  // Get quote from specific DEX
  async getQuoteFromDex(
    dexName: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: number,
    slippageTolerance: number
  ): Promise<DexQuote | null> {
    Logger.getInstance().info('Fetching quote from specific DEX', {
      dex: dexName,
      tokenIn,
      tokenOut,
      amountIn,
    });

    const gateway = this.dexGateways.find((dexGateway) => dexGateway.name === dexName);

    if (!gateway) {
      Logger.getInstance().warn('DEX gateway not found', { dex: dexName });
      return null;
    }

    if (!gateway.config.enabled) {
      Logger.getInstance().warn('DEX gateway is disabled', { dex: dexName });
      return null;
    }

    try {
      const quote = await gateway.getQuote(tokenIn, tokenOut, amountIn, slippageTolerance);

      Logger.getInstance().info('Quote received from specific DEX', {
        dex: dexName,
        amountOut: quote.amountOut,
      });

      return quote;
    } catch (error) {
      Logger.getInstance().error(`Failed to get quote from ${dexName}`, {
        dex: dexName,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // Check health of all DEX gateways
  async checkAllGatewaysHealth(): Promise<Record<string, boolean>> {
    Logger.getInstance().debug('Checking health of all DEX gateways');

    const healthCheckPromises = this.dexGateways.map(async (gateway) => {
      try {
        const isHealthy = await gateway.healthCheck();
        return { dex: gateway.name, isHealthy };
      } catch (error) {
        Logger.getInstance().error(`Health check failed for ${gateway.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        return { dex: gateway.name, isHealthy: false };
      }
    });

    const healthResults = await Promise.all(healthCheckPromises);

    const healthMap = healthResults.reduce((accumulator, result) => {
      accumulator[result.dex] = result.isHealthy;
      return accumulator;
    }, {} as Record<string, boolean>);

    Logger.getInstance().debug('Gateway health check completed', { health: healthMap });

    return healthMap;
  }

  // Get supported token pairs from all DEXs
  async getAllSupportedPairs(): Promise<Record<string, Array<{ tokenIn: string; tokenOut: string }>>> {
    Logger.getInstance().debug('Fetching supported pairs from all DEXs');

    const pairPromises = this.dexGateways.map(async (gateway) => {
      try {
        const pairs = await gateway.getSupportedPairs();
        return { dex: gateway.name, pairs };
      } catch (error) {
        Logger.getInstance().error(`Failed to get supported pairs from ${gateway.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        return { dex: gateway.name, pairs: [] };
      }
    });

    const pairResults = await Promise.all(pairPromises);

    const pairMap = pairResults.reduce((accumulator, result) => {
      accumulator[result.dex] = result.pairs;
      return accumulator;
    }, {} as Record<string, Array<{ tokenIn: string; tokenOut: string }>>);

    Logger.getInstance().debug('Supported pairs fetched', {
      dexCount: Object.keys(pairMap).length,
    });

    return pairMap;
  }

  // Get list of available DEX names
  getAvailableDexNames(): string[] {
    return this.dexGateways.map((gateway) => gateway.name);
  }

  // Get list of enabled DEX names
  getEnabledDexNames(): string[] {
    return this.dexGateways
      .filter((gateway) => gateway.config.enabled)
      .map((gateway) => gateway.name);
  }
}
