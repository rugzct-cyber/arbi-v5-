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

    // COMPLETE market ID to symbol mapping from Lighter API
    // Source: https://mainnet.zklighter.elliot.ai/api/v1/orderBooks
    // Matches WebSocket adapter for consistency
    private readonly markets: Array<{ id: number; symbol: string }> = [
        { id: 0, symbol: 'ETH' }, { id: 1, symbol: 'BTC' }, { id: 2, symbol: 'SOL' },
        { id: 3, symbol: 'DOGE' }, { id: 4, symbol: '1000PEPE' }, { id: 5, symbol: 'WIF' },
        { id: 6, symbol: 'WLD' }, { id: 7, symbol: 'XRP' }, { id: 8, symbol: 'LINK' },
        { id: 9, symbol: 'AVAX' }, { id: 10, symbol: 'NEAR' }, { id: 11, symbol: 'DOT' },
        { id: 12, symbol: 'TON' }, { id: 13, symbol: 'TAO' }, { id: 14, symbol: 'POL' },
        { id: 15, symbol: 'TRUMP' }, { id: 16, symbol: 'SUI' }, { id: 17, symbol: '1000SHIB' },
        { id: 18, symbol: '1000BONK' }, { id: 19, symbol: '1000FLOKI' }, { id: 20, symbol: 'BERA' },
        { id: 21, symbol: 'FARTCOIN' }, { id: 23, symbol: 'POPCAT' }, { id: 24, symbol: 'HYPE' },
        { id: 25, symbol: 'BNB' }, { id: 26, symbol: 'JUP' }, { id: 27, symbol: 'AAVE' },
        { id: 29, symbol: 'ENA' }, { id: 30, symbol: 'UNI' }, { id: 31, symbol: 'APT' },
        { id: 32, symbol: 'SEI' }, { id: 33, symbol: 'KAITO' }, { id: 34, symbol: 'IP' },
        { id: 35, symbol: 'LTC' }, { id: 36, symbol: 'CRV' }, { id: 37, symbol: 'PENDLE' },
        { id: 38, symbol: 'ONDO' }, { id: 39, symbol: 'ADA' }, { id: 40, symbol: 'S' },
        { id: 41, symbol: 'VIRTUAL' }, { id: 42, symbol: 'SPX' }, { id: 43, symbol: 'TRX' },
        { id: 44, symbol: 'SYRUP' }, { id: 45, symbol: 'PUMP' }, { id: 46, symbol: 'LDO' },
        { id: 47, symbol: 'PENGU' }, { id: 48, symbol: 'PAXG' }, { id: 49, symbol: 'EIGEN' },
        { id: 50, symbol: 'ARB' }, { id: 51, symbol: 'RESOLV' }, { id: 52, symbol: 'GRASS' },
        { id: 53, symbol: 'ZORA' }, { id: 55, symbol: 'OP' }, { id: 56, symbol: 'ZK' },
        { id: 57, symbol: 'PROVE' }, { id: 58, symbol: 'BCH' }, { id: 59, symbol: 'HBAR' },
        { id: 60, symbol: 'ZRO' }, { id: 61, symbol: 'GMX' }, { id: 62, symbol: 'DYDX' },
        { id: 63, symbol: 'MNT' }, { id: 64, symbol: 'ETHFI' }, { id: 65, symbol: 'AERO' },
        { id: 66, symbol: 'USELESS' }, { id: 67, symbol: 'TIA' }, { id: 68, symbol: 'MORPHO' },
        { id: 69, symbol: 'VVV' }, { id: 70, symbol: 'YZY' }, { id: 71, symbol: 'XPL' },
        { id: 72, symbol: 'WLFI' }, { id: 73, symbol: 'CRO' }, { id: 74, symbol: 'NMR' },
        { id: 75, symbol: 'DOLO' }, { id: 76, symbol: 'LINEA' }, { id: 77, symbol: 'XMR' },
        { id: 78, symbol: 'PYTH' }, { id: 79, symbol: 'SKY' }, { id: 80, symbol: 'MYX' },
        { id: 81, symbol: '1000TOSHI' }, { id: 82, symbol: 'AVNT' }, { id: 83, symbol: 'ASTER' },
        { id: 84, symbol: '0G' }, { id: 85, symbol: 'STBL' }, { id: 86, symbol: 'APEX' },
        { id: 87, symbol: 'FF' }, { id: 88, symbol: '2Z' }, { id: 89, symbol: 'EDEN' },
        { id: 90, symbol: 'ZEC' }, { id: 91, symbol: 'MON' }, { id: 92, symbol: 'XAU' },
        { id: 93, symbol: 'XAG' }, { id: 94, symbol: 'MEGA' }, { id: 95, symbol: 'MET' },
        { id: 96, symbol: 'EURUSD' }, { id: 97, symbol: 'GBPUSD' }, { id: 98, symbol: 'USDJPY' },
        { id: 99, symbol: 'USDCHF' }, { id: 100, symbol: 'USDCAD' }, { id: 101, symbol: 'CC' },
        { id: 102, symbol: 'ICP' }, { id: 103, symbol: 'FIL' }, { id: 104, symbol: 'STRK' },
        { id: 105, symbol: 'USDKRW' }, { id: 106, symbol: 'AUDUSD' }, { id: 107, symbol: 'NZDUSD' },
        { id: 108, symbol: 'HOOD' }, { id: 109, symbol: 'COIN' }, { id: 110, symbol: 'NVDA' },
        { id: 111, symbol: 'PLTR' }, { id: 112, symbol: 'TSLA' }, { id: 113, symbol: 'AAPL' },
        { id: 114, symbol: 'AMZN' }, { id: 115, symbol: 'MSFT' }, { id: 116, symbol: 'GOOGL' },
        { id: 117, symbol: 'META' }, { id: 118, symbol: 'STABLE' }, { id: 119, symbol: 'XLM' },
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
