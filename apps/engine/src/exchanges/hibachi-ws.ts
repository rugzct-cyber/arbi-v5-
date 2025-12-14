import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * Hibachi WebSocket Adapter
 * 
 * Docs: https://api-doc.hibachi.xyz/#websocket-api
 * 
 * URL: wss://api.hibachi.xyz/ws/market
 * 
 * Subscribe format:
 * {
 *   "method": "subscribe",
 *   "parameters": {
 *     "subscriptions": [
 *       { "symbol": "ETH/USDT-P", "topic": "mark_price" }
 *     ]
 *   }
 * }
 * 
 * For all symbols, we'll subscribe to mark_price and ask_bid_price topics.
 */
export class HibachiWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'hibachi';
    readonly wsUrl = 'wss://api.hibachi.xyz/ws/market';

    // Common perpetual pairs on Hibachi
    private readonly symbols = [
        'BTC/USDT-P',
        'ETH/USDT-P',
        'SOL/USDT-P',
        'ARB/USDT-P',
        'AVAX/USDT-P',
        'DOGE/USDT-P',
        'LINK/USDT-P',
        'OP/USDT-P',
        'MATIC/USDT-P',
        'SUI/USDT-P',
    ];

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToMarkPrices();
    }

    // Override connect to add headers
    async connect(): Promise<void> {
        if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
            return;
        }

        this.isConnecting = true;

        return new Promise((resolve, reject) => {
            try {
                // Add headers to mimic browser/legitimate client to bypass 400/403
                // Cloudflare often blocks requests without proper User-Agent or Origin
                this.ws = new WebSocket(this.wsUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Origin': 'https://hibachi.xyz',
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache',
                    }
                });

                this.ws.on('open', () => {
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.onOpen();
                    this.config.onConnected();
                    resolve();
                });

                this.ws.on('message', (data) => {
                    try {
                        this.onMessage(data);
                    } catch (error) {
                        console.error(`[${this.exchangeId}] Message parse error:`, error);
                    }
                });

                this.ws.on('error', (error) => {
                    if (error.message.includes('400') || error.message.includes('403')) {
                        console.error(`[${this.exchangeId}] Connection rejected (${error.message}). Headers might be blocked.`);
                    }
                    this.isConnecting = false;
                    this.config.onError(error);
                    reject(error);
                });

                this.ws.on('close', () => {
                    this.isConnecting = false;
                    this.config.onDisconnected();
                    this.scheduleReconnect();
                });

            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    private subscribeToMarkPrices(): void {
        // Build subscriptions for all symbols
        const subscriptions = this.symbols.flatMap((symbol) => [
            { symbol, topic: 'mark_price' },
            { symbol, topic: 'ask_bid_price' },
        ]);

        this.send({
            method: 'subscribe',
            parameters: {
                subscriptions,
            },
        });

        console.log(`[${this.exchangeId}] Subscribed to ${this.symbols.length} symbols`);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            // Handle mark_price updates
            // Expected format: { "topic": "mark_price", "symbol": "ETH/USDT-P", "data": { "mark_price": "3100.50" } }
            if (message.topic === 'mark_price' && message.symbol && message.data?.mark_price) {
                const price = parseFloat(message.data.mark_price);

                if (price > 0) {
                    // Normalize symbol: "ETH/USDT-P" -> "ETH-USDT"
                    const symbol = normalizeSymbol(message.symbol.replace('/USDT-P', '-USDT').replace('/', '-'));

                    // Create synthetic bid/ask from mark price
                    const spreadFactor = 0.0001;
                    const halfSpread = price * spreadFactor / 2;

                    this.emitPrice({
                        exchange: this.exchangeId,
                        symbol,
                        bid: price - halfSpread,
                        ask: price + halfSpread,
                    });
                }
            }

            // Handle ask_bid_price updates (actual bid/ask if available)
            if (message.topic === 'ask_bid_price' && message.symbol && message.data) {
                const { bid_price, ask_price } = message.data;

                if (bid_price && ask_price) {
                    const bid = parseFloat(bid_price);
                    const ask = parseFloat(ask_price);

                    if (bid > 0 && ask > 0) {
                        const symbol = normalizeSymbol(message.symbol.replace('/USDT-P', '-USDT').replace('/', '-'));

                        this.emitPrice({
                            exchange: this.exchangeId,
                            symbol,
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
