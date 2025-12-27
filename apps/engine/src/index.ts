import 'dotenv/config';
import { createServer } from './server/http.js';
import { initSocketServer } from './server/socket.js';
import { ExchangeManager } from './exchanges/index.js';
import { PriceAggregator } from './services/price-aggregator.js';
import { ArbitrageDetector } from './services/arbitrage-detector.js';
import { Broadcaster } from './services/broadcaster.js';
import { SupabasePriceClient } from './database/supabase.js';
import { RESTPoller } from './rest-adapters/index.js';

const PORT = process.env.PORT || 3001;

async function main() {
    console.log('🚀 Starting Arbitrage Engine v5...');

    // Initialize HTTP server
    const { app, httpServer } = createServer();

    // Initialize Socket.io
    const io = initSocketServer(httpServer);

    // Initialize Supabase client
    const supabase = new SupabasePriceClient({
        url: process.env.SUPABASE_URL || '',
        serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    });

    // Initialize services
    const priceAggregator = new PriceAggregator();
    const arbitrageDetector = new ArbitrageDetector({ minSpreadPercent: 0.1 });
    const broadcaster = new Broadcaster(io);

    // Price tracking for logging
    let priceCount = 0;
    let lastLogTime = Date.now();
    const logInterval = 5000; // Log every 5 seconds

    // Initialize exchange connections (WebSocket for real-time frontend)
    const exchangeManager = new ExchangeManager({
        onPrice: async (price) => {
            priceCount++;

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

            // Broadcast to clients (frontend real-time)
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

    // Initialize REST Poller for synchronized DB snapshots
    const restPoller = new RESTPoller({ supabase });

    // Start exchange WebSocket connections (for frontend real-time)
    await exchangeManager.connectAll();

    // Start REST polling for DB (synchronized snapshots every 5 minutes)
    restPoller.start();

    // Start HTTP server
    httpServer.listen(PORT, () => {
        console.log(`✅ Engine running on port ${PORT}`);
        console.log(`📡 Socket.io ready for connections (WebSocket → frontend)`);
        console.log(`💾 REST API polling for Supabase every 5 minutes`);
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n🛑 Shutting down...');
        restPoller.stop();
        await exchangeManager.disconnectAll();
        await supabase.close();
        httpServer.close();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch(console.error);
