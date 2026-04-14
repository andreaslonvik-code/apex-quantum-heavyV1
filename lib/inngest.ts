// lib/inngest.ts - APEX QUANTUM v7 Inngest Client
import { Inngest } from 'inngest';

// Create Inngest client for APEX QUANTUM
export const inngest = new Inngest({
  id: 'apex-quantum-v7',
  name: 'APEX QUANTUM v7 Trading Engine',
});

// Event types for type safety
export interface ApexQuantumEvents {
  'apex/tick': {
    data: {
      mode: 'sim' | 'live';
      accountKey: string;
      clientKey: string;
      accessToken: string;
    };
  };
  'apex/purge': {
    data: {
      reason: string;
    };
  };
  'apex/meta-cognition': {
    data: {
      portfolioValue: number;
      pnl: number;
      openPositions: number;
    };
  };
}
