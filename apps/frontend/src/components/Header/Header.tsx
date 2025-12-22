'use client';

import styles from './Header.module.css';

interface RefreshOptions {
    refreshInterval: number;
    onRefreshIntervalChange: (interval: number) => void;
    lastRefresh: Date;
    onRefresh: () => void;
}

interface AlertOptions {
    alertCount: number;
    onOpenAlerts: () => void;
}

interface HeaderProps {
    activePage: 'dashboard' | 'positions' | 'metrics';
    isConnected: boolean;
    refreshOptions?: RefreshOptions;
    alertOptions?: AlertOptions;
}

const REFRESH_OPTIONS = [
    { label: '3s', value: 3000 },
    { label: '5s', value: 5000 },
    { label: '15s', value: 15000 },
    { label: '30s', value: 30000 },
    { label: '1min', value: 60000 },
];

const PAGE_TITLES: Record<string, { icon: string; title: string }> = {
    dashboard: { icon: '📈', title: 'Arbitrage Dashboard' },
    positions: { icon: '📊', title: 'Position Manager' },
    metrics: { icon: '📊', title: 'Metrics' },
};

export function Header({ activePage, isConnected, refreshOptions, alertOptions }: HeaderProps) {
    const { icon, title } = PAGE_TITLES[activePage];

    return (
        <header className={styles.header}>
            <div className={styles.headerContent}>
                <h1 className={styles.title}>
                    <span className={styles.logo}>{icon}</span>
                    {title}
                </h1>

                <nav className={styles.nav}>
                    <a href="/" className={activePage === 'dashboard' ? styles.navLink : styles.navLinkInactive}>
                        Dashboard
                    </a>
                    <a href="/positions" className={activePage === 'positions' ? styles.navLink : styles.navLinkInactive}>
                        Positions
                    </a>
                    <a href="/metrics" className={activePage === 'metrics' ? styles.navLink : styles.navLinkInactive}>
                        Metrics
                    </a>
                </nav>

                <div className={styles.headerRight}>
                    {refreshOptions && (
                        <div className={styles.refreshSection}>
                            <select
                                className={styles.refreshSelect}
                                value={refreshOptions.refreshInterval}
                                onChange={(e) => refreshOptions.onRefreshIntervalChange(Number(e.target.value))}
                            >
                                {REFRESH_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <span className={styles.lastRefresh} suppressHydrationWarning>
                                Updated: {refreshOptions.lastRefresh.toLocaleTimeString()}
                            </span>
                            <button className={styles.refreshBtn} onClick={refreshOptions.onRefresh}>
                                Refresh
                            </button>
                        </div>
                    )}

                    {alertOptions && (
                        <button className={styles.alertBtn} onClick={alertOptions.onOpenAlerts}>
                            🔔
                            {alertOptions.alertCount > 0 && (
                                <span className={styles.alertBadge}>{alertOptions.alertCount}</span>
                            )}
                        </button>
                    )}

                    <div className={styles.status}>
                        <span className={`${styles.statusDot} ${isConnected ? styles.connected : styles.disconnected}`} />
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                </div>
            </div>
        </header>
    );
}
