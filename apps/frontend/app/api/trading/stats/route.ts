import { NextRequest, NextResponse } from 'next/server';

// In-memory trading state (in production, this would be synced with the engine)
export const tradingState = {
    isRunning: false,
    isAuthenticated: false,
    performance: {
        totalPnl: 0,
        todayPnl: 0,
        winRate: 0,
        totalTrades: 0,
    },
    strategy: {
        opportunitiesSeen: 0,
        opportunitiesFiltered: 0,
        tradesAttempted: 0,
        tradesSucceeded: 0,
        tradesFailed: 0,
    },
    activeTrades: [] as Array<{
        id: string;
        symbol: string;
        longExchange: string;
        shortExchange: string;
        entrySpread: number;
        currentSpread: number;
        entryPriceLong: number;
        entryPriceShort: number;
        positionSize: number;
        pnl: number;
        openedAt: string;
    }>,
    tradeHistory: [] as Array<{
        id: string;
        symbol: string;
        longExchange: string;
        shortExchange: string;
        entrySpread: number;
        exitSpread: number;
        pnl: number;
        duration: string;
        status: 'COMPLETED' | 'FAILED' | 'LIQUIDATED';
        closedAt: string;
    }>,
};

/**
 * Get trading stats
 * 
 * GET /api/trading/stats?token=xxx
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Verify token
    const secretToken = process.env.TRADING_SECRET_TOKEN;
    if (!secretToken || token !== secretToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Calculate win rate
    const totalTrades = tradingState.strategy.tradesSucceeded + tradingState.strategy.tradesFailed;
    tradingState.performance.winRate = totalTrades > 0
        ? (tradingState.strategy.tradesSucceeded / totalTrades) * 100
        : 0;
    tradingState.performance.totalTrades = totalTrades;

    return NextResponse.json(tradingState);
}
