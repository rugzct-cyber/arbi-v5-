import { NextRequest, NextResponse } from 'next/server';
import { tradingState } from '../state';

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
