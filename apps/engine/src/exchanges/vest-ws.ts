import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * Vest Exchange WebSocket Adapter
 * 
 * Docs: https://docs.vestmarkets.com/vest-api#public-ws-endpoints
 * 
 * URL: wss://ws-prod.hz.vestmarkets.com/ws-api?version=1.0
 * 
 * Subscribe format:
 * { "method": "SUBSCRIBE", "params": ["BTC-PERP@depth", ...], "id": 1 }
 * 
 * Response format (Depth):
 * { "channel": "BTC-PERP@depth", "data": { "bids": [["price", "qty"], ...], "asks": [["price", "qty"], ...] } }
 */
export class VestWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'vest';
    readonly wsUrl = 'wss://ws-prod.hz.vestmarkets.com/ws-api?version=1.0';

    // Vest symbols - CRYPTO ONLY (stocks/indices block depth subscriptions!)
    private readonly symbols = [
        'BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'XRP-PERP', 'BNB-PERP', 'DOGE-PERP', 'AVAX-PERP',
        'SUI-PERP', 'TON-PERP', 'TAO-PERP', 'NEAR-PERP', 'AAVE-PERP', 'HYPE-PERP', 'BERA-PERP',
        'WLD-PERP', 'WIF-PERP', 'JUP-PERP', 'ENA-PERP', 'FARTCOIN-PERP', 'ONDO-PERP',
        'KAITO-PERP', 'ASTER-PERP', 'ZRO-PERP', 'ZK-PERP', 'PAXG-PERP',
    ];

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToDepth();
    }

    // Override connect to add headers
    async connect(): Promise<void> {
        console.log(`[${this.exchangeId}] Attempting to connect to ${this.wsUrl}...`);
        if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
            console.log(`[${this.exchangeId}] Already connected or connecting, skipping`);
            return;
        }

        this.isConnecting = true;

        return new Promise((resolve, reject) => {
            try {
                // Add headers to mimic browser/legitimate client
                this.ws = new WebSocket(this.wsUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Origin': 'https://vestmarkets.com',
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
                    console.error(`[${this.exchangeId}] WebSocket error:`, error.message || error);
                    if (error.message?.includes('530') || error.message?.includes('403')) {
                        console.error(`[${this.exchangeId}] Connection rejected. Site might be frozen or blocking.`);
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

    private subscribeToDepth(): void {
        // Channel name: {symbol}@depth
        const channels = this.symbols.map(s => `${s}@depth`);

        this.send({
            method: 'SUBSCRIBE',
            params: channels,
            id: Math.floor(Date.now() / 1000)
        });

        console.log(`[${this.exchangeId}] Subscribed to ${channels.length} depth channels`);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            // Debug log for raw message to verify subscription success
            console.log(`[${this.exchangeId}] Raw:`, data.toString().substring(0, 300));

            const message = JSON.parse(data.toString());

            if (message.channel && message.channel.endsWith('@depth') && message.data) {
                const channel = message.channel;
                const market = channel.split('@')[0];
                const symbol = normalizeSymbol(market.replace('-PERP', ''));

                const { bids, asks } = message.data;

                if (bids && bids.length > 0 && asks && asks.length > 0) {
                    const bestBid = parseFloat(bids[0][0]);
                    const bestAsk = parseFloat(asks[0][0]);

                    if (bestBid > 0 && bestAsk > 0) {
                        // console.log(`[${this.exchangeId}] Price: ${symbol} ${bestBid} ${bestAsk}`);
                        this.emitPrice({
                            exchange: this.exchangeId,
                            symbol,
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
