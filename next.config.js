/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        domains: ['localhost'],
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: "frame-ancestors 'self' https://*.farcaster.xyz https://warpcast.com",
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
