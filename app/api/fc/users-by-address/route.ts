import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  console.log('🚀🚀🚀 SERVER API ROUTE HIT! 🚀🚀🚀');
  console.log('🚀🚀🚀 SERVER API ROUTE HIT! 🚀🚀🚀');
  console.log('🚀🚀🚀 SERVER API ROUTE HIT! 🚀🚀🚀');
  console.log('🚀🚀🚀 SERVER API ROUTE HIT! 🚀🚀🚀');
  console.log('🚀🚀🚀 SERVER API ROUTE HIT! 🚀🚀🚀');
  console.log('🚀🚀🚀 SERVER API ROUTE HIT! 🚀🚀🚀');
  console.log('🚀🚀🚀 SERVER API ROUTE HIT! 🚀🚀🚀');
  console.log('🚀🚀🚀 SERVER API ROUTE HIT! 🚀🚀🚀');
  console.log('🚀🚀🚀 SERVER API ROUTE HIT! 🚀🚀🚀');
  console.log('🚀🚀🚀 SERVER API ROUTE HIT! 🚀🚀🚀');
  try {
    const { addresses } = await req.json() as { addresses: string[] };
    console.log('🔍 Server API called with addresses:', addresses);

    // Normalize to lowercase 0x… strings and remove duplicates
    const addrs = [...new Set(addresses.map(a => a.toLowerCase()))];
    console.log('🔍 Normalized addresses:', addrs);

    // Only proceed if we have addresses and Neynar API key
    if (addrs.length === 0) {
      console.log('❌ No addresses provided');
      return Response.json({ result: [] }, {
        headers: { "Cache-Control": "public, max-age=60" }
      });
    }

    if (!process.env.NEXT_PUBLIC_NEYNAR_API_KEY) {
      console.log('❌ No Neynar API key found');
      return Response.json({ result: [] }, {
        headers: { "Cache-Control": "public, max-age=60" }
      });
    }

    console.log('🔍 Calling Neynar API with addresses:', addrs);

    let users: any[] = [];

    try {
      // Use regular Neynar API (not Snapchain)
      const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addrs.join(',')}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'api_key': process.env.NEXT_PUBLIC_NEYNAR_API_KEY!,
        },
      });

      console.log('🔍 Neynar API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Neynar API error:', response.status, errorText);
        throw new Error(`Neynar API error: ${response.status} ${errorText}`);
      }

      const neynarResponse = await response.json();
      console.log('🔍 Neynar API response:', JSON.stringify(neynarResponse, null, 2));

      // Convert the response format to match our expected structure
      for (const [address, userArray] of Object.entries(neynarResponse)) {
        if (Array.isArray(userArray)) {
          users.push(...userArray);
        }
      }

      console.log('🔍 Neynar API response:', { usersCount: users?.length || 0, users: users?.slice(0, 2) || [] });
    } catch (error) {
      console.error('❌ Neynar API error:', error);
      throw error;
    }

    // Build fast lookup by any matched address
    const byAddr = new Map<string, { fid: number; username: string | null; displayName: string | null; pfp: string | null }[]>();

    for (const u of users ?? []) {
      const entry = {
        fid: u.fid,
        username: u.username ?? null,
        displayName: u.display_name ?? null,
        pfp: u.pfp_url ?? null
      };

      // Check both custody address and verified addresses
      const custody = u.custody_address?.toLowerCase();
      const verified = (u.verified_addresses?.eth_addresses ?? []).map((x: string) => x.toLowerCase());

      for (const a of [custody, ...verified].filter(Boolean) as string[]) {
        const arr = byAddr.get(a) ?? [];
        arr.push(entry);
        byAddr.set(a, arr);
      }
    }

    // Return list for each requested address (could be 0, 1, or many users)
    const result = addrs.map(a => ({
      address: a,
      users: byAddr.get(a) ?? []
    }));

    console.log('🔍 Final result:', result);

    return Response.json({ result }, {
      headers: { "Cache-Control": "public, max-age=60" }
    });

  } catch (error) {
    console.error('Error in /api/fc/users-by-address:', error);
    return Response.json({ result: [] }, {
      headers: { "Cache-Control": "public, max-age=60" }
    });
  }
}
