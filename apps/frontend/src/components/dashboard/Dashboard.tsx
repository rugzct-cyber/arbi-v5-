'use client';

import type { PriceUpdate, ArbitrageOpportunity } from '@arbitrage/shared';
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
}

export function Dashboard({
    isConnected,
    prices,
    opportunities,
    exchanges
}: DashboardProps) {
    const priceArray = Array.from(prices.entries()).map(([symbol, exchangePrices]) => ({
        symbol,
        exchanges: Array.from(exchangePrices.values()),
    }));

    return (
        <div className={styles.dashboard}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <h1 className={styles.title}>
                        <span className={styles.logo}>⚡</span>
                        Arbitrage v5
                    </h1>
                    <div className={styles.status}>
                        <span className={`status-dot ${isConnected ? 'status-connected' : 'status-disconnected'}`} />
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                </div>
            </header>

            {/* Exchange Status */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Exchanges</h2>
                <div className={styles.exchangeGrid}>
                    {exchanges.map((exchange) => (
                        <div key={exchange.id} className={`card ${styles.exchangeCard}`}>
                            <span className={`status-dot ${exchange.connected ? 'status-connected' : 'status-disconnected'}`} />
                            <span className={styles.exchangeName}>{exchange.id}</span>
                            <span className={`badge ${exchange.connected ? 'badge-success' : 'badge-danger'}`}>
                                {exchange.connected ? 'Online' : 'Offline'}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Arbitrage Opportunities */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    🎯 Live Opportunities
                    {opportunities.length > 0 && (
                        <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>
                            {opportunities.length}
                        </span>
                    )}
                </h2>
                <div className="card">
                    {opportunities.length === 0 ? (
                        <p className={styles.empty}>Waiting for arbitrage opportunities...</p>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Symbol</th>
                                    <th>Buy</th>
                                    <th>Sell</th>
                                    <th>Spread</th>
                                    <th>Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {opportunities.slice(0, 20).map((opp) => (
                                    <tr key={opp.id} className="animate-slideIn">
                                        <td><strong>{opp.symbol}</strong></td>
                                        <td>
                                            <span className={styles.exchangeBadge}>{opp.buyExchange}</span>
                                            <span className="price-down">${opp.buyPrice.toFixed(2)}</span>
                                        </td>
                                        <td>
                                            <span className={styles.exchangeBadge}>{opp.sellExchange}</span>
                                            <span className="price-up">${opp.sellPrice.toFixed(2)}</span>
                                        </td>
                                        <td className="price-up">{opp.spreadPercent.toFixed(3)}%</td>
                                        <td className="price-up">${opp.potentialProfit.toFixed(4)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>

            {/* Price Grid */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>📊 Live Prices</h2>
                <div className="grid-dashboard">
                    {priceArray.map(({ symbol, exchanges: exPrices }) => (
                        <div key={symbol} className="card">
                            <h3 className={styles.symbolTitle}>{symbol}</h3>
                            <div className={styles.priceList}>
                                {exPrices.map((price) => (
                                    <div key={price.exchange} className={styles.priceRow}>
                                        <span className={styles.exchangeLabel}>{price.exchange}</span>
                                        <div className={styles.priceValues}>
                                            <span className="price-up">${price.bid.toFixed(2)}</span>
                                            <span className={styles.separator}>/</span>
                                            <span className="price-down">${price.ask.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
