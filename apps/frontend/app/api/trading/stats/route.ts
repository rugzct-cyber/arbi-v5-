import { NextRequest, NextResponse } from 'next/server';

// In-memory trading state (in production, this would be in the engine)
let tradingState = {
    isRunning: false,
    isAuthenticated: false,
    strategy: {
        opportunitiesSeen: 0,
        opportunitiesFiltered: 0,
        tradesAttempted: 0,
        tradesSucceeded: 0,
        tradesFailed: 0,
    },
    activeTrades: [] as any[],
    tradeHistory: [] as any[],
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

    // In a real implementation, this would fetch from the engine
    // For now, return the in-memory state
    return NextResponse.json(tradingState);
}

// Export state for other modules
export function updateTradingState(updates: Partial<typeof tradingState>) {
    tradingState = { ...tradingState, ...updates };
}

export function getTradingState() {
    return tradingState;
}
