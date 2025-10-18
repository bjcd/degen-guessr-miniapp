'use client';

import Script from 'next/script';

export default function MiniAppMeta() {
    return (
        <Script
            id="miniapp-meta"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
                __html: `
                    (function() {
                        var meta = document.createElement('meta');
                        meta.name = 'fc:miniapp';
                        meta.content = JSON.stringify({
                            version: "1",
                            imageUrl: "https://degen-guessr-miniapp.vercel.app/miniapp-icon-large.png",
                            button: {
                                title: "Play Degen Guessr",
                                action: {
                                    type: "launch_frame",
                                    name: "Degen Guessr",
                                    url: "https://degen-guessr-miniapp.vercel.app",
                                    splashImageUrl: "https://degen-guessr-miniapp.vercel.app/miniapp-icon.png",
                                    splashBackgroundColor: "#d26cf8"
                                }
                            }
                        });
                        document.head.appendChild(meta);
                    })();
                `
            }}
        />
    );
}

