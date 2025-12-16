'use client';

import { useMemo, useState } from 'react';
import type { PriceUpdate } from '@arbitrage/shared';
import { SpreadChart } from '@/components/SpreadChart/SpreadChart';
import styles from './Dashboard.module.css';

export interface FilteredPrice {
    symbol: string;
    exchanges: PriceUpdate[];
    spread: number;
    buyExchange: string;
    sellExchange: string;
}

interface PriceTableProps {
    prices: Map<string, Map<string, PriceUpdate>>;
    selectedExchanges: Set<string>;
    searchQuery: string;
    showFavoritesOnly: boolean;
    favorites: Set<string>;
    activeExchangeIds: string[];
    onFavoriteToggle: (symbol: string) => void;
}

// Helper function for price formatting
function formatPrice(p: number): string {
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    if (p >= 0.01) return p.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
    return p.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
}

export function PriceTable({
    prices,
    selectedExchanges,
    searchQuery,
    showFavoritesOnly,
    favorites,
    activeExchangeIds,
    onFavoriteToggle,
}: PriceTableProps) {
    // Sorting state
    const [sortColumn, setSortColumn] = useState<string>('spread');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Expanded row for chart
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    // Sort handler
    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'spread' ? 'desc' : 'asc');
        }
    };

    // Filter and calculate prices
    const filteredPrices = useMemo((): FilteredPrice[] => {
        return Array.from(prices.entries())
            .filter(([symbol]) => {
                if (searchQuery && !symbol.toLowerCase().includes(searchQuery.toLowerCase())) {
                    return false;
                }
                if (showFavoritesOnly && !favorites.has(symbol)) {
                    return false;
                }
                return true;
            })
            .map(([symbol, exchangePrices]) => ({
                symbol,
                exchanges: Array.from(exchangePrices.entries())
                    .filter(([exId]) => selectedExchanges.has(exId))
                    .map(([, price]) => price),
            }))
            .filter(item => item.exchanges.length >= 2)
            .map(item => {
                const validPrices = item.exchanges.filter(p => p.bid > 0 && p.ask > 0);
                if (validPrices.length < 2) {
                    return { ...item, spread: 0, buyExchange: '', sellExchange: '' };
                }

                const bestBuyEx = validPrices.reduce((a, b) => (a.ask < b.ask ? a : b));
                const bestSellEx = validPrices.reduce((a, b) => (a.bid > b.bid ? a : b));

                let finalBuyEx = bestBuyEx;
                let finalSellEx = bestSellEx;

                if (bestBuyEx.exchange === bestSellEx.exchange) {
                    const otherExchanges = validPrices.filter(p => p.exchange !== bestBuyEx.exchange);
                    if (otherExchanges.length > 0) {
                        finalSellEx = otherExchanges.reduce((a, b) => (a.bid > b.bid ? a : b));
                    } else {
                        return { ...item, spread: 0, buyExchange: '', sellExchange: '' };
                    }
                }

                const spread = finalBuyEx.ask > 0
                    ? ((finalSellEx.bid - finalBuyEx.ask) / finalBuyEx.ask * 100)
                    : 0;

                return {
                    ...item,
                    spread: Math.max(0, spread),
                    buyExchange: finalBuyEx.exchange,
                    sellExchange: finalSellEx.exchange
                };
            })
            .sort((a, b) => {
                if (sortColumn === 'pair') {
                    const comparison = a.symbol.localeCompare(b.symbol);
                    return sortDirection === 'asc' ? comparison : -comparison;
                } else if (sortColumn === 'spread') {
                    return sortDirection === 'asc' ? a.spread - b.spread : b.spread - a.spread;
                } else {
                    const aPrice = a.exchanges.find(p => p.exchange === sortColumn)?.bid || 0;
                    const bPrice = b.exchanges.find(p => p.exchange === sortColumn)?.bid || 0;
                    return sortDirection === 'asc' ? aPrice - bPrice : bPrice - aPrice;
                }
            });
    }, [prices, searchQuery, showFavoritesOnly, favorites, selectedExchanges, sortColumn, sortDirection]);

    return (
        <div className={styles.tableContainer}>
            <table className={styles.priceTable}>
                <thead>
                    <tr>
                        <th className={`${styles.thPair} ${styles.sortable}`} onClick={() => handleSort('pair')}>
                            PAIR {sortColumn === 'pair' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className={`${styles.thSpread} ${styles.sortable}`} onClick={() => handleSort('spread')}>
                            SPREAD {sortColumn === 'spread' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className={styles.thStrategy}>STRATEGY</th>
                        {activeExchangeIds.map(exId => (
                            <th
                                key={exId}
                                className={`${styles.thExchange} ${styles.sortable}`}
                                onClick={() => handleSort(exId)}
                            >
                                <span className={styles.exchangeHeader}>
                                    {exId.toUpperCase()} {sortColumn === exId && (sortDirection === 'asc' ? '↑' : '↓')}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filteredPrices.map(({ symbol, exchanges: exPrices, spread, buyExchange, sellExchange }) => {
                        const isExpanded = expandedRow === symbol;
                        return (
                            <>
                                <tr
                                    key={symbol}
                                    className={`${styles.tableRow} ${isExpanded ? styles.tableRowExpanded : ''}`}
                                    onClick={() => setExpandedRow(isExpanded ? null : symbol)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td className={styles.tdPair}>
                                        <div className={styles.pairContent}>
                                            <button
                                                className={`${styles.starBtn} ${favorites.has(symbol) ? styles.starBtnActive : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onFavoriteToggle(symbol);
                                                }}
                                            >
                                                {favorites.has(symbol) ? '★' : '☆'}
                                            </button>
                                            <span className={styles.pairSymbol}>{symbol.replace('-USD', '')}</span>
                                        </div>
                                    </td>
                                    <td className={`${styles.tdSpread} ${spread > 0.1 ? styles.spreadHigh : ''}`}>
                                        {spread.toFixed(4)}%
                                    </td>
                                    <td className={styles.tdStrategy}>
                                        <div className={styles.strategyContent}>
                                            {buyExchange && sellExchange ? (
                                                <>
                                                    <span className={styles.strategyLabel}>LONG</span>
                                                    <span className={styles.strategyExchange}>{buyExchange.toUpperCase()}</span>
                                                    <span className={styles.strategyLabel}>SHORT</span>
                                                    <span className={styles.strategyExchange}>{sellExchange.toUpperCase()}</span>
                                                </>
                                            ) : (
                                                <span className={styles.noPrice}>-</span>
                                            )}
                                        </div>
                                    </td>
                                    {activeExchangeIds.map(exId => {
                                        const price = exPrices.find(p => p.exchange === exId);
                                        return (
                                            <td key={exId} className={styles.tdPrice}>
                                                {price ? (
                                                    <div className={styles.priceCell}>
                                                        <span className={styles.bidPrice}>
                                                            ${formatPrice(price.bid)}
                                                        </span>
                                                        <span className={styles.priceSeparator}>/</span>
                                                        <span className={styles.askPrice}>
                                                            ${formatPrice(price.ask)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className={styles.noPrice}>-</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                                {isExpanded && buyExchange && sellExchange && (
                                    <tr key={`${symbol}-chart`} className={styles.chartRow}>
                                        <td colSpan={3 + activeExchangeIds.length}>
                                            <SpreadChart
                                                symbol={symbol}
                                                buyExchange={buyExchange}
                                                sellExchange={sellExchange}
                                                currentSpread={spread}
                                                onClose={() => setExpandedRow(null)}
                                            />
                                        </td>
                                    </tr>
                                )}
                            </>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
