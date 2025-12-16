'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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

    // Admin mode
    const searchParams = useSearchParams();
    const isAdmin = searchParams.get('admin') === 'true';

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
            .filter(item => isAdmin || item.exchanges.length >= 2)
            .map(item => {
                const validPrices = item.exchanges.filter(p => p.bid > 0 && p.ask > 0);

                // Allow single exchange or invalid prices in admin mode
                if (!isAdmin && validPrices.length < 2) {
                    return { ...item, spread: 0, buyExchange: '', sellExchange: '' };
                }

                // If admin and < 2 valid prices, we still want to show the row, but with 0 spread
                if (validPrices.length < 2) {
                    return { ...item, spread: 0, buyExchange: '', sellExchange: '' };
                }

                // Find the best spread among ALL pairs of exchanges
                let bestSpread = -Infinity;
                let bestBuyEx = '';
                let bestSellEx = '';

                // Test all combinations: buy on exchange A, sell on exchange B
                for (const buyEx of validPrices) {
                    for (const sellEx of validPrices) {
                        if (buyEx.exchange === sellEx.exchange) continue;

                        // Spread = (sell price - buy price) / buy price
                        // Buy at ask, sell at bid
                        const spread = ((sellEx.bid - buyEx.ask) / buyEx.ask) * 100;

                        if (spread > bestSpread) {
                            bestSpread = spread;
                            bestBuyEx = buyEx.exchange;
                            bestSellEx = sellEx.exchange;
                        }
                    }
                }

                if (!bestBuyEx || !bestSellEx) {
                    return { ...item, spread: 0, buyExchange: '', sellExchange: '' };
                }

                return {
                    ...item,
                    spread: Math.round(bestSpread * 10000) / 10000, // 4 decimals
                    buyExchange: bestBuyEx,
                    sellExchange: bestSellEx
                };
            })
            // Filter out rows with no valid spread (unless admin)
            .filter(item => isAdmin || (item.buyExchange && item.sellExchange))
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
                <colgroup>
                    <col style={{ width: '50px' }} />
                    <col style={{ width: '50px' }} />
                    <col style={{ width: '70px' }} />
                    {activeExchangeIds.map(exId => (
                        <col key={exId} />
                    ))}
                </colgroup>
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
                                                    <div><span className={styles.strategyLabel}>LONG </span><span className={styles.strategyExchange}>{buyExchange.toUpperCase()}</span></div>
                                                    <div><span className={styles.strategyLabel}>SHORT </span><span className={styles.strategyExchange}>{sellExchange.toUpperCase()}</span></div>
                                                </>
                                            ) : (
                                                <span className={styles.noPrice}>-</span>
                                            )}
                                        </div>
                                    </td>
                                    {activeExchangeIds.map(exId => {
                                        const price = exPrices.find(p => p.exchange === exId);
                                        const isLongExchange = exId === buyExchange;
                                        const isShortExchange = exId === sellExchange;
                                        return (
                                            <td key={exId} className={styles.tdPrice}>
                                                {price ? (
                                                    <div className={styles.priceCell}>
                                                        <span className={isLongExchange ? styles.askPriceHighlight : styles.askPriceGray}>
                                                            ${formatPrice(price.ask)}
                                                        </span>
                                                        <span className={isShortExchange ? styles.bidPriceHighlight : styles.bidPriceGray}>
                                                            ${formatPrice(price.bid)}
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
