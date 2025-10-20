/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: "frame-ancestors *; connect-src 'self' https://*.mypinata.cloud https://*.ipfs.io https://mainnet.base.org https://*.base.org https://base-rpc.publicnode.com https://api.warpcast.com https://farcaster.xyz https://auth.farcaster.xyz https://client.farcaster.xyz https://warpcast.com https://client.warpcast.com https://wrpcd.net https://*.wrpcd.net https://privy.farcaster.xyz https://privy.warpcast.com https://auth.privy.io https://*.rpc.privy.systems https://cloudflareinsights.com https://api.studio.thegraph.com; img-src 'self' data: https: blob:",
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
