'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
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

    // Token search state
    const [tokenSearch, setTokenSearch] = useState('');
    const [showTokenDropdown, setShowTokenDropdown] = useState(false);
    const tokenInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Get available symbols from prices
    const symbols = useMemo(() => {
        return Array.from(prices.keys()).sort();
    }, [prices]);

    // Filter symbols based on search
    const filteredSymbols = useMemo(() => {
        if (!tokenSearch) return symbols;
        const search = tokenSearch.toLowerCase();
        return symbols.filter(s =>
            s.toLowerCase().includes(search) ||
            s.replace('-USD', '').toLowerCase().includes(search)
        );
    }, [symbols, tokenSearch]);

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

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowTokenDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectToken = (s: string) => {
        setSymbol(s);
        setTokenSearch(s.replace('-USD', ''));
        setShowTokenDropdown(false);
        setExchangeA('');
        setExchangeB('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!symbol || !exchangeA || !exchangeB) return;

        const thresholdNum = parseFloat(threshold);
        if (isNaN(thresholdNum)) return;

        onSubmit(symbol, exchangeA, exchangeB, thresholdNum);

        // Reset form
        setSymbol('');
        setTokenSearch('');
        setExchangeA('');
        setExchangeB('');
        setThreshold('0.1');
        onClose();
    };

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setSymbol('');
            setTokenSearch('');
            setExchangeA('');
            setExchangeB('');
            setThreshold('0.1');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>🔔 Create Spread Alert</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Token Search */}
                    <div className={styles.field} ref={dropdownRef}>
                        <label>Token</label>
                        <input
                            ref={tokenInputRef}
                            type="text"
                            value={tokenSearch}
                            onChange={e => {
                                setTokenSearch(e.target.value);
                                setShowTokenDropdown(true);
                                if (!e.target.value) setSymbol('');
                            }}
                            onFocus={() => setShowTokenDropdown(true)}
                            placeholder="Search token..."
                            autoComplete="off"
                        />
                        {showTokenDropdown && (
                            <div className={styles.dropdown}>
                                {filteredSymbols.length === 0 ? (
                                    <div className={styles.dropdownEmpty}>No tokens found</div>
                                ) : (
                                    filteredSymbols.slice(0, 10).map(s => (
                                        <div
                                            key={s}
                                            className={`${styles.dropdownItem} ${symbol === s ? styles.selected : ''}`}
                                            onClick={() => handleSelectToken(s)}
                                        >
                                            {s.replace('-USD', '')}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Exchanges Row */}
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Exchange</label>
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

                        <div className={styles.arrow}>/</div>

                        <div className={styles.field}>
                            <label>Exchange</label>
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
                            Current spread: <span className={currentSpread.spread >= 0 ? styles.positive : styles.negative}>
                                {currentSpread.spread.toFixed(4)}%
                            </span>
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
