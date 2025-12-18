import { BaseRESTAdapter, type RESTAdapterConfig } from './base-rest-adapter.js';
import type { PriceData } from '@arbitrage/shared';
import { normalizeSymbol } from '@arbitrage/shared';

interface OrderBookResponse {
    code: number;
    bids: Array<{ price: string; remaining_base_amount: string }>;
    asks: Array<{ price: string; remaining_base_amount: string }>;
}

/**
 * Lighter (zkLighter) REST Adapter
 * 
 * Uses GET https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders?market_id={id}&limit=5
 * 
 * Response: { bids: [{ price: "88556.3", ... }], asks: [{ price: "88556.4", ... }] }
 */
export class LighterRESTAdapter extends BaseRESTAdapter {
    readonly exchangeId = 'lighter';
    private readonly apiUrl = 'https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders';

    // Market ID to symbol mapping (from WebSocket adapter)
    private readonly markets: Array<{ id: number; symbol: string }> = [
        { id: 0, symbol: 'ETH' }, { id: 1, symbol: 'BTC' }, { id: 2, symbol: 'SOL' },
        { id: 3, symbol: 'DOGE' }, { id: 7, symbol: 'XRP' }, { id: 8, symbol: 'LINK' },
        { id: 9, symbol: 'AVAX' }, { id: 10, symbol: 'NEAR' }, { id: 11, symbol: 'DOT' },
        { id: 12, symbol: 'TON' }, { id: 13, symbol: 'TAO' }, { id: 16, symbol: 'SUI' },
        { id: 20, symbol: 'BERA' }, { id: 24, symbol: 'HYPE' }, { id: 25, symbol: 'BNB' },
        { id: 26, symbol: 'JUP' }, { id: 27, symbol: 'AAVE' }, { id: 29, symbol: 'ENA' },
        { id: 30, symbol: 'UNI' }, { id: 31, symbol: 'APT' }, { id: 32, symbol: 'SEI' },
        { id: 35, symbol: 'LTC' }, { id: 36, symbol: 'CRV' }, { id: 37, symbol: 'PENDLE' },
        { id: 38, symbol: 'ONDO' }, { id: 39, symbol: 'ADA' }, { id: 43, symbol: 'TRX' },
        { id: 46, symbol: 'LDO' }, { id: 47, symbol: 'PENGU' }, { id: 48, symbol: 'PAXG' },
        { id: 50, symbol: 'ARB' }, { id: 55, symbol: 'OP' }, { id: 61, symbol: 'GMX' },
        { id: 62, symbol: 'DYDX' }, { id: 67, symbol: 'TIA' },
    ];

    constructor(config?: Partial<RESTAdapterConfig>) {
        super({ symbols: config?.symbols || [] });
    }

    async fetchPrices(): Promise<PriceData[]> {
        const prices: PriceData[] = [];

        const fetchPromises = this.markets.map(async ({ id, symbol }, i) => {
            await new Promise(resolve => setTimeout(resolve, i * 30));

            try {
                const response = await fetch(`${this.apiUrl}?market_id=${id}&limit=5`);

                if (!response.ok) {
                    if (response.status !== 404) {
                        console.error(`[${this.exchangeId}] REST error for ${symbol}: ${response.status}`);
                    }
                    return null;
                }

                const data: OrderBookResponse = await response.json();

                if (data.bids?.length > 0 && data.asks?.length > 0) {
                    const bestBid = parseFloat(data.bids[0].price);
                    const bestAsk = parseFloat(data.asks[0].price);

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

        console.log(`[${this.exchangeId}] REST fetched ${prices.length}/${this.markets.length} prices`);
        return prices;
    }
}
