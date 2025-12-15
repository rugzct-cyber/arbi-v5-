import 'dotenv/config';
import { createServer } from './server/http.js';
import { initSocketServer } from './server/socket.js';
import { ExchangeManager } from './exchanges/index.js';
import { PriceAggregator } from './services/price-aggregator.js';
import { ArbitrageDetector } from './services/arbitrage-detector.js';
import { Broadcaster } from './services/broadcaster.js';
import { QuestDBClient } from './database/questdb.js';
import type { PriceData } from '@arbitrage/shared';

const PORT = process.env.PORT || 3001;
const DB_SAMPLE_INTERVAL = 15 * 60 * 1000; // 15 minutes in ms

async function main() {
    console.log('🚀 Starting Arbitrage Engine v5...');

    // Initialize HTTP server
    const { app, httpServer } = createServer();

    // Initialize Socket.io
    const io = initSocketServer(httpServer);

    // Initialize QuestDB client
    const questdb = new QuestDBClient({
        host: process.env.QUESTDB_HOST || 'questdbquestdb-production-cc7b.up.railway.app',
        ilpPort: parseInt(process.env.QUESTDB_ILP_PORT || '9009'),
        httpPort: parseInt(process.env.QUESTDB_HTTP_PORT || '443'),
    });

    // Initialize services
    const priceAggregator = new PriceAggregator();
    const arbitrageDetector = new ArbitrageDetector({ minSpreadPercent: 0.1 });
    const broadcaster = new Broadcaster(io);

    // Price tracking for logging
    let priceCount = 0;
    let lastLogTime = Date.now();
    const logInterval = 5000; // Log every 5 seconds

    // Store latest prices for 15-min sampling
    const latestPrices = new Map<string, PriceData>();

    // Initialize exchange connections
    const exchangeManager = new ExchangeManager({
        onPrice: async (price) => {
            priceCount++;

            // Store latest price (key = exchange:symbol)
            const key = `${price.exchange}:${price.symbol}`;
            latestPrices.set(key, price);

            // Log sample prices every 5 seconds
            const now = Date.now();
            if (now - lastLogTime >= logInterval) {
                console.log(`📊 [${price.exchange}] ${price.symbol}: Bid ${price.bid} / Ask ${price.ask} | Total: ${priceCount} prices received`);
                lastLogTime = now;
            }

            // Aggregate prices
            const aggregated = priceAggregator.update(price);

            // Detect arbitrage
            const opportunity = arbitrageDetector.detect(aggregated);

            // Broadcast to clients
            broadcaster.broadcastPrice(price);
            if (opportunity) {
                broadcaster.broadcastOpportunity(opportunity);
            }
        },
        onError: (exchange, error) => {
            console.error(`❌ [${exchange}] Error:`, error.message);
            broadcaster.broadcastExchangeError(exchange, error.message);
        },
        onConnected: (exchange) => {
            console.log(`✅ [${exchange}] Connected`);
            broadcaster.broadcastExchangeConnected(exchange);
        },
        onDisconnected: (exchange) => {
            console.log(`⚠️ [${exchange}] Disconnected`);
            broadcaster.broadcastExchangeDisconnected(exchange);
        },
    });

    // 15-minute interval for database sampling
    setInterval(async () => {
        if (latestPrices.size === 0) return;

        const prices = Array.from(latestPrices.values());
        console.log(`💾 Sampling ${prices.length} prices to QuestDB...`);

        try {
            await questdb.insertBatch(prices);
            console.log(`✅ Saved ${prices.length} prices to QuestDB`);
        } catch (error) {
            console.error('❌ QuestDB batch insert failed:', error);
        }
    }, DB_SAMPLE_INTERVAL);

    // Start exchange connections
    await exchangeManager.connectAll();

    // Start HTTP server
    httpServer.listen(PORT, () => {
        console.log(`✅ Engine running on port ${PORT}`);
        console.log(`📡 Socket.io ready for connections`);
        console.log(`💾 QuestDB sampling every 15 minutes`);
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n🛑 Shutting down...');
        await exchangeManager.disconnectAll();
        await questdb.close();
        httpServer.close();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch(console.error);
