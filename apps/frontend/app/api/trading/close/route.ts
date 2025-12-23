import { NextRequest, NextResponse } from 'next/server';
import { tradingState } from '../stats/route';

/**
 * Close an active trade
 * 
 * POST /api/trading/close?token=xxx&tradeId=xxx
 */
export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const tradeId = searchParams.get('tradeId');

    // Verify token
    const secretToken = process.env.TRADING_SECRET_TOKEN;
    if (!secretToken || token !== secretToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!tradeId) {
        return NextResponse.json({ error: 'Trade ID required' }, { status: 400 });
    }

    // Find the trade
    const tradeIndex = tradingState.activeTrades.findIndex(t => t.id === tradeId);

    if (tradeIndex === -1) {
        return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const trade = tradingState.activeTrades[tradeIndex];

    // Move to history
    tradingState.tradeHistory.unshift({
        id: trade.id,
        symbol: trade.symbol,
        longExchange: trade.longExchange,
        shortExchange: trade.shortExchange,
        entrySpread: trade.entrySpread,
        exitSpread: trade.currentSpread,
        pnl: trade.pnl,
        duration: calculateDuration(trade.openedAt),
        status: 'COMPLETED',
        closedAt: new Date().toISOString(),
    });

    // Remove from active
    tradingState.activeTrades.splice(tradeIndex, 1);

    // Update performance
    if (trade.pnl >= 0) {
        tradingState.strategy.tradesSucceeded++;
    } else {
        tradingState.strategy.tradesFailed++;
    }
    tradingState.performance.totalPnl += trade.pnl;
    tradingState.performance.todayPnl += trade.pnl;

    return NextResponse.json({
        success: true,
        message: `Trade ${tradeId} closed`,
        pnl: trade.pnl
    });
}

function calculateDuration(openedAt: string): string {
    const start = new Date(openedAt).getTime();
    const now = Date.now();
    const diffMs = now - start;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}
