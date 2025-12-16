'use client';

import { useSocket } from '@/hooks/useSocket';
import { Dashboard } from '@/components/dashboard/Dashboard';

export default function HomePage() {
    const {
        isConnected,
        prices,
        opportunities,
        exchanges,
        lastRefresh,
        refreshPrices,
        refreshInterval,
        setRefreshInterval
    } = useSocket();

    return (
        <main className="min-h-screen">
            <Dashboard
                isConnected={isConnected}
                prices={prices}
                opportunities={opportunities}
                exchanges={exchanges}
                lastRefresh={lastRefresh}
                onRefresh={refreshPrices}
                refreshInterval={refreshInterval}
                onRefreshIntervalChange={setRefreshInterval}
            />
        </main>
    );
}

