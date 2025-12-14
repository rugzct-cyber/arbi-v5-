import { io, Socket } from 'socket.io-client';
import type { PriceData } from '@arbitrage/shared';
import { normalizeSymbol } from '@arbitrage/shared';
import type { ExchangeAdapterConfig } from './base-adapter.js';

/**
 * Ethereal WebSocket Adapter (Socket.IO)
 * 
 * Ethereal uses Socket.IO instead of native WebSocket.
 * This adapter doesn't extend BaseExchangeAdapter.
 * 
 * Docs: https://docs.ethereal.trade/developer-guides/trading-api/websocket-gateway
 * URL: wss://ws.ethereal.trade/v1/stream (Socket.IO)
 * Products API: https://api.ethereal.trade/v1/product
 */

interface EtherealProduct {
    id: string;
    ticker: string;
    displayTicker: string;
}

export class EtherealWebSocket {
    readonly exchangeId = 'ethereal';

    private socket: Socket | null = null;
    private config: ExchangeAdapterConfig;
    private products: Map<string, string> = new Map(); // productId -> symbol
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;

    constructor(config: ExchangeAdapterConfig) {
        this.config = config;
        console.log(`[${this.exchangeId}] Adapter created`);
    }

    async connect(): Promise<void> {
        console.log(`[${this.exchangeId}] Starting connection...`);
        try {
            // First fetch products to get UUIDs
            await this.fetchProducts();

            if (this.products.size === 0) {
                console.warn(`[${this.exchangeId}] No products found, skipping connection`);
                return;
            }

            // Connect via Socket.IO
            this.socket = io('wss://ws.ethereal.trade/v1/stream', {
                transports: ['websocket'],
                reconnection: false, // We handle reconnection ourselves
            });

            this.socket.on('connect', () => {
                console.log(`[${this.exchangeId}] Socket.IO connected`);
                this.reconnectAttempts = 0;
                this.subscribeToBookDepth();
                this.config.onConnected();
            });

            this.socket.on('BookDepth', (data: any) => {
                this.processBookDepth(data);
            });

            this.socket.on('disconnect', (reason) => {
                console.log(`[${this.exchangeId}] Socket.IO disconnected: ${reason}`);
                this.config.onDisconnected();
                this.scheduleReconnect();
            });

            this.socket.on('connect_error', (error: any) => {
                console.error(`[${this.exchangeId}] Socket.IO connect error:`, error.message);
                this.config.onError(error);
                this.scheduleReconnect();
            });

        } catch (error) {
            console.error(`[${this.exchangeId}] Connection error:`, error);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`[${this.exchangeId}] Max reconnect attempts reached`);
            return;
        }

        this.reconnectAttempts++;
        const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`[${this.exchangeId}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            this.connect().catch(console.error);
        }, delay);
    }

    private async fetchProducts(): Promise<void> {
        console.log(`[${this.exchangeId}] Fetching products from API...`);
        try {
            // Add timeout to fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch('https://api.ethereal.trade/v1/product', {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            // API returns { data: [...], hasNext: false }
            const result = await response.json() as { data: EtherealProduct[], hasNext: boolean };

            if (result.data && Array.isArray(result.data)) {
                for (const product of result.data) {
                    // Map productId -> normalized symbol (e.g., "BTC-USD")
                    const symbol = product.displayTicker || product.ticker;
                    this.products.set(product.id, normalizeSymbol(symbol));
                }
            }

            console.log(`[${this.exchangeId}] Loaded ${this.products.size} products`);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error(`[${this.exchangeId}] Fetch timeout after 10s`);
            } else {
                console.error(`[${this.exchangeId}] Failed to fetch products:`, error.message);
            }
        }
    }

    private subscribeToBookDepth(): void {
        if (!this.socket) return;

        // Subscribe to BookDepth for all products
        for (const productId of this.products.keys()) {
            this.socket.emit('subscribe', {
                type: 'BookDepth',
                productId,
            });
        }

        console.log(`[${this.exchangeId}] Subscribed to BookDepth for ${this.products.size} products`);
    }

    private processBookDepth(data: any): void {
        try {
            const { productId, asks, bids } = data;

            if (!productId || !asks?.length || !bids?.length) return;

            const symbol = this.products.get(productId);
            if (!symbol) return;

            // Get best bid and ask (format: [[price, qty], ...])
            const bestBid = parseFloat(bids[0][0]);
            const bestAsk = parseFloat(asks[0][0]);

            if (bestBid > 0 && bestAsk > 0) {
                this.emitPrice({
                    exchange: this.exchangeId,
                    symbol,
                    bid: bestBid,
                    ask: bestAsk,
                });
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] BookDepth parse error:`, error);
        }
    }

    private emitPrice(price: Omit<PriceData, 'timestamp'>): void {
        this.config.onPrice({
            ...price,
            timestamp: Date.now(),
        });
    }

    async disconnect(): Promise<void> {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}
