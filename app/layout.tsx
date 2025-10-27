import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import React from 'react';
import { FarcasterProvider } from './farcaster-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'DEGEN Guess 1-100',
    description: 'A fun and fair guessing game using $DEGEN token on Base network. Guess a number between 1-100 and win the entire pot!',
    metadataBase: new URL('https://degenguessr.xyz'),
    icons: {
        icon: '/degen-logo.png',
    },
    openGraph: {
        title: 'DEGEN Guess 1-100',
        description: 'A fair guessing game on Base using $DEGEN token. Guess 1-100 to win!',
        images: ['/miniapp-screenshot.png'],
        type: 'website',
    },
    // Farcaster MiniApp Embed (single JSON meta tag, no mixing with Frames v1)
    other: {
        'fc:miniapp': '{"version":"1","imageUrl":"https://degenguessr.xyz/miniapp-icon-large.png","button":{"title":"╰┈➤ PLAY NOW.","action":{"type":"launch_frame","name":"Degen House","url":"https://degenguessr.xyz","splashImageUrl":"https://degenguessr.xyz/icon.png","splashBackgroundColor":"#d26cf8"}}}',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <script
                    src="https://cdn.jsdelivr.net/npm/js-confetti@latest/dist/js-confetti.browser.js"
                    async
                />
            </head>
            <body className={inter.className}>
                <FarcasterProvider>
                    <div className="min-h-screen bg-gradient-to-br from-degen-50 to-degen-100">
                        {children}
                    </div>
                </FarcasterProvider>
            </body>
        </html>
    );
}
