// app/api/inngest/route.ts - Inngest API handler for APEX QUANTUM v7
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { functions } from '@/inngest/functions/apex-quantum-tick';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
