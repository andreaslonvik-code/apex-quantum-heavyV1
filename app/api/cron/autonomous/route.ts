import { NextRequest, NextResponse } from 'next/server';

// This route is called by Vercel Cron Jobs or external cron services
// It triggers the autonomous trading logic every 10 minutes

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[CRON] Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const timestamp = new Date().toISOString();
  console.log(`[CRON] === APEX QUANTUM 24/7 CRON JOB START === ${timestamp}`);

  try {
    // Get stored credentials from environment or database
    // For cron jobs, we need to store tokens server-side (not in cookies)
    const storedToken = process.env.APEX_SAXO_TOKEN;
    const storedAccountKey = process.env.APEX_SAXO_ACCOUNT_KEY;

    if (!storedToken || !storedAccountKey) {
      console.log('[CRON] No Saxo credentials stored for cron execution');
      return NextResponse.json({
        success: false,
        message: 'Saxo credentials not configured for autonomous cron. Set APEX_SAXO_TOKEN and APEX_SAXO_ACCOUNT_KEY environment variables.',
        timestamp,
      });
    }

    // Call the internal autonomous logic directly
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    console.log(`[CRON] Triggering autonomous scan at ${baseUrl}/api/apex/autonomous-cron`);

    const response = await fetch(`${baseUrl}/api/apex/autonomous-cron`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret || '',
      },
      body: JSON.stringify({
        language: 'no',
        mode: 'paper',
        accessToken: storedToken,
        accountKey: storedAccountKey,
      }),
    });

    const data = await response.json();

    console.log(`[CRON] Autonomous scan completed. Status: ${response.status}`);
    console.log(`[CRON] Orders executed: ${data.executedOrders?.length || 0}`);
    console.log(`[CRON] === APEX QUANTUM 24/7 CRON JOB END ===`);

    return NextResponse.json({
      success: response.ok,
      message: 'Cron job executed - Full autonomous scan completed',
      timestamp,
      result: {
        ordersExecuted: data.executedOrders?.length || 0,
        totalInvested: data.totalInvested || 0,
        autonomStatus: data.autonomStatus || 'Unknown',
      },
    });
  } catch (error) {
    console.error('[CRON] Error in cron job:', error);
    return NextResponse.json({
      success: false,
      error: 'Cron job failed',
      details: String(error),
      timestamp,
    }, { status: 500 });
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
