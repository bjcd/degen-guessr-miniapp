import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { addresses } = await req.json() as { addresses: string[] };

    // Normalize to lowercase 0x… strings and remove duplicates
    const addrs = [...new Set(addresses.map(a => a.toLowerCase()))];

    // Only proceed if we have addresses and Neynar API key
    if (addrs.length === 0 || !process.env.NEXT_PUBLIC_NEYNAR_API_KEY) {
      return Response.json({ result: [] }, { 
        headers: { "Cache-Control": "public, max-age=60" } 
      });
    }

    // Import Neynar client only on server side
    const { NeynarAPIClient } = await import("@neynar/nodejs-sdk");
    const client = new NeynarAPIClient({
      apiKey: process.env.NEXT_PUBLIC_NEYNAR_API_KEY,
    });

    // Bulk resolves custody and verified ETH/SOL addresses
    const { users } = await client.fetchBulkUsersByEthOrSolAddress({
      addresses: addrs,
    });

    // Build fast lookup by any matched address
    const byAddr = new Map<string, { fid: number; username: string | null; pfp: string | null }[]>();

    for (const u of users ?? []) {
      const entry = { 
        fid: u.fid, 
        username: u.username ?? null, 
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
