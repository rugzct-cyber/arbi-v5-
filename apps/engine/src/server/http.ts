import express from 'express';
import cors from 'cors';
import { createServer as createHttpServer } from 'http';

export function createServer() {
    const app = express();

    // Middleware
    app.use(cors({
        origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
    }));
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: Date.now() });
    });

    // API routes
    app.get('/api/exchanges', (req, res) => {
        // Return list of connected exchanges
        res.json({ exchanges: [] }); // TODO: Implement
    });

    app.get('/api/prices', (req, res) => {
        // Return current prices
        res.json({ prices: [] }); // TODO: Implement
    });

    app.get('/api/arbitrage/opportunities', (req, res) => {
        // Return recent arbitrage opportunities
        res.json({ opportunities: [] }); // TODO: Implement
    });

    const httpServer = createHttpServer(app);

    return { app, httpServer };
}
