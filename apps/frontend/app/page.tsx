'use client';

import { Suspense, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAlerts } from '@/hooks/useAlerts';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { AlertModal } from '@/components/AlertModal';
import { AlertNotification } from '@/components/AlertNotification';
import { AlertList } from '@/components/AlertList';

const EXCHANGES = ['paradex', 'vest', 'extended', 'hyperliquid', 'lighter', 'pacifica', 'ethereal', 'nado'];

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

    // Alert system
    const {
        alerts,
        triggeredAlerts,
        addAlert,
        removeAlert,
        toggleAlert,
        resetAlert,
        dismissTrigger,
        getSpread,
    } = useAlerts(prices);

    const [showAlertModal, setShowAlertModal] = useState(false);
    const [showAlertList, setShowAlertList] = useState(false);

    return (
        <>
            {/* Alert Notifications (toasts) */}
            <AlertNotification
                triggers={triggeredAlerts}
                onDismiss={dismissTrigger}
            />

            {/* Alert Modal */}
            <AlertModal
                isOpen={showAlertModal}
                onClose={() => setShowAlertModal(false)}
                onSubmit={addAlert}
                prices={prices}
                exchanges={EXCHANGES}
            />

            {/* Alert List Drawer */}
            {showAlertList && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '360px',
                    background: 'linear-gradient(180deg, #1a1d26 0%, #12141a 100%)',
                    borderLeft: '1px solid rgba(255,255,255,0.1)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem 1.25rem',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                    }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#f1f1f1' }}>🔔 My Alerts</h3>
                        <button
                            onClick={() => setShowAlertList(false)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#71717a',
                                fontSize: '1.25rem',
                                cursor: 'pointer',
                            }}
                        >✕</button>
                    </div>
                    <div style={{ flex: 1, padding: '1rem', overflow: 'auto' }}>
                        <AlertList
                            alerts={alerts}
                            onToggle={toggleAlert}
                            onRemove={removeAlert}
                            onReset={resetAlert}
                            getSpread={getSpread}
                        />
                    </div>
                    <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <button
                            onClick={() => {
                                setShowAlertList(false);
                                setShowAlertModal(true);
                            }}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            + Add Alert
                        </button>
                    </div>
                </div>
            )}

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
                alertCount={alerts.length}
                onOpenAlerts={() => setShowAlertList(true)}
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
