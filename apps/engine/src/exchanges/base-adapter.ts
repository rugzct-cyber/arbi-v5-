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
    protected watchdogTimer: NodeJS.Timeout | null = null;
    protected readonly watchdogInterval = 15000; // 15 seconds

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
                    this.startWatchdog();
                    this.onOpen();
                    this.config.onConnected();
                    resolve();
                });

                this.ws.on('message', (data) => {
                    this.resetWatchdog();
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
                    this.stopWatchdog();
                    this.isConnecting = false;
                    this.config.onDisconnected();
                    this.scheduleReconnect();
                });

            } catch (error) {
                this.isConnecting = false;
                this.stopWatchdog();
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
        this.stopWatchdog();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    protected startWatchdog(): void {
        this.resetWatchdog();
    }

    protected stopWatchdog(): void {
        if (this.watchdogTimer) {
            clearTimeout(this.watchdogTimer);
            this.watchdogTimer = null;
        }
    }

    protected resetWatchdog(): void {
        if (this.watchdogTimer) {
            clearTimeout(this.watchdogTimer);
        }

        this.watchdogTimer = setTimeout(() => {
            console.warn(`[${this.exchangeId}] Watchdog timeout - no data for ${this.watchdogInterval}ms`);
            if (this.ws) {
                console.log(`[${this.exchangeId}] Terminating zombie connection...`);
                this.ws.terminate(); // Force close to trigger 'close' event and reconnection
            }
        }, this.watchdogInterval);
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
