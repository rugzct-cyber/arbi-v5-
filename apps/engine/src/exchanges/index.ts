import type { PriceData } from '@arbitrage/shared';
import { ParadexWebSocket } from './paradex-ws.js';
import { VestWebSocket } from './vest-ws.js';
import { ExtendedWebSocket } from './extended-ws.js';
import { HyperliquidWebSocket } from './hyperliquid-ws.js';
import { LighterWebSocket } from './lighter-ws.js';
import { HibachiWebSocket } from './hibachi-ws.js';
import { AsterWebSocket } from './aster-ws.js';
import { PacificaWebSocket } from './pacifica-ws.js';
import { XyzWebSocket } from './xyz-ws.js';
import { OstiumWebSocket } from './ostium-ws.js';
import { EtherealWebSocket } from './ethereal-ws.js';
import { EdgeXWebSocket } from './edgex-ws.js';
import { BackpackWebSocket } from './backpack-ws.js';
import type { BaseExchangeAdapter } from './base-adapter.js';

export interface ExchangeManagerConfig {
  onPrice: (price: PriceData) => void | Promise<void>;
  onError: (exchange: string, error: Error) => void;
  onConnected: (exchange: string) => void;
  onDisconnected: (exchange: string) => void;
}

export class ExchangeManager {
  private adapters: Map<string, BaseExchangeAdapter> = new Map();
  private config: ExchangeManagerConfig;
  
  constructor(config: ExchangeManagerConfig) {
    this.config = config;
    this.initializeAdapters();
  }
  
  private createAdapterConfig(exchangeId: string) {
    return {
      onPrice: (price: PriceData) => this.config.onPrice(price),
      onError: (error: Error) => this.config.onError(exchangeId, error),
      onConnected: () => this.config.onConnected(exchangeId),
      onDisconnected: () => this.config.onDisconnected(exchangeId),
    };
  }
  
  private initializeAdapters(): void {
    // Initialize all 13 DEX adapters
    this.adapters.set('paradex', new ParadexWebSocket(this.createAdapterConfig('paradex')));
    this.adapters.set('vest', new VestWebSocket(this.createAdapterConfig('vest')));
    this.adapters.set('extended', new ExtendedWebSocket(this.createAdapterConfig('extended')));
    this.adapters.set('hyperliquid', new HyperliquidWebSocket(this.createAdapterConfig('hyperliquid')));
    this.adapters.set('lighter', new LighterWebSocket(this.createAdapterConfig('lighter')));
    this.adapters.set('hibachi', new HibachiWebSocket(this.createAdapterConfig('hibachi')));
    this.adapters.set('aster', new AsterWebSocket(this.createAdapterConfig('aster')));
    this.adapters.set('pacifica', new PacificaWebSocket(this.createAdapterConfig('pacifica')));
    this.adapters.set('xyz', new XyzWebSocket(this.createAdapterConfig('xyz')));
    this.adapters.set('ostium', new OstiumWebSocket(this.createAdapterConfig('ostium')));
    this.adapters.set('ethereal', new EtherealWebSocket(this.createAdapterConfig('ethereal')));
    this.adapters.set('edgex', new EdgeXWebSocket(this.createAdapterConfig('edgex')));
    this.adapters.set('backpack', new BackpackWebSocket(this.createAdapterConfig('backpack')));
    
    console.log(`📦 Initialized ${this.adapters.size} exchange adapters`);
  }
  
  async connectAll(): Promise<void> {
    console.log('🔌 Connecting to all exchanges...');
    
    const connections = Array.from(this.adapters.entries()).map(
      async ([name, adapter]) => {
        try {
          await adapter.connect();
          console.log(`✅ [${name}] Connected`);
        } catch (error) {
          console.error(`❌ [${name}] Connection failed:`, error);
        }
      }
    );
    
    await Promise.allSettled(connections);
    console.log('🚀 Exchange connection phase complete');
  }
  
  async connect(exchangeId: string): Promise<void> {
    const adapter = this.adapters.get(exchangeId);
    if (adapter) {
      await adapter.connect();
    } else {
      console.warn(`⚠️ Unknown exchange: ${exchangeId}`);
    }
  }
  
  async disconnect(exchangeId: string): Promise<void> {
    const adapter = this.adapters.get(exchangeId);
    if (adapter) {
      await adapter.disconnect();
    }
  }
  
  async disconnectAll(): Promise<void> {
    const disconnections = Array.from(this.adapters.values()).map(
      (adapter) => adapter.disconnect()
    );
    
    await Promise.allSettled(disconnections);
    console.log('🔌 All exchanges disconnected');
  }
  
  getConnectedExchanges(): string[] {
    return Array.from(this.adapters.keys());
  }
  
  getAdapterCount(): number {
    return this.adapters.size;
  }
}

// Re-export all adapters
export { ParadexWebSocket } from './paradex-ws.js';
export { VestWebSocket } from './vest-ws.js';
export { ExtendedWebSocket } from './extended-ws.js';
export { HyperliquidWebSocket } from './hyperliquid-ws.js';
export { LighterWebSocket } from './lighter-ws.js';
export { HibachiWebSocket } from './hibachi-ws.js';
export { AsterWebSocket } from './aster-ws.js';
export { PacificaWebSocket } from './pacifica-ws.js';
export { XyzWebSocket } from './xyz-ws.js';
export { OstiumWebSocket } from './ostium-ws.js';
export { EtherealWebSocket } from './ethereal-ws.js';
export { EdgeXWebSocket } from './edgex-ws.js';
export { BackpackWebSocket } from './backpack-ws.js';
export { BaseExchangeAdapter } from './base-adapter.js';
