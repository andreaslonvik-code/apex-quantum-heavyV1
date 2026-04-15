import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('apex_saxo_token')?.value;
    const accountKey = cookieStore.get('apex_saxo_account_key')?.value;
    
    if (!accessToken || !accountKey) {
      return NextResponse.json({ error: 'Not connected', cookies: false });
    }

    const results: any = {
      accountKey,
      tokenPresent: !!accessToken,
      tests: [],
    };

    // Test 1: Search for MU (STOCKS ONLY - NO CFD)
    console.log('[TEST] Searching for MU (Stock only)...');
    const searchRes = await fetch(
      `${SAXO_API_BASE}/ref/v1/instruments?Keywords=MU&AssetTypes=Stock`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const searchText = await searchRes.text();
    console.log(`[TEST] Search response: ${searchRes.status} - ${searchText.substring(0, 500)}`);
    
    results.tests.push({
      name: 'Search MU',
      status: searchRes.status,
      response: searchText.substring(0, 1000),
    });

    if (searchRes.ok) {
      const searchData = JSON.parse(searchText);
      if (searchData.Data?.length > 0) {
        const muInst = searchData.Data.find((i: any) => 
          i.Symbol?.includes('MU') || i.Description?.includes('Micron')
        ) || searchData.Data[0];
        
        results.foundMU = {
          uic: muInst.Identifier,
          assetType: muInst.AssetType,
          symbol: muInst.Symbol,
          description: muInst.Description,
          exchange: muInst.ExchangeId,
        };
        
        // Test 2: Get price for MU
        console.log(`[TEST] Getting price for MU (UIC=${muInst.Identifier})...`);
        const priceRes = await fetch(
          `${SAXO_API_BASE}/trade/v1/infoprices?Uic=${muInst.Identifier}&AssetType=${muInst.AssetType}&FieldGroups=Quote`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const priceText = await priceRes.text();
        console.log(`[TEST] Price response: ${priceRes.status} - ${priceText}`);
        
        results.tests.push({
          name: 'Get MU Price',
          status: priceRes.status,
          response: priceText.substring(0, 500),
        });

        // Test 3: Try to place a small test order
        console.log('[TEST] Attempting test order for MU...');
        const orderBody = {
          AccountKey: accountKey,
          Amount: 1,
          AssetType: muInst.AssetType,
          BuySell: 'Buy',
          OrderType: 'Market',
          OrderDuration: { DurationType: 'DayOrder' },
          Uic: muInst.Identifier,
          ManualOrder: false,
        };
        
        console.log(`[TEST] Order body: ${JSON.stringify(orderBody)}`);
        
        const orderRes = await fetch(`${SAXO_API_BASE}/trade/v2/orders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderBody),
        });
        
        const orderText = await orderRes.text();
        console.log(`[TEST] Order response: ${orderRes.status} - ${orderText}`);
        
        results.tests.push({
          name: 'Place Test Order',
          status: orderRes.status,
          body: orderBody,
          response: orderText,
        });
      }
    }

    // Test 4: Check existing positions
    console.log('[TEST] Checking positions...');
    const posRes = await fetch(
      `${SAXO_API_BASE}/port/v1/positions/me`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const posText = await posRes.text();
    console.log(`[TEST] Positions response: ${posRes.status} - ${posText.substring(0, 500)}`);
    
    results.tests.push({
      name: 'Get Positions',
      status: posRes.status,
      response: posText.substring(0, 1000),
    });

    // Test 5: Get account details
    console.log('[TEST] Getting account details...');
    const accRes = await fetch(
      `${SAXO_API_BASE}/port/v1/accounts/me`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const accText = await accRes.text();
    console.log(`[TEST] Account response: ${accRes.status} - ${accText.substring(0, 500)}`);
    
    results.tests.push({
      name: 'Get Account',
      status: accRes.status,
      response: accText.substring(0, 1000),
    });

    return NextResponse.json(results);
    
  } catch (error) {
    console.error('[TEST] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
