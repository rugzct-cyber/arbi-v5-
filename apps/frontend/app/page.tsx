'use client';

import { Suspense } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { Dashboard } from '@/components/dashboard/Dashboard';

function DashboardContent() {
    const {
        isConnected,
        isLoading,
        prices,
        opportunities,
        exchanges,
        lastRefresh,
        refreshPrices,
        refreshInterval,
        setRefreshInterval
    } = useSocket();

    return (
        <Dashboard
            isConnected={isConnected}
            isLoading={isLoading}
            prices={prices}
            opportunities={opportunities}
            exchanges={exchanges}
            lastRefresh={lastRefresh}
            onRefresh={refreshPrices}
            refreshInterval={refreshInterval}
            onRefreshIntervalChange={setRefreshInterval}
        />
    );
}

export default function HomePage() {
    return (
        <main className="min-h-screen">
            <Suspense fallback={<div style={{ padding: '2rem', color: '#888' }}>Loading Dashboard...</div>}>
                <DashboardContent />
            </Suspense>
        </main>
    );
}
