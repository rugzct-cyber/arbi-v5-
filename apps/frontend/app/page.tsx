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
        <>
            {isLoading && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(10, 12, 18, 0.95)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    gap: '1rem'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        border: '3px solid rgba(99, 102, 241, 0.2)',
                        borderTop: '3px solid #6366f1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <span style={{ color: '#a1a1aa', fontSize: '1rem' }}>
                        Connecting to exchanges...
                    </span>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            )}
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
        </>
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
