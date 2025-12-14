'use client';

import { useSocket } from '@/hooks/useSocket';
import { Dashboard } from '@/components/dashboard/Dashboard';

export default function HomePage() {
    const {
        isConnected,
        prices,
        opportunities,
        exchanges
    } = useSocket();

    return (
        <main className="min-h-screen">
            <Dashboard
                isConnected={isConnected}
                prices={prices}
                opportunities={opportunities}
                exchanges={exchanges}
            />
        </main>
    );
}
