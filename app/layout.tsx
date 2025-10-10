import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'DEGEN Guess 1-100',
    description: 'A fun and fair guessing game using $DEGEN token on Base',
    icons: {
        icon: '/icon.png',
    },
    openGraph: {
        title: 'DEGEN Guess 1-100',
        description: 'Guess a number between 1-100 and win the pot!',
        images: ['/og-image.png'],
    },
    other: {
        'fc:frame': 'vNext',
        'fc:frame:image': '/og-image.png',
        'fc:frame:button:1': 'Play Game',
        'fc:frame:post_url': '/api/frame',
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
