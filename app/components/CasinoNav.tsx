"use client";

import { usePathname } from 'next/navigation';
import { Button } from './ui/button';
import Link from 'next/link';

interface NavItem {
    href: string;
    label: string;
    emoji: string;
}

const navItems: NavItem[] = [
    { href: '/degen-slot', label: 'Mega Degen', emoji: '🎰' },
    { href: '/', label: 'Degen Guessr', emoji: '💯' },
];

export default function CasinoNav() {
    const pathname = usePathname();

    return (
        <div className="w-full mb-4">
            <div className="bg-gradient-to-r from-[hsl(270_50%_15%)] to-[hsl(270_50%_12%)] rounded-xl border border-primary/30 p-2">
                <div className="flex gap-1.5">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="flex-1"
                            >
                                <Button
                                    className={`w-full h-10 md:h-12 font-black text-sm md:text-base transition-all duration-300 ${
                                        isActive
                                            ? 'bg-gradient-to-r from-primary via-secondary to-accent text-white shadow-lg scale-[1.02]'
                                            : 'bg-[hsl(270_30%_20%)] text-muted-foreground hover:bg-[hsl(270_30%_25%)]'
                                    }`}
                                >
                                    <span className="flex items-center justify-center gap-1 md:gap-1.5">
                                        {item.emoji && <span className="text-xs md:text-sm">{item.emoji}</span>}
                                        <span className="text-[10px] sm:text-sm md:text-base">{item.label}</span>
                                    </span>
                                </Button>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
