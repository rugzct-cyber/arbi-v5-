'use client';

import { useState, useMemo } from 'react';
import type { PriceUpdate, ArbitrageOpportunity } from '@arbitrage/shared';
import { Sidebar } from '@/components/Sidebar';
import { SpreadChart } from '@/components/SpreadChart/SpreadChart';
import styles from './Dashboard.module.css';

interface ExchangeStatus {
    id: string;
    connected: boolean;
}

interface DashboardProps {
    isConnected: boolean;
    prices: Map<string, Map<string, PriceUpdate>>;
    opportunities: ArbitrageOpportunity[];
    exchanges: ExchangeStatus[];
    lastRefresh: Date;
    onRefresh: () => void;
}

export function Dashboard({
    isConnected,
    prices,
    opportunities,
    exchanges,
    lastRefresh,
    onRefresh
}: DashboardProps) {
    // State for filtering
    const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(() => {
        return new Set(exchanges.map(e => e.id));
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [favorites, setFavorites] = useState<Set<string>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('favorites');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        }
        return new Set();
    });
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    // Expanded row for chart
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    // Sorting state - can sort by 'pair', 'spread', or an exchange id
    const [sortColumn, setSortColumn] = useState<string>('spread');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Update selectedExchanges when exchanges list changes
    useMemo(() => {
        if (exchanges.length > 0 && selectedExchanges.size === 0) {
            setSelectedExchanges(new Set(exchanges.map(e => e.id)));
        }
    }, [exchanges]);

    // Handlers
    const handleExchangeToggle = (exchangeId: string) => {
        setSelectedExchanges(prev => {
            const next = new Set(prev);
            if (next.has(exchangeId)) {
                next.delete(exchangeId);
            } else {
                next.add(exchangeId);
            }
            return next;
        });
    };

    const handleFavoriteToggle = (symbol: string) => {
        setFavorites(prev => {
            const next = new Set(prev);
            if (next.has(symbol)) {
                next.delete(symbol);
            } else {
                next.add(symbol);
            }
            localStorage.setItem('favorites', JSON.stringify([...next]));
            return next;
        });
    };

    // Sort handler
    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            // Default descending for spread, ascending for others
            setSortDirection(column === 'spread' ? 'desc' : 'asc');
        }
    };

    // Filter prices based on search and favorites
    const filteredPrices = useMemo(() => {
        return Array.from(prices.entries())
            .filter(([symbol]) => {
                // Search filter
                if (searchQuery && !symbol.toLowerCase().includes(searchQuery.toLowerCase())) {
                    return false;
                }
                // Favorites filter
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
            // Only show symbols present on at least 2 exchanges (for arbitrage)
            .filter(item => item.exchanges.length >= 2)
            // Calculate cross-exchange arbitrage spread for each item
            .map(item => {
                // Find best buy (lowest ask) and best sell (highest bid)
                const validPrices = item.exchanges.filter(p => p.bid > 0 && p.ask > 0);
                if (validPrices.length < 2) {
                    return { ...item, spread: 0, buyExchange: '', sellExchange: '' };
                }

                const bestBuyEx = validPrices.reduce((a, b) => (a.ask < b.ask ? a : b));
                const bestSellEx = validPrices.reduce((a, b) => (a.bid > b.bid ? a : b));

                // If same exchange, find alternative
                let finalBuyEx = bestBuyEx;
                let finalSellEx = bestSellEx;

                if (bestBuyEx.exchange === bestSellEx.exchange) {
                    const otherExchanges = validPrices.filter(p => p.exchange !== bestBuyEx.exchange);
                    if (otherExchanges.length > 0) {
                        // Keep best buy, find alternative sell from other exchanges
                        finalSellEx = otherExchanges.reduce((a, b) => (a.bid > b.bid ? a : b));
                    } else {
                        return { ...item, spread: 0, buyExchange: '', sellExchange: '' };
                    }
                }

                // True arbitrage spread: (sell bid - buy ask) / buy ask
                const spread = finalBuyEx.ask > 0
                    ? ((finalSellEx.bid - finalBuyEx.ask) / finalBuyEx.ask * 100)
                    : 0;

                return {
                    ...item,
                    spread: Math.max(0, spread), // Don't show negative spreads
                    buyExchange: finalBuyEx.exchange,
                    sellExchange: finalSellEx.exchange
                };
            })
            // Sort based on selected column
            .sort((a, b) => {
                if (sortColumn === 'pair') {
                    const comparison = a.symbol.localeCompare(b.symbol);
                    return sortDirection === 'asc' ? comparison : -comparison;
                } else if (sortColumn === 'spread') {
                    return sortDirection === 'asc' ? a.spread - b.spread : b.spread - a.spread;
                } else {
                    // Sort by exchange bid price
                    const aPrice = a.exchanges.find(p => p.exchange === sortColumn)?.bid || 0;
                    const bPrice = b.exchanges.find(p => p.exchange === sortColumn)?.bid || 0;
                    return sortDirection === 'asc' ? aPrice - bPrice : bPrice - aPrice;
                }
            });
    }, [prices, searchQuery, showFavoritesOnly, favorites, selectedExchanges, sortColumn, sortDirection]);

    // Get all unique exchanges from current data for table headers
    const activeExchangeIds = useMemo(() => {
        return Array.from(selectedExchanges).filter(exId =>
            exchanges.some(e => e.id === exId)
        );
    }, [selectedExchanges, exchanges]);

    return (
        <div className={styles.dashboardLayout}>
            {/* Sidebar */}
            <Sidebar
                exchanges={exchanges}
                selectedExchanges={selectedExchanges}
                onExchangeToggle={handleExchangeToggle}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                favorites={favorites}
                onFavoriteToggle={handleFavoriteToggle}
                showFavoritesOnly={showFavoritesOnly}
                onShowFavoritesToggle={() => setShowFavoritesOnly(!showFavoritesOnly)}
            />

            {/* Main Content */}
            <div className={styles.mainContent}>
                {/* Header */}
                <header className={styles.header}>
                    <div className={styles.headerContent}>
                        <h1 className={styles.title}>
                            <span className={styles.logo}>⚡</span>
                            Arbitrage v5
                        </h1>
                        <nav className={styles.nav}>
                            <a href="#" className={styles.navLink}>Dashboard</a>
                            <a href="#" className={styles.navLinkInactive}>Metrics</a>
                            <a href="#" className={styles.navLinkInactive}>Ref Links</a>
                        </nav>
                        <div className={styles.headerRight}>
                            <div className={styles.refreshSection}>
                                <span className={styles.lastRefresh} suppressHydrationWarning>
                                    Updated: {lastRefresh.toLocaleTimeString()}
                                </span>
                                <button
                                    className={styles.refreshBtn}
                                    onClick={onRefresh}
                                    title="Refresh prices"
                                >
                                    🔄 Refresh
                                </button>
                            </div>
                            <div className={styles.status}>
                                <span className={`status-dot ${isConnected ? 'status-connected' : 'status-disconnected'}`} />
                                {isConnected ? 'Connected' : 'Disconnected'}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Price Table */}
                <section className={styles.section}>
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
                                                            onClick={() => handleFavoriteToggle(symbol)}
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
                                                            {price ? (() => {
                                                                // Dynamic decimal formatting based on price magnitude
                                                                const formatPrice = (p: number) => {
                                                                    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                                    if (p >= 1) return p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
                                                                    if (p >= 0.01) return p.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
                                                                    return p.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
                                                                };
                                                                return (
                                                                    <div className={styles.priceCell}>
                                                                        <span className={styles.bidPrice}>
                                                                            ${formatPrice(price.bid)}
                                                                        </span>
                                                                        <span className={styles.priceSeparator}>/</span>
                                                                        <span className={styles.askPrice}>
                                                                            ${formatPrice(price.ask)}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })() : (
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
                </section>


            </div>
        </div>
    );
}
