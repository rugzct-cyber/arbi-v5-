'use client';

import { useState, useMemo } from 'react';
import type { PriceUpdate } from '@arbitrage/shared';
import styles from './AlertModal.module.css';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (
        symbol: string,
        buyExchange: string,
        sellExchange: string,
        threshold: number,
        direction: 'above' | 'below'
    ) => void;
    prices: Map<string, Map<string, PriceUpdate>>;
    exchanges: string[];
}

export function AlertModal({ isOpen, onClose, onSubmit, prices, exchanges }: AlertModalProps) {
    const [symbol, setSymbol] = useState('');
    const [buyExchange, setBuyExchange] = useState('');
    const [sellExchange, setSellExchange] = useState('');
    const [threshold, setThreshold] = useState('0.1');
    const [direction, setDirection] = useState<'above' | 'below'>('above');

    // Get available symbols from prices
    const symbols = useMemo(() => {
        return Array.from(prices.keys()).sort();
    }, [prices]);

    // Get available exchanges for selected symbol
    const availableExchanges = useMemo(() => {
        if (!symbol) return exchanges;
        const symbolPrices = prices.get(symbol);
        if (!symbolPrices) return exchanges;
        return Array.from(symbolPrices.keys()).sort();
    }, [symbol, prices, exchanges]);

    // Calculate current spread
    const currentSpread = useMemo(() => {
        if (!symbol || !buyExchange || !sellExchange) return null;
        const symbolPrices = prices.get(symbol);
        if (!symbolPrices) return null;

        const buy = symbolPrices.get(buyExchange);
        const sell = symbolPrices.get(sellExchange);
        if (!buy || !sell || buy.ask <= 0 || sell.bid <= 0) return null;

        return ((sell.bid - buy.ask) / buy.ask) * 100;
    }, [symbol, buyExchange, sellExchange, prices]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!symbol || !buyExchange || !sellExchange) return;

        const thresholdNum = parseFloat(threshold);
        if (isNaN(thresholdNum)) return;

        onSubmit(symbol, buyExchange, sellExchange, thresholdNum, direction);

        // Reset form
        setSymbol('');
        setBuyExchange('');
        setSellExchange('');
        setThreshold('0.1');
        setDirection('above');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>🔔 Create Spread Alert</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Symbol */}
                    <div className={styles.field}>
                        <label>Token</label>
                        <select
                            value={symbol}
                            onChange={e => {
                                setSymbol(e.target.value);
                                setBuyExchange('');
                                setSellExchange('');
                            }}
                            required
                        >
                            <option value="">Select token...</option>
                            {symbols.map(s => (
                                <option key={s} value={s}>{s.replace('-USD', '')}</option>
                            ))}
                        </select>
                    </div>

                    {/* Exchanges Row */}
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Buy on</label>
                            <select
                                value={buyExchange}
                                onChange={e => setBuyExchange(e.target.value)}
                                required
                                disabled={!symbol}
                            >
                                <option value="">Select...</option>
                                {availableExchanges
                                    .filter(ex => ex !== sellExchange)
                                    .map(ex => (
                                        <option key={ex} value={ex}>{ex}</option>
                                    ))}
                            </select>
                        </div>

                        <div className={styles.arrow}>→</div>

                        <div className={styles.field}>
                            <label>Sell on</label>
                            <select
                                value={sellExchange}
                                onChange={e => setSellExchange(e.target.value)}
                                required
                                disabled={!symbol}
                            >
                                <option value="">Select...</option>
                                {availableExchanges
                                    .filter(ex => ex !== buyExchange)
                                    .map(ex => (
                                        <option key={ex} value={ex}>{ex}</option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    {/* Current Spread Display */}
                    {currentSpread !== null && (
                        <div className={styles.currentSpread}>
                            Current spread: <span className={currentSpread >= 0 ? styles.positive : styles.negative}>
                                {currentSpread.toFixed(4)}%
                            </span>
                        </div>
                    )}

                    {/* Threshold Row */}
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Alert when spread is</label>
                            <select
                                value={direction}
                                onChange={e => setDirection(e.target.value as 'above' | 'below')}
                            >
                                <option value="above">≥ Above</option>
                                <option value="below">≤ Below</option>
                            </select>
                        </div>

                        <div className={styles.field}>
                            <label>Threshold (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={threshold}
                                onChange={e => setThreshold(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <div className={styles.actions}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={!symbol || !buyExchange || !sellExchange}
                        >
                            Create Alert
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
