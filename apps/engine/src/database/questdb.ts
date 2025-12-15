import { Sender } from '@questdb/nodejs-client';
import type { PriceData, HistoricalPrice } from '@arbitrage/shared';

interface QuestDBConfig {
    host: string;
    ilpPort: number;
    httpPort: number;
}

export class QuestDBClient {
    private sender: Sender | null = null;
    private config: QuestDBConfig;
    private connected = false;
    private connectionFailed = false;
    private errorLogged = false;

    constructor(config: QuestDBConfig) {
        this.config = config;
    }

    async connect(): Promise<void> {
        if (this.connected || this.connectionFailed) return;

        try {
            // Use https for port 443 (Railway public endpoint)
            const protocol = this.config.httpPort === 443 ? 'https' : 'http';
            this.sender = Sender.fromConfig(
                `${protocol}::addr=${this.config.host}:${this.config.httpPort};`
            );
            this.connected = true;
            console.log(`✅ Connected to QuestDB at ${this.config.host}`);
        } catch (error) {
            this.connectionFailed = true;
            console.warn('⚠️ QuestDB not available - running without persistence');
        }
    }

    async insertPrice(price: PriceData): Promise<void> {
        // Skip if connection already failed
        if (this.connectionFailed) return;

        if (!this.sender) {
            await this.connect();
        }

        if (!this.sender) return;

        try {
            await this.sender
                .table('prices')
                .symbol('exchange', price.exchange)
                .symbol('symbol', price.symbol)
                .floatColumn('bid', price.bid)
                .floatColumn('ask', price.ask)
                .floatColumn('spread', ((price.ask - price.bid) / price.bid) * 100)
                .atNow();
        } catch (error) {
            if (!this.errorLogged) {
                console.warn('⚠️ QuestDB insert failed - disabling persistence');
                this.errorLogged = true;
                this.connectionFailed = true;
            }
        }
    }
    async insertOpportunity(opportunity: any): Promise<void> {
        if (this.connectionFailed) return;
        if (!this.sender) await this.connect();
        if (!this.sender) return;

        try {
            await this.sender
                .table('opportunities')
                .symbol('id', opportunity.id)
                .symbol('symbol', opportunity.symbol)
                .symbol('buy_exchange', opportunity.buyExchange)
                .symbol('sell_exchange', opportunity.sellExchange)
                .floatColumn('buy_price', opportunity.buyPrice)
                .floatColumn('sell_price', opportunity.sellPrice)
                .floatColumn('spread', opportunity.spreadPercent)
                .floatColumn('profit', opportunity.potentialProfit)
                .atNow();
        } catch (error) {
            console.error('QuestDB Opportunity insert failed', error);
        }
    }

    async insertBatch(prices: PriceData[]): Promise<void> {
        for (const price of prices) {
            await this.insertPrice(price);
        }
        await this.flush();
    }

    async flush(): Promise<void> {
        if (!this.sender) return;

        try {
            await this.sender.flush();
        } catch (error) {
            console.error('Failed to flush:', error);
        }
    }

    async queryPrices(
        symbol: string,
        exchange?: string,
        limit = 100
    ): Promise<HistoricalPrice[]> {
        const baseUrl = `http://${this.config.host}:${this.config.httpPort}`;

        let query = `SELECT * FROM prices WHERE symbol = '${symbol}'`;
        if (exchange) {
            query += ` AND exchange = '${exchange}'`;
        }
        query += ` ORDER BY timestamp DESC LIMIT ${limit}`;

        try {
            const response = await fetch(`${baseUrl}/exec?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            return data.dataset || [];
        } catch (error) {
            console.error('Query failed:', error);
            return [];
        }
    }

    async close(): Promise<void> {
        if (this.sender) {
            await this.sender.close();
            this.connected = false;
            console.log('🔌 QuestDB connection closed');
        }
    }
}
