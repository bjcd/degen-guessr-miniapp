import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { untrustedData } = body;

        if (!untrustedData) {
            return new NextResponse('Invalid frame data', { status: 400 });
        }

        // Handle different button actions
        const buttonIndex = untrustedData.buttonIndex;

        if (buttonIndex === 1) {
            // Play Game button - redirect to main app
            return NextResponse.redirect(new URL('/', request.url));
        }

        // Default response
        return new NextResponse('OK', { status: 200 });
    } catch (error) {
        console.error('Frame API error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

export async function GET() {
    return new NextResponse('Frame API endpoint', { status: 200 });
}

