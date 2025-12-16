import WebSocket from 'ws';
import type { PriceData } from '@arbitrage/shared';

export interface ExchangeAdapterConfig {
    onPrice: (price: PriceData) => void;
    onError: (error: Error) => void;
    onConnected: () => void;
    onDisconnected: () => void;
}

export abstract class BaseExchangeAdapter {
    protected ws: WebSocket | null = null;
    protected config: ExchangeAdapterConfig;
    protected reconnectAttempts = 0;
    protected maxReconnectAttempts = 10;
    protected reconnectDelay = 1000;
    protected isConnecting = false;

    abstract readonly exchangeId: string;
    abstract readonly wsUrl: string;

    constructor(config: ExchangeAdapterConfig) {
        this.config = config;
    }

    /**
     * Override this method to provide custom WebSocket options (e.g., headers)
     */
    protected getWebSocketOptions(): WebSocket.ClientOptions {
        return {};
    }

    async connect(): Promise<void> {
        if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
            return;
        }

        this.isConnecting = true;

        return new Promise((resolve, reject) => {
            try {
                // Use getWebSocketOptions() to allow subclasses to add custom headers
                const options = this.getWebSocketOptions();
                this.ws = Object.keys(options).length > 0
                    ? new WebSocket(this.wsUrl, options)
                    : new WebSocket(this.wsUrl);

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

    protected scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`[${this.exchangeId}] Max reconnect attempts reached`);
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`[${this.exchangeId}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            this.connect().catch(console.error);
        }, delay);
    }

    async disconnect(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    protected send(data: unknown): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    protected emitPrice(price: Omit<PriceData, 'timestamp'>): void {
        this.config.onPrice({
            ...price,
            timestamp: Date.now(),
        });
    }

    // Abstract methods to be implemented by each exchange
    protected abstract onOpen(): void;
    protected abstract onMessage(data: WebSocket.RawData): void;
}
