-- Trades table for storing all trade records
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    long_exchange TEXT NOT NULL,
    short_exchange TEXT NOT NULL,
    entry_price_long DECIMAL(18, 8) NOT NULL DEFAULT 0,
    entry_price_short DECIMAL(18, 8) NOT NULL DEFAULT 0,
    exit_price_long DECIMAL(18, 8),
    exit_price_short DECIMAL(18, 8),
    quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
    entry_spread DECIMAL(10, 6) NOT NULL DEFAULT 0,
    exit_spread DECIMAL(10, 6),
    status TEXT NOT NULL DEFAULT 'PENDING',
    pnl DECIMAL(18, 8),
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- Index for loading active trades quickly
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);

-- Bot configuration table
CREATE TABLE IF NOT EXISTS bot_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    paper_mode BOOLEAN NOT NULL DEFAULT TRUE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    min_spread_percent DECIMAL(10, 4) NOT NULL DEFAULT 0.2,
    max_spread_percent DECIMAL(10, 4) NOT NULL DEFAULT 5.0,
    max_position_size_usd DECIMAL(18, 2) NOT NULL DEFAULT 100,
    max_total_exposure_usd DECIMAL(18, 2) NOT NULL DEFAULT 500,
    verify_with_rest BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default config
INSERT INTO bot_config (id, paper_mode, enabled)
VALUES ('default', TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Trade events log for audit trail
CREATE TABLE IF NOT EXISTS trade_events (
    id SERIAL PRIMARY KEY,
    trade_id TEXT NOT NULL REFERENCES trades(id),
    event_type TEXT NOT NULL,
    event_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_events_trade_id ON trade_events(trade_id);

-- Enable RLS
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_events ENABLE ROW LEVEL SECURITY;

-- Policy for service role (full access)
CREATE POLICY "Service role full access to trades" ON trades
    FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access to bot_config" ON bot_config
    FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access to trade_events" ON trade_events
    FOR ALL USING (TRUE) WITH CHECK (TRUE);
