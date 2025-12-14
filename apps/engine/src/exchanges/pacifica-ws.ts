import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * Pacifica WebSocket Adapter
 * 
 * Docs: https://docs.pacifica.fi/api-documentation/api/websocket
 * 
 * URL: wss://ws.pacifica.fi/ws
 * 
 * BBO Subscribe format:
 * { "method": "subscribe", "params": { "source": "bbo", "symbol": "BTC" } }
 * 
 * BBO Response format:
 * { "channel": "bbo", "data": { "s": "BTC", "b": "87185", "B": "1.234", "a": "87186", "A": "0.567", "t": 1764133203991 } }
 * 
 * Where: b = best bid price, a = best ask price
 */
export class PacificaWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'pacifica';
    readonly wsUrl = 'wss://ws.pacifica.fi/ws';

    private pingInterval: NodeJS.Timeout | null = null;

    // Symbols to subscribe to
    private readonly symbols = [
        'BTC',
        'ETH',
        'SOL',
        'ARB',
        'AVAX',
        'DOGE',
        'LINK',
        'OP',
        'SUI',
        'APT',
        'NEAR',
        'XRP',
        'ADA',
        'DOT',
        'ATOM',
    ];

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToBBO();
        this.startPing();
    }

    private subscribeToBBO(): void {
        for (const symbol of this.symbols) {
            this.send({
                method: 'subscribe',
                params: {
                    source: 'bbo',
                    symbol,
                },
            });
        }

        console.log(`[${this.exchangeId}] Subscribed to BBO for ${this.symbols.length} symbols`);
    }

    private startPing(): void {
        // Send ping every 30 seconds to keep connection alive
        this.pingInterval = setInterval(() => {
            this.send({ method: 'ping' });
        }, 30000);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            // Handle pong
            if (message.channel === 'pong') {
                return;
            }

            // Handle BBO updates
            // Format: { "channel": "bbo", "data": { "s": "BTC", "b": "87185", "a": "87186", ... } }
            if (message.channel === 'bbo' && message.data) {
                const { s: symbol, b: bidStr, a: askStr } = message.data;

                if (symbol && bidStr && askStr) {
                    const bid = parseFloat(bidStr);
                    const ask = parseFloat(askStr);

                    if (bid > 0 && ask > 0) {
                        this.emitPrice({
                            exchange: this.exchangeId,
                            symbol: normalizeSymbol(`${symbol}-USD`),
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

    async disconnect(): Promise<void> {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        await super.disconnect();
    }
}
