import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');
        if (!address) {
            return NextResponse.json({ error: 'Missing address' }, { status: 400 });
        }

        // Step 1: Resolve wallet address to FID
        const verifRes = await fetch(`https://api.warpcast.com/v2/verifications?address=${address}`);
        if (!verifRes.ok) {
            return NextResponse.json({ profile: null }, { status: 200 });
        }
        const verifData = await verifRes.json();
        const fid = verifData.result?.verifications?.[0]?.fid;
        if (!fid) {
            return NextResponse.json({ profile: null }, { status: 200 });
        }

        // Step 2: Fetch user profile by FID
        const userRes = await fetch(`https://api.warpcast.com/v2/user-by-fid?fid=${fid}`);
        if (!userRes.ok) {
            return NextResponse.json({ profile: null }, { status: 200 });
        }
        const userData = await userRes.json();
        const user = userData.result?.user;
        if (!user) {
            return NextResponse.json({ profile: null }, { status: 200 });
        }

        const profile = {
            fid: user.fid,
            username: user.username,
            displayName: user.displayName,
            pfpUrl: user.pfp?.url,
            walletAddress: address,
        };

        return NextResponse.json({ profile }, { status: 200 });
    } catch (err) {
        return NextResponse.json({ profile: null }, { status: 200 });
    }
}


