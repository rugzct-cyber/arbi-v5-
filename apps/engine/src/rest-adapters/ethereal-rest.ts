import { BaseRESTAdapter, type RESTAdapterConfig } from './base-rest-adapter.js';
import type { PriceData } from '@arbitrage/shared';
import { normalizeSymbol } from '@arbitrage/shared';

interface EtherealProduct {
    id: string;
    ticker: string;
    displayTicker: string;
    baseTokenName: string;
}

interface MarketPriceData {
    productId: string;
    bestBidPrice: string;
    bestAskPrice: string;
}

interface MarketPriceResponse {
    data: MarketPriceData[];
}

/**
 * Ethereal REST Adapter
 * 
 * Uses:
 * - GET https://api.ethereal.trade/v1/product to get product IDs
 * - GET https://api.ethereal.trade/v1/product/market-price?productIds={ids} for bid/ask
 * 
 * Response: { data: [{ bestBidPrice, bestAskPrice }] }
 */
export class EtherealRESTAdapter extends BaseRESTAdapter {
    readonly exchangeId = 'ethereal';
    private readonly apiUrl = 'https://api.ethereal.trade/v1';
    private products: Map<string, string> = new Map(); // productId -> symbol

    constructor(config?: Partial<RESTAdapterConfig>) {
        super({ symbols: config?.symbols || [] });
    }

    async fetchPrices(): Promise<PriceData[]> {
        const prices: PriceData[] = [];

        // First fetch products if not cached
        if (this.products.size === 0) {
            await this.fetchProducts();
        }

        if (this.products.size === 0) {
            console.log(`[${this.exchangeId}] No products available`);
            return prices;
        }

        try {
            // Fetch all market prices in one request
            const productIds = Array.from(this.products.keys()).join(',');
            const response = await fetch(`${this.apiUrl}/product/market-price?productIds=${productIds}`);

            if (!response.ok) {
                console.error(`[${this.exchangeId}] REST error: ${response.status}`);
                return prices;
            }

            const data: MarketPriceResponse = await response.json();

            for (const market of data.data) {
                const symbol = this.products.get(market.productId);
                if (!symbol) continue;

                const bestBid = parseFloat(market.bestBidPrice);
                const bestAsk = parseFloat(market.bestAskPrice);

                if (bestBid > 0 && bestAsk > 0) {
                    prices.push(this.createPriceData(symbol, bestBid, bestAsk));
                }
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] REST fetch error:`, error);
        }

        console.log(`[${this.exchangeId}] REST fetched ${prices.length}/${this.products.size} prices`);
        return prices;
    }

    private async fetchProducts(): Promise<void> {
        try {
            const response = await fetch(`${this.apiUrl}/product`);
            const result = await response.json() as { data: EtherealProduct[] };

            if (result.data && Array.isArray(result.data)) {
                for (const product of result.data) {
                    // Use baseTokenName (e.g., "BTC", "ETH")
                    const symbol = product.baseTokenName;
                    this.products.set(product.id, normalizeSymbol(symbol));
                }
            }
            console.log(`[${this.exchangeId}] Loaded ${this.products.size} products`);
        } catch (error) {
            console.error(`[${this.exchangeId}] Failed to fetch products:`, error);
        }
    }
}
