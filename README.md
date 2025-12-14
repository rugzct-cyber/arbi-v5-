# Arbitrage v5 🚀

High-performance crypto arbitrage detection platform with real-time price streaming.

## Tech Stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| **Frontend** | Next.js 14 (App Router) | Vercel |
| **Backend Engine** | Node.js + Socket.io | Railway |
| **Database** | QuestDB (ILP Protocol) | Railway / Self-hosted |
| **Real-time** | Socket.io | Integrated in Engine |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Exchanges     │     │     Engine      │     │    Frontend     │
│  (WebSocket)    │────▶│   (Railway)     │────▶│    (Vercel)     │
│                 │     │                 │     │                 │
│ • Binance       │     │ • Price Agg     │     │ • Dashboard     │
│ • Hyperliquid   │     │ • Arb Detector  │     │ • Live Prices   │
│ • Extended      │     │ • Socket.io     │     │ • Opportunities │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │     QuestDB     │
                        │   (ILP TCP)     │
                        │                 │
                        │ • Price History │
                        │ • Analytics     │
                        └─────────────────┘
```

## Project Structure

```
arbitrage-v5/
├── apps/
│   ├── frontend/          # Next.js 14 dashboard
│   └── engine/            # Node.js backend
├── packages/
│   └── shared/            # Shared types, constants, utils
├── .github/workflows/     # CI/CD pipelines
├── turbo.json             # Turborepo config
└── pnpm-workspace.yaml    # pnpm workspaces
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- QuestDB (optional, for persistence)

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/arbitrage-v5.git
cd arbitrage-v5

# Install dependencies
pnpm install

# Copy environment files
cp apps/engine/.env.example apps/engine/.env
cp apps/frontend/.env.example apps/frontend/.env
```

### Development

```bash
# Run both frontend and engine
pnpm dev

# Run only frontend
pnpm dev:frontend

# Run only engine
pnpm dev:engine
```

### Environment Variables

#### Engine (`apps/engine/.env`)

```env
PORT=3001
QUESTDB_HOST=localhost
QUESTDB_ILP_PORT=9009
QUESTDB_HTTP_PORT=9000
SOCKET_CORS_ORIGIN=http://localhost:3000
```

#### Frontend (`apps/frontend/.env`)

```env
NEXT_PUBLIC_ENGINE_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

## Deployment

### Frontend (Vercel)

1. Connect your GitHub repo to Vercel
2. Set root directory to `apps/frontend`
3. Add environment variables in Vercel dashboard

### Engine (Railway)

1. Create a new Railway project
2. Connect your GitHub repo
3. Set build command: `pnpm --filter engine build`
4. Set start command: `pnpm --filter engine start`
5. Add QuestDB plugin or external connection

## Features

- ⚡ **Real-time price streaming** via WebSocket
- 🎯 **Arbitrage detection** across multiple exchanges
- 📊 **Historical data** stored in QuestDB (time-series optimized)
- 🔌 **Modular exchange adapters** - easily add new exchanges
- 📱 **Responsive dashboard** with live updates
- 🔐 **Type-safe** Socket.io events

## Adding a New Exchange

1. Create adapter in `apps/engine/src/exchanges/`:

```typescript
// apps/engine/src/exchanges/myexchange-ws.ts
import { BaseExchangeAdapter } from './base-adapter.js';

export class MyExchangeWebSocket extends BaseExchangeAdapter {
  readonly exchangeId = 'myexchange';
  readonly wsUrl = 'wss://api.myexchange.com/ws';
  
  protected onOpen(): void {
    // Subscribe to streams
  }
  
  protected onMessage(data: WebSocket.RawData): void {
    // Parse and emit prices
    this.emitPrice({ exchange: this.exchangeId, symbol, bid, ask });
  }
}
```

2. Register in `apps/engine/src/exchanges/index.ts`

## License

MIT
