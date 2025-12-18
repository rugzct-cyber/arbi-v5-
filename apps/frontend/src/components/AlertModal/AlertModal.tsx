'use client';

import { useState, useMemo } from 'react';
import type { PriceUpdate } from '@arbitrage/shared';
import styles from './AlertModal.module.css';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (
        symbol: string,
        exchangeA: string,
        exchangeB: string,
        threshold: number
    ) => void;
    prices: Map<string, Map<string, PriceUpdate>>;
    exchanges: string[];
}

export function AlertModal({ isOpen, onClose, onSubmit, prices, exchanges }: AlertModalProps) {
    const [symbol, setSymbol] = useState('');
    const [exchangeA, setExchangeA] = useState('');
    const [exchangeB, setExchangeB] = useState('');
    const [threshold, setThreshold] = useState('0.1');

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

    // Calculate current spread (best of both directions)
    const currentSpread = useMemo(() => {
        if (!symbol || !exchangeA || !exchangeB) return null;
        const symbolPrices = prices.get(symbol);
        if (!symbolPrices) return null;

        const priceA = symbolPrices.get(exchangeA);
        const priceB = symbolPrices.get(exchangeB);
        if (!priceA || !priceB) return null;
        if (priceA.ask <= 0 || priceA.bid <= 0 || priceB.ask <= 0 || priceB.bid <= 0) return null;

        // Calculate both directions
        const spreadAtoB = ((priceB.bid - priceA.ask) / priceA.ask) * 100;
        const spreadBtoA = ((priceA.bid - priceB.ask) / priceB.ask) * 100;

        // Return best spread with direction
        if (spreadAtoB >= spreadBtoA) {
            return { spread: spreadAtoB, direction: `${exchangeA}→${exchangeB}` };
        } else {
            return { spread: spreadBtoA, direction: `${exchangeB}→${exchangeA}` };
        }
    }, [symbol, exchangeA, exchangeB, prices]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!symbol || !exchangeA || !exchangeB) return;

        const thresholdNum = parseFloat(threshold);
        if (isNaN(thresholdNum)) return;

        onSubmit(symbol, exchangeA, exchangeB, thresholdNum);

        // Reset form
        setSymbol('');
        setExchangeA('');
        setExchangeB('');
        setThreshold('0.1');
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
                                setExchangeA('');
                                setExchangeB('');
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
                            <label>Exchange A</label>
                            <select
                                value={exchangeA}
                                onChange={e => setExchangeA(e.target.value)}
                                required
                                disabled={!symbol}
                            >
                                <option value="">Select...</option>
                                {availableExchanges
                                    .filter(ex => ex !== exchangeB)
                                    .map(ex => (
                                        <option key={ex} value={ex}>{ex}</option>
                                    ))}
                            </select>
                        </div>

                        <div className={styles.arrow}>⇄</div>

                        <div className={styles.field}>
                            <label>Exchange B</label>
                            <select
                                value={exchangeB}
                                onChange={e => setExchangeB(e.target.value)}
                                required
                                disabled={!symbol}
                            >
                                <option value="">Select...</option>
                                {availableExchanges
                                    .filter(ex => ex !== exchangeA)
                                    .map(ex => (
                                        <option key={ex} value={ex}>{ex}</option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    {/* Current Spread Display */}
                    {currentSpread !== null && (
                        <div className={styles.currentSpread}>
                            Best spread: <span className={currentSpread.spread >= 0 ? styles.positive : styles.negative}>
                                {currentSpread.spread.toFixed(4)}%
                            </span>
                            <span className={styles.direction}>({currentSpread.direction})</span>
                        </div>
                    )}

                    {/* Threshold */}
                    <div className={styles.field}>
                        <label>Alert when spread ≥ (%)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={threshold}
                            onChange={e => setThreshold(e.target.value)}
                            required
                            placeholder="0.1"
                        />
                    </div>

                    {/* Submit */}
                    <div className={styles.actions}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={!symbol || !exchangeA || !exchangeB}
                        >
                            Create Alert
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
