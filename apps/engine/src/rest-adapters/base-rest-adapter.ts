import type { PriceData } from '@arbitrage/shared';

export interface RESTAdapterConfig {
    symbols: string[];
}

export abstract class BaseRESTAdapter {
    abstract readonly exchangeId: string;
    protected config: RESTAdapterConfig;

    constructor(config: RESTAdapterConfig) {
        this.config = config;
    }

    /**
     * Fetch current prices for all configured symbols.
     * Returns an array of PriceData with synchronized timestamps.
     */
    abstract fetchPrices(): Promise<PriceData[]>;

    /**
     * Helper to create PriceData with current timestamp
     */
    protected createPriceData(symbol: string, bid: number, ask: number): PriceData {
        return {
            exchange: this.exchangeId,
            symbol,
            bid,
            ask,
            timestamp: Date.now(),
        };
    }
}
