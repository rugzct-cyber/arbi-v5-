import 'dotenv/config';
import { createServer } from './server/http.js';
import { initSocketServer } from './server/socket.js';
import { ExchangeManager } from './exchanges/index.js';
import { PriceAggregator } from './services/price-aggregator.js';
import { ArbitrageDetector } from './services/arbitrage-detector.js';
import { Broadcaster } from './services/broadcaster.js';
import { SupabasePriceClient } from './database/supabase.js';
import { RESTPoller } from './rest-adapters/index.js';
import { TradingBot } from './trading/index.js';
import type { TradingConfig } from './trading/types.js';

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

    // Initialize Trading Bot (paper mode by default)
    const tradingBot = new TradingBot({
        paperMode: true,
        enabled: true,
        minSpreadPercent: 0.2,
        maxSpreadPercent: 5.0,
        maxPositionSizeUsd: 100,
        verifyWithRest: true,
    });

    // Auto-authenticate if token is set
    const tradingToken = process.env.TRADING_SECRET_TOKEN;
    if (tradingToken) {
        tradingBot.authenticate(tradingToken);
    }

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

                // Pass opportunity to trading bot
                if (tradingBot.isActive()) {
                    const result = await tradingBot.processOpportunity(opportunity);
                    if (result) {
                        console.log(`[TradingBot] Trade result:`, result.status, result.symbol);
                        // Broadcast trading update
                        io.emit('trading:update', tradingBot.getStats());
                    }
                }
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

    // Trading bot Socket.io control events
    io.on('connection', (socket) => {
        // Send current trading status on connect
        socket.emit('trading:update', tradingBot.getStats());

        // Start trading bot
        socket.on('trading:start', (token: string) => {
            console.log(`[Socket] trading:start request from ${socket.id}`);
            if (tradingBot.isAuth() || tradingBot.authenticate(token)) {
                const success = tradingBot.start();
                socket.emit('trading:update', tradingBot.getStats());
                io.emit('trading:update', tradingBot.getStats());
            } else {
                socket.emit('trading:error', 'Authentication failed');
            }
        });

        // Stop trading bot
        socket.on('trading:stop', () => {
            console.log(`[Socket] trading:stop request from ${socket.id}`);
            tradingBot.stop();
            io.emit('trading:update', tradingBot.getStats());
        });

        // Update trading config
        socket.on('trading:config', (config: Partial<TradingConfig>) => {
            console.log(`[Socket] trading:config update from ${socket.id}:`, config);
            tradingBot.updateConfig(config);
            io.emit('trading:update', tradingBot.getStats());
        });

        // Request current stats
        socket.on('trading:stats', () => {
            socket.emit('trading:update', tradingBot.getStats());
        });
    });

    // Periodically broadcast trading stats to all clients
    setInterval(() => {
        if (io.engine.clientsCount > 0) {
            io.emit('trading:update', tradingBot.getStats());
        }
    }, 5000); // Every 5 seconds

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
        console.log(`🤖 Trading bot ${tradingBot.isAuth() ? 'authenticated' : 'waiting for auth'}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n🛑 Shutting down...');
        tradingBot.stop();
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
