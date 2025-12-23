/**
 * Trade Persistence Service
 * 
 * Persists trades and bot state to Supabase for:
 * - Recovery after engine restart
 * - Historical analysis
 * - Audit trail
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ArbitrageTrade, TradeStatus } from './types.js';

interface TradeRow {
    id: string;
    symbol: string;
    long_exchange: string;
    short_exchange: string;
    entry_price_long: number;
    entry_price_short: number;
    exit_price_long: number | null;
    exit_price_short: number | null;
    quantity: number;
    entry_spread: number;
    exit_spread: number | null;
    status: TradeStatus;
    pnl: number | null;
    error: string | null;
    created_at: string;
    executed_at: string | null;
    closed_at: string | null;
}

interface BotConfigRow {
    id: string;
    paper_mode: boolean;
    enabled: boolean;
    min_spread_percent: number;
    max_spread_percent: number;
    max_position_size_usd: number;
    max_total_exposure_usd: number;
    verify_with_rest: boolean;
    updated_at: string;
}

export class TradePersistence {
    private supabase: SupabaseClient | null = null;
    private enabled: boolean = false;

    constructor() {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY;

        if (url && key) {
            this.supabase = createClient(url, key);
            this.enabled = true;
            console.log('[TradePersistence] Connected to Supabase');
        } else {
            console.warn('[TradePersistence] Supabase not configured - trades will not be persisted');
        }
    }

    /**
     * Save a new trade to the database
     */
    async saveTrade(trade: ArbitrageTrade): Promise<void> {
        if (!this.enabled || !this.supabase) return;

        try {
            const row: Partial<TradeRow> = {
                id: trade.id,
                symbol: trade.symbol,
                long_exchange: trade.longExchange,
                short_exchange: trade.shortExchange,
                entry_price_long: trade.entryPriceLong,
                entry_price_short: trade.entryPriceShort,
                exit_price_long: trade.exitPriceLong || null,
                exit_price_short: trade.exitPriceShort || null,
                quantity: trade.quantity,
                entry_spread: trade.entrySpread,
                exit_spread: trade.exitSpread || null,
                status: trade.status,
                pnl: trade.pnl || null,
                error: trade.error || null,
                created_at: new Date(trade.createdAt).toISOString(),
                executed_at: trade.executedAt ? new Date(trade.executedAt).toISOString() : null,
                closed_at: trade.closedAt ? new Date(trade.closedAt).toISOString() : null,
            };

            const { error } = await this.supabase
                .from('trades')
                .upsert(row);

            if (error) {
                console.error('[TradePersistence] Error saving trade:', error);
            } else {
                console.log(`[TradePersistence] Trade ${trade.id} saved`);
            }
        } catch (e) {
            console.error('[TradePersistence] Exception saving trade:', e);
        }
    }

    /**
     * Update trade status
     */
    async updateTradeStatus(tradeId: string, status: TradeStatus, updates: Partial<ArbitrageTrade> = {}): Promise<void> {
        if (!this.enabled || !this.supabase) return;

        try {
            const updateData: Partial<TradeRow> = { status };

            if (updates.pnl !== undefined) updateData.pnl = updates.pnl;
            if (updates.exitPriceLong !== undefined) updateData.exit_price_long = updates.exitPriceLong;
            if (updates.exitPriceShort !== undefined) updateData.exit_price_short = updates.exitPriceShort;
            if (updates.exitSpread !== undefined) updateData.exit_spread = updates.exitSpread;
            if (updates.error !== undefined) updateData.error = updates.error;
            if (updates.closedAt !== undefined) updateData.closed_at = new Date(updates.closedAt).toISOString();

            const { error } = await this.supabase
                .from('trades')
                .update(updateData)
                .eq('id', tradeId);

            if (error) {
                console.error('[TradePersistence] Error updating trade:', error);
            }
        } catch (e) {
            console.error('[TradePersistence] Exception updating trade:', e);
        }
    }

    /**
     * Load active trades (for recovery after restart)
     */
    async loadActiveTrades(): Promise<ArbitrageTrade[]> {
        if (!this.enabled || !this.supabase) return [];

        try {
            const { data, error } = await this.supabase
                .from('trades')
                .select('*')
                .in('status', ['PENDING', 'EXECUTING', 'ACTIVE'])
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[TradePersistence] Error loading active trades:', error);
                return [];
            }

            return (data || []).map(row => this.rowToTrade(row));
        } catch (e) {
            console.error('[TradePersistence] Exception loading trades:', e);
            return [];
        }
    }

    /**
     * Load recent trade history
     */
    async loadTradeHistory(limit = 100): Promise<ArbitrageTrade[]> {
        if (!this.enabled || !this.supabase) return [];

        try {
            const { data, error } = await this.supabase
                .from('trades')
                .select('*')
                .in('status', ['COMPLETED', 'FAILED', 'CANCELLED'])
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('[TradePersistence] Error loading trade history:', error);
                return [];
            }

            return (data || []).map(row => this.rowToTrade(row));
        } catch (e) {
            console.error('[TradePersistence] Exception loading history:', e);
            return [];
        }
    }

    /**
     * Convert DB row to ArbitrageTrade
     */
    private rowToTrade(row: TradeRow): ArbitrageTrade {
        return {
            id: row.id,
            symbol: row.symbol,
            longExchange: row.long_exchange,
            shortExchange: row.short_exchange,
            entryPriceLong: row.entry_price_long,
            entryPriceShort: row.entry_price_short,
            exitPriceLong: row.exit_price_long || undefined,
            exitPriceShort: row.exit_price_short || undefined,
            quantity: row.quantity,
            entrySpread: row.entry_spread,
            exitSpread: row.exit_spread || undefined,
            status: row.status,
            pnl: row.pnl || undefined,
            error: row.error || undefined,
            createdAt: new Date(row.created_at).getTime(),
            executedAt: row.executed_at ? new Date(row.executed_at).getTime() : undefined,
            closedAt: row.closed_at ? new Date(row.closed_at).getTime() : undefined,
        };
    }

    /**
     * Check if persistence is enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }
}
