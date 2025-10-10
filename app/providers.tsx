'use client';

import { FarcasterProvider } from './farcaster-provider';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <FarcasterProvider>
            {children}
        </FarcasterProvider>
    );
}
