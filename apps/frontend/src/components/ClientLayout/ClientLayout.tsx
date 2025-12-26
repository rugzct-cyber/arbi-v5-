'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { GlobalAlarmNotification } from '@/components/GlobalAlarmNotification';
import { GlobalAlertDrawer } from '@/components/GlobalAlertDrawer';
import styles from './ClientLayout.module.css';

// Count total alerts from localStorage
function countAlerts(): number {
    if (typeof window === 'undefined') return 0;
    try {
        const spreadAlerts = JSON.parse(localStorage.getItem('spread-alerts-v2') || '[]');
        const positions = JSON.parse(localStorage.getItem('positions') || '[]');
        const positionAlerts = positions.filter((p: any) => p.alarmEnabled);
        return spreadAlerts.length + positionAlerts.length;
    } catch {
        return 0;
    }
}

// Pages that don't require authentication
const PUBLIC_PATHS = ['/login'];

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated, isLoading, logout } = useAuth();

    const [showDrawer, setShowDrawer] = useState(false);
    const [alertCount, setAlertCount] = useState(0);

    // Update alert count periodically
    useEffect(() => {
        setAlertCount(countAlerts());
        const interval = setInterval(() => {
            setAlertCount(countAlerts());
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // Auth redirect logic
    useEffect(() => {
        if (isLoading) return;

        const isPublicPath = PUBLIC_PATHS.includes(pathname);

        if (!isAuthenticated && !isPublicPath) {
            router.push('/login');
        } else if (isAuthenticated && pathname === '/login') {
            router.push('/');
        }
    }, [isAuthenticated, isLoading, pathname, router]);

    const handleCloseDrawer = () => {
        setShowDrawer(false);
        setAlertCount(countAlerts());
    };

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0b0d',
                color: '#71717a',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        border: '3px solid rgba(99, 102, 241, 0.2)',
                        borderTopColor: '#6366f1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 1rem',
                    }} />
                    Chargement...
                </div>
                <style jsx global>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    // For public paths (like /login), just render children
    const isPublicPath = PUBLIC_PATHS.includes(pathname);
    if (isPublicPath) {
        return <>{children}</>;
    }

    // Not authenticated and not on login page - will redirect
    if (!isAuthenticated) {
        return null;
    }

    // Authenticated - render full layout
    return (
        <>
            <GlobalAlarmNotification />
            <GlobalAlertDrawer isOpen={showDrawer} onClose={handleCloseDrawer} />

            {/* Logout Button */}
            <button
                className={styles.logoutBtn}
                onClick={logout}
                title="Se déconnecter"
            >
                🚪
            </button>

            {/* Global Alert Button */}
            <button
                className={styles.globalAlertBtn}
                onClick={() => setShowDrawer(true)}
                title="Voir toutes les alarmes"
            >
                🔔
                {alertCount > 0 && (
                    <span className={styles.alertBadge}>{alertCount}</span>
                )}
            </button>

            {children}
        </>
    );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <AuthenticatedLayout>{children}</AuthenticatedLayout>
        </AuthProvider>
    );
}

