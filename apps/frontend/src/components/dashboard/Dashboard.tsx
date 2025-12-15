'use client';

import { useState, useMemo } from 'react';
import type { PriceUpdate, ArbitrageOpportunity } from '@arbitrage/shared';
import { Sidebar } from '@/components/Sidebar';
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
            // Calculate spread for each item
            .map(item => {
                const allPrices = item.exchanges.map(p => p.bid).filter(p => p > 0);
                const minPrice = Math.min(...allPrices);
                const maxPrice = Math.max(...allPrices);
                const spread = minPrice > 0 ? ((maxPrice - minPrice) / minPrice * 100) : 0;
                return { ...item, spread };
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
                                <span className={styles.lastRefresh}>
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
                                {filteredPrices.map(({ symbol, exchanges: exPrices }) => {
                                    // Calculate spread
                                    const allPrices = exPrices.map(p => p.bid).filter(p => p > 0);
                                    const minPrice = Math.min(...allPrices);
                                    const maxPrice = Math.max(...allPrices);
                                    const spread = minPrice > 0 ? ((maxPrice - minPrice) / minPrice * 100) : 0;

                                    // Find best buy/sell
                                    const bestBuyEx = exPrices.reduce((a, b) => (a.ask < b.ask ? a : b), exPrices[0]);
                                    const bestSellEx = exPrices.reduce((a, b) => (a.bid > b.bid ? a : b), exPrices[0]);

                                    return (
                                        <tr key={symbol} className={styles.tableRow}>
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
                                                    <span className={styles.strategyLabel}>LONG</span>
                                                    <span className={styles.strategyExchange}>{bestBuyEx?.exchange?.toUpperCase()}</span>
                                                    <span className={styles.strategyLabel}>SHORT</span>
                                                    <span className={styles.strategyExchange}>{bestSellEx?.exchange?.toUpperCase()}</span>
                                                </div>
                                            </td>
                                            {activeExchangeIds.map(exId => {
                                                const price = exPrices.find(p => p.exchange === exId);
                                                return (
                                                    <td key={exId} className={styles.tdPrice}>
                                                        {price ? (
                                                            <div className={styles.priceCell}>
                                                                <span className={styles.bidPrice}>
                                                                    ${price.bid.toLocaleString('en-US', {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2
                                                                    })}
                                                                </span>
                                                                <span className={styles.priceSeparator}>/</span>
                                                                <span className={styles.askPrice}>
                                                                    ${price.ask.toLocaleString('en-US', {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2
                                                                    })}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className={styles.noPrice}>-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Opportunities Section (Condensed) */}
                {opportunities.length > 0 && (
                    <section className={styles.opportunitiesSection}>
                        <h2 className={styles.sectionTitle}>
                            🎯 Live Opportunities
                            <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>
                                {opportunities.length}
                            </span>
                        </h2>
                        <div className={styles.opportunitiesList}>
                            {opportunities.slice(0, 5).map((opp) => (
                                <div key={opp.id} className={styles.opportunityCard}>
                                    <strong>{opp.symbol}</strong>
                                    <span>{opp.buyExchange} → {opp.sellExchange}</span>
                                    <span className="price-up">{opp.spreadPercent.toFixed(3)}%</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
