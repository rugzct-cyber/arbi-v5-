import 'dotenv/config';
import { createServer } from './server/http.js';
import { initSocketServer } from './server/socket.js';
import { ExchangeManager } from './exchanges/index.js';
import { PriceAggregator } from './services/price-aggregator.js';
import { ArbitrageDetector } from './services/arbitrage-detector.js';
import { Broadcaster } from './services/broadcaster.js';
import { SupabasePriceClient } from './database/supabase.js';
import type { PriceData } from '@arbitrage/shared';

const PORT = process.env.PORT || 3001;
const DB_SAMPLE_INTERVAL = 5 * 60 * 1000; // 5 minutes in ms

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

    // Store latest prices for 5-min sampling
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

    // Function to insert prices at aligned times (xx:00, xx:05, xx:10, xx:15, etc.)
    const insertPrices = async () => {
        if (latestPrices.size === 0) return;

        const prices = Array.from(latestPrices.values());
        const now = new Date();
        console.log(`💾 [${now.toISOString()}] Sampling ${prices.length} prices to Supabase...`);

        try {
            await supabase.insertBatch(prices);
            console.log(`✅ Saved ${prices.length} prices to Supabase`);
        } catch (error) {
            console.error('❌ Supabase batch insert failed:', error);
        }
    };

    // Schedule next aligned insert (xx:00, xx:05, xx:10, xx:15, etc.)
    const scheduleNextInsert = () => {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const ms = now.getMilliseconds();

        // Calculate next aligned time (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
        const nextAligned = Math.ceil((minutes + 1) / 5) * 5;
        const minutesUntilNext = (nextAligned - minutes - 1 + 60) % 60 || 5;
        const msUntilNext = (minutesUntilNext * 60 - seconds) * 1000 - ms;

        console.log(`⏰ Next QuestDB insert in ${Math.round(msUntilNext / 1000)}s at :${String((nextAligned % 60)).padStart(2, '0')}`);

        setTimeout(async () => {
            await insertPrices();
            // After inserting, schedule next one in exactly 5 minutes
            setInterval(insertPrices, DB_SAMPLE_INTERVAL);
        }, msUntilNext);
    };

    // Initial insert 30 seconds after startup (to collect some prices first)
    setTimeout(async () => {
        console.log('🚀 Initial QuestDB insert (30s after startup)...');
        await insertPrices();
        // Then schedule aligned inserts
        scheduleNextInsert();
    }, 30000);

    // Start exchange connections
    await exchangeManager.connectAll();

    // Start HTTP server
    httpServer.listen(PORT, () => {
        console.log(`✅ Engine running on port ${PORT}`);
        console.log(`📡 Socket.io ready for connections`);
        console.log(`💾 Supabase sampling every 5 minutes`);
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n🛑 Shutting down...');
        await exchangeManager.disconnectAll();
        await supabase.close();
        httpServer.close();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch(console.error);
