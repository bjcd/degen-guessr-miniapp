import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import MiniAppMeta from './miniapp-meta';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'DEGEN Guess 1-100',
    description: 'A fun and fair guessing game using $DEGEN token on Base network. Guess a number between 1-100 and win the entire pot!',
    metadataBase: new URL('https://degen-guessr-miniapp.vercel.app'),
    icons: {
        icon: '/degen-logo.png',
    },
    openGraph: {
        title: 'DEGEN Guess 1-100',
        description: 'A fair guessing game on Base using $DEGEN token. Guess 1-100 to win!',
        images: ['/miniapp-screenshot.png'],
        type: 'website',
    },
    // Farcaster Frame backward compatibility
    other: {
        'fc:frame': 'vNext',
        'fc:frame:image': "https://degen-guessr-miniapp.vercel.app/miniapp-icon-large.png",
        'fc:frame:button:1': 'Play Game',
        'fc:frame:button:1:action': 'link',
        'fc:frame:button:1:target': "https://degen-guessr-miniapp.vercel.app",
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
                <MiniAppMeta />
            </head>
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
