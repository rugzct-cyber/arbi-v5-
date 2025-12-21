import { NextRequest, NextResponse } from 'next/server';

// In-memory state for bot control
let botState = {
    isRunning: false,
};

/**
 * Trading bot control
 * 
 * POST /api/trading/control?token=xxx&action=start|stop
 */
export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const action = searchParams.get('action');

    // Verify token
    const secretToken = process.env.TRADING_SECRET_TOKEN;
    if (!secretToken || token !== secretToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!action || !['start', 'stop'].includes(action)) {
        return NextResponse.json(
            { error: 'Invalid action. Use: start or stop' },
            { status: 400 }
        );
    }

    if (action === 'start') {
        if (botState.isRunning) {
            return NextResponse.json({ error: 'Bot already running' }, { status: 400 });
        }

        botState.isRunning = true;
        console.log('[Trading API] 🟢 Bot started');
        return NextResponse.json({ success: true, message: 'Bot started' });
    }

    if (action === 'stop') {
        if (!botState.isRunning) {
            return NextResponse.json({ error: 'Bot not running' }, { status: 400 });
        }

        botState.isRunning = false;
        console.log('[Trading API] 🔴 Bot stopped');
        return NextResponse.json({ success: true, message: 'Bot stopped' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
