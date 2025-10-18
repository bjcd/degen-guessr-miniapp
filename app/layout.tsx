import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'DEGEN Guess 1-100',
    description: 'A fun and fair guessing game using $DEGEN token on Base network. Guess a number between 1-100 and win the entire pot!',
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://degen-guessr.vercel.app'),
    icons: {
        icon: '/degen-logo.png',
    },
    openGraph: {
        title: 'DEGEN Guess 1-100',
        description: 'A fair guessing game on Base using $DEGEN token. Guess 1-100 to win!',
        images: ['/og-image.png'],
        type: 'website',
    },
    // Farcaster MiniApp Embed metadata
    other: {
        'fc:miniapp': JSON.stringify({
            version: "1",
            imageUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://degen-guessr.vercel.app'}/og-image.png`,
            button: {
                title: "DEGEN Guess 1-100",
                action: {
                    type: "link",
                    url: process.env.NEXT_PUBLIC_APP_URL || 'https://degen-guessr.vercel.app'
                }
            }
        }),
        // Backward compatibility with fc:frame
        'fc:frame': 'vNext',
        'fc:frame:image': `${process.env.NEXT_PUBLIC_APP_URL || 'https://degen-guessr.vercel.app'}/og-image.png`,
        'fc:frame:button:1': 'Play Game',
        'fc:frame:button:1:action': 'link',
        'fc:frame:button:1:target': process.env.NEXT_PUBLIC_APP_URL || 'https://degen-guessr.vercel.app',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <Providers>
                    <div className="min-h-screen bg-gradient-to-br from-degen-50 to-degen-100">
                        {children}
                    </div>
                </Providers>
            </body>
        </html>
    );
}
