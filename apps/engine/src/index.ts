import 'dotenv/config';
import { createServer } from './server/http.js';
import { initSocketServer } from './server/socket.js';
import { ExchangeManager } from './exchanges/index.js';
import { PriceAggregator } from './services/price-aggregator.js';
import { ArbitrageDetector } from './services/arbitrage-detector.js';
import { Broadcaster } from './services/broadcaster.js';
import { QuestDBClient } from './database/questdb.js';

const PORT = process.env.PORT || 3001;

async function main() {
    console.log('🚀 Starting Arbitrage Engine v5...');

    // Initialize HTTP server
    const { app, httpServer } = createServer();

    // Initialize Socket.io
    const io = initSocketServer(httpServer);

    // Initialize QuestDB client
    const questdb = new QuestDBClient({
        host: process.env.QUESTDB_HOST || 'localhost',
        ilpPort: parseInt(process.env.QUESTDB_ILP_PORT || '9009'),
        httpPort: parseInt(process.env.QUESTDB_HTTP_PORT || '9000'),
    });

    // Initialize services
    const priceAggregator = new PriceAggregator();
    const arbitrageDetector = new ArbitrageDetector({ minSpreadPercent: 0.1 });
    const broadcaster = new Broadcaster(io);

    // Price tracking for logging
    let priceCount = 0;
    let lastLogTime = Date.now();
    const logInterval = 5000; // Log every 5 seconds

    // Initialize exchange connections
    const exchangeManager = new ExchangeManager({
        onPrice: async (price) => {
            priceCount++;

            // Log sample prices every 5 seconds
            const now = Date.now();
            if (now - lastLogTime >= logInterval) {
                const mid = (price.bid + price.ask) / 2;
                console.log(`📊 [${price.exchange}] ${price.symbol}: $${mid.toFixed(2)} | Total: ${priceCount} prices received`);
                lastLogTime = now;
            }

            // Store in QuestDB
            await questdb.insertPrice(price);

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

    // Start exchange connections
    await exchangeManager.connectAll();

    // Start HTTP server
    httpServer.listen(PORT, () => {
        console.log(`✅ Engine running on port ${PORT}`);
        console.log(`📡 Socket.io ready for connections`);
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
