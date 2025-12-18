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
    isLoading?: boolean;
}

// Helper function for price formatting (removes trailing zeros)
function formatPrice(p: number): string {
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    if (p >= 0.01) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

export function PriceTable({
    prices,
    selectedExchanges,
    searchQuery,
    showFavoritesOnly,
    favorites,
    activeExchangeIds,
    onFavoriteToggle,
    isLoading = false,
}: PriceTableProps) {
    // Sorting state
    const [sortColumn, setSortColumn] = useState<string>('spread');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [sortTrigger, setSortTrigger] = useState<number>(0); // Triggers re-sort only on click

    // Expanded row for chart
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    // Admin mode
    const searchParams = useSearchParams();
    const isAdmin = searchParams.get('admin') === 'true';

    // Sort handler - now also triggers the sort
    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'spread' ? 'desc' : 'asc');
        }
        setSortTrigger(prev => prev + 1); // Trigger re-sort
    };

    // Calculate prices WITHOUT sorting (updates with data)
    const calculatedPrices = useMemo((): FilteredPrice[] => {
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
            .filter(item => isAdmin || (item.buyExchange && item.sellExchange));
    }, [prices, searchQuery, showFavoritesOnly, favorites, selectedExchanges, isAdmin]);

    // Sorted order - only changes when user clicks a column (sortTrigger changes)
    const [sortedSymbols, setSortedSymbols] = useState<string[]>([]);

    // Update sorted order only on sortTrigger change or when new symbols appear
    useMemo(() => {
        const sorted = [...calculatedPrices].sort((a, b) => {
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
        setSortedSymbols(sorted.map(p => p.symbol));
    }, [sortTrigger, sortColumn, sortDirection]);

    // Final display: use sorted order but with fresh data
    const filteredPrices = useMemo((): FilteredPrice[] => {
        // Create a map for quick lookup
        const priceMap = new Map(calculatedPrices.map(p => [p.symbol, p]));

        // If we have a sorted order, use it
        if (sortedSymbols.length > 0) {
            const result: FilteredPrice[] = [];
            for (const symbol of sortedSymbols) {
                const price = priceMap.get(symbol);
                if (price) result.push(price);
            }
            // Add any new symbols that aren't in sortedSymbols yet
            for (const price of calculatedPrices) {
                if (!sortedSymbols.includes(price.symbol)) {
                    result.push(price);
                }
            }
            return result;
        }

        // Initial load: sort by spread desc
        return [...calculatedPrices].sort((a, b) => b.spread - a.spread);
    }, [calculatedPrices, sortedSymbols]);


    const handleDebug = () => {
        console.log('=== DEBUG NADO ===');
        console.log('Selected Exchanges:', Array.from(selectedExchanges));
        console.log('Active Exchange IDs:', activeExchangeIds);
        const btc = calculatedPrices.find(p => p.symbol === 'BTC');
        if (btc) {
            console.log('BTC Row Exchanges:', btc.exchanges);
            const nado = btc.exchanges.find(e => e.exchange === 'nado');
            console.log('Nado found in BTC:', nado);
        } else {
            console.log('BTC Row not found in calculatedPrices');
        }
    };

    return (
        <div className={styles.tableContainer}>
            <table className={styles.priceTable}>
                <colgroup>
                    <col style={{ width: '60px' }} />
                    <col style={{ width: '60px' }} />
                    <col style={{ width: '100px' }} />
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
                    {isLoading ? (
                        // Skeleton rows
                        Array.from({ length: 10 }).map((_, i) => (
                            <tr key={`skeleton-${i}`} className={styles.skeletonRow}>
                                <td className={styles.tdPair}>
                                    <div className={styles.skeletonPair}>
                                        <div className={styles.skeletonStar} />
                                        <div className={styles.skeletonText} style={{ width: '50px' }} />
                                    </div>
                                </td>
                                <td className={styles.tdSpread}>
                                    <div className={styles.skeletonCell}>
                                        <div className={styles.skeletonText} style={{ width: '60px' }} />
                                    </div>
                                </td>
                                <td className={styles.tdStrategy}>
                                    <div className={styles.skeletonStrategy}>
                                        <div className={styles.skeletonTextSm} style={{ width: '55px' }} />
                                        <div className={styles.skeletonTextSm} style={{ width: '55px' }} />
                                    </div>
                                </td>
                                {activeExchangeIds.map(exId => (
                                    <td key={exId} className={styles.tdPrice}>
                                        <div className={styles.skeletonPrice}>
                                            <div className={styles.skeletonTextSm} style={{ width: '70px' }} />
                                            <div className={styles.skeletonTextSm} style={{ width: '70px' }} />
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : (
                        filteredPrices.map(({ symbol, exchanges: exPrices, spread, buyExchange, sellExchange }) => {
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
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
