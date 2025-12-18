import { BaseRESTAdapter, type RESTAdapterConfig } from './base-rest-adapter.js';
import type { PriceData } from '@arbitrage/shared';
import { normalizeSymbol } from '@arbitrage/shared';

interface OrderbookResponse {
    product_id: number;
    ticker_id: string;
    bids: Array<[number, number]>; // [price, qty]
    asks: Array<[number, number]>; // [price, qty]
    timestamp: number;
}

/**
 * Nado REST Adapter (v2 API)
 * 
 * Uses GET https://gateway.prod.nado.xyz/v2/orderbook?ticker_id={ticker_id}&depth=5
 * 
 * Response: { bids: [[88470.0, 0.4827], ...], asks: [[88471.0, 1.619], ...] }
 */
export class NadoRESTAdapter extends BaseRESTAdapter {
    readonly exchangeId = 'nado';
    private readonly apiUrl = 'https://gateway.prod.nado.xyz/v2/orderbook';

    // Ticker ID to Symbol mapping
    private readonly tickers: Array<{ ticker_id: string; symbol: string }> = [
        { ticker_id: 'BTC-PERP_USDT0', symbol: 'BTC' },
        { ticker_id: 'ETH-PERP_USDT0', symbol: 'ETH' },
        { ticker_id: 'SOL-PERP_USDT0', symbol: 'SOL' },
        { ticker_id: 'XRP-PERP_USDT0', symbol: 'XRP' },
        { ticker_id: 'BNB-PERP_USDT0', symbol: 'BNB' },
        { ticker_id: 'HYPE-PERP_USDT0', symbol: 'HYPE' },
        { ticker_id: 'FARTCOIN-PERP_USDT0', symbol: 'FARTCOIN' },
    ];

    constructor(config?: Partial<RESTAdapterConfig>) {
        super({ symbols: config?.symbols || [] });
    }

    async fetchPrices(): Promise<PriceData[]> {
        const prices: PriceData[] = [];

        const fetchPromises = this.tickers.map(async ({ ticker_id, symbol }, i) => {
            await new Promise(resolve => setTimeout(resolve, i * 50));

            try {
                const response = await fetch(`${this.apiUrl}?ticker_id=${ticker_id}&depth=5`);

                if (!response.ok) {
                    if (response.status !== 404) {
                        console.error(`[${this.exchangeId}] REST error for ${symbol}: ${response.status}`);
                    }
                    return null;
                }

                const data: OrderbookResponse = await response.json();

                if (data.bids?.length > 0 && data.asks?.length > 0) {
                    const bestBid = data.bids[0][0];
                    const bestAsk = data.asks[0][0];

                    if (bestBid > 0 && bestAsk > 0) {
                        return this.createPriceData(normalizeSymbol(symbol), bestBid, bestAsk);
                    }
                }
            } catch (error) {
                console.error(`[${this.exchangeId}] REST fetch error for ${symbol}:`, error);
            }
            return null;
        });

        const results = await Promise.all(fetchPromises);
        for (const result of results) {
            if (result) prices.push(result);
        }

        console.log(`[${this.exchangeId}] REST fetched ${prices.length}/${this.tickers.length} prices`);
        return prices;
    }
}
