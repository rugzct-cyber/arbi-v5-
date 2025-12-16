import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * Extended Exchange WebSocket Adapter
 * 
 * Docs: https://api.docs.extended.exchange/#public-websocket-streams
 * 
 * URL: wss://api.starknet.extended.exchange/stream.extended.exchange/v1/orderbooks?depth=1
 * 
 * Message format:
 * { 
 *   "ts": 1701563440000, 
 *   "type": "SNAPSHOT", 
 *   "data": { 
 *     "m": "BTC-USD", 
 *     "b": [ { "p": "25670", "q": "0.1" } ], 
 *     "a": [ { "p": "25770", "q": "0.1" } ] 
 *   }, 
 *   "seq": 1 
 * }
 */
export class ExtendedWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'extended';
    readonly wsUrl = 'wss://api.starknet.extended.exchange/stream.extended.exchange/v1/orderbooks?depth=1'; // Using orderbooks stream with depth=1 for best bid/ask

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected to orderbook stream`);
    }

    // Override to add headers for Extended API access
    protected getWebSocketOptions(): import('ws').ClientOptions {
        return {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://extended.exchange',
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache',
            }
        };
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            // Handle Order Book updates (SNAPSHOT or DELTA)
            // Format: { "type": "SNAPSHOT", "data": { "m": "BTC-USD", "b": [{"p": "...", "q": "..."}], "a": [...] } }
            if (message.data && (message.type === 'SNAPSHOT' || message.type === 'DELTA')) {
                const { m: market, b: bids, a: asks } = message.data;

                if (market) {
                    let bestBid = 0;
                    let bestAsk = 0;

                    if (bids && bids.length > 0) {
                        bestBid = parseFloat(bids[0].p);
                    }

                    if (asks && asks.length > 0) {
                        bestAsk = parseFloat(asks[0].p);
                    }

                    if (bestBid > 0 && bestAsk > 0) {
                        this.emitPrice({
                            exchange: this.exchangeId,
                            symbol: normalizeSymbol(market),
                            bid: bestBid,
                            ask: bestAsk,
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }
}
