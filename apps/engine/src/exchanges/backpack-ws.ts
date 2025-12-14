import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * Backpack WebSocket Adapter
 * 
 * Docs: https://docs.backpack.exchange/#tag/Streams
 * 
 * URL: wss://ws.backpack.exchange
 * 
 * Subscribe format:
 * { "method": "SUBSCRIBE", "params": ["bookTicker.SOL_USDC", "bookTicker.BTC_USDC_PERP"] }
 * 
 * Response format:
 * { "stream": "bookTicker.SOL_USDC", "data": { "e": "bookTicker", "s": "SOL_USDC", "a": "18.70", "b": "18.67", ... } }
 * 
 * Where: a = best ask price, b = best bid price
 */
export class BackpackWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'backpack';
    readonly wsUrl = 'wss://ws.backpack.exchange';

    // Main markets to subscribe to (spot and perp)
    private readonly spotSymbols = [
        'SOL_USDC',
        'BTC_USDC',
        'ETH_USDC',
        'JUP_USDC',
        'WIF_USDC',
        'BONK_USDC',
        'PYTH_USDC',
        'RENDER_USDC',
        'SUI_USDC',
        'XRP_USDC',
        'DOGE_USDC',
        'LINK_USDC',
        'UNI_USDC',
        'AAVE_USDC',
        'BNB_USDC',
        'TRUMP_USDC',
        'PENGU_USDC',
    ];

    private readonly perpSymbols = [
        'SOL_USDC_PERP',
        'BTC_USDC_PERP',
        'ETH_USDC_PERP',
        'XRP_USDC_PERP',
        'SUI_USDC_PERP',
        'DOGE_USDC_PERP',
        'JUP_USDC_PERP',
        'TRUMP_USDC_PERP',
        'WIF_USDC_PERP',
        'LINK_USDC_PERP',
        'BNB_USDC_PERP',
        'AVAX_USDC_PERP',
        'ARB_USDC_PERP',
        'OP_USDC_PERP',
        'NEAR_USDC_PERP',
        'AAVE_USDC_PERP',
        'PENGU_USDC_PERP',
        'ADA_USDC_PERP',
    ];

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToBookTicker();
    }

    private subscribeToBookTicker(): void {
        // Subscribe to both spot and perp markets
        const allSymbols = [...this.spotSymbols, ...this.perpSymbols];
        const streams = allSymbols.map((s) => `bookTicker.${s}`);

        this.send({
            method: 'SUBSCRIBE',
            params: streams,
        });

        console.log(`[${this.exchangeId}] Subscribed to ${streams.length} bookTicker streams (${this.spotSymbols.length} spot, ${this.perpSymbols.length} perp)`);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            // Handle bookTicker updates
            // Format: { "stream": "bookTicker.SOL_USDC", "data": { "e": "bookTicker", "s": "SOL_USDC", "a": "18.70", "b": "18.67", ... } }
            if (message.stream?.startsWith('bookTicker.') && message.data) {
                const { s: symbol, a: askStr, b: bidStr } = message.data;

                if (symbol && askStr && bidStr) {
                    const ask = parseFloat(askStr);
                    const bid = parseFloat(bidStr);

                    if (bid > 0 && ask > 0) {
                        // Normalize symbol:
                        // "SOL_USDC" -> "SOL" -> "SOL-USD"
                        // "BTC_USDC_PERP" -> "BTC-PERP" -> "BTC-USD-PERP" (depending on normalizeSymbol)

                        let cleanSymbol = symbol;
                        if (cleanSymbol.endsWith('_USDC')) {
                            cleanSymbol = cleanSymbol.replace('_USDC', '');
                        } else if (cleanSymbol.endsWith('_USDC_PERP')) {
                            cleanSymbol = cleanSymbol.replace('_USDC_PERP', '-PERP');
                        }

                        const normalizedSymbol = normalizeSymbol(cleanSymbol);

                        this.emitPrice({
                            exchange: this.exchangeId,
                            symbol: normalizedSymbol,
                            bid,
                            ask,
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }
}
