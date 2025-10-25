"use client";

import { useEffect, useState } from "react";

interface SlotReelProps {
    spinning: boolean;
    finalIcon: string;
    delay: number;
    onStop?: () => void;
}

export const SlotReel = ({ spinning, finalIcon, delay, onStop }: SlotReelProps) => {
    const [currentIcon, setCurrentIcon] = useState(finalIcon);
    const [isSpinning, setIsSpinning] = useState(false);

    const icons = ["🎰", "💎", "⭐", "👑", "🍒", "🔔", "💰", "🎲"];

    useEffect(() => {
        if (spinning) {
            setIsSpinning(true);
            const spinInterval = setInterval(() => {
                setCurrentIcon(icons[Math.floor(Math.random() * icons.length)]);
            }, 100);

            const stopTimeout = setTimeout(() => {
                clearInterval(spinInterval);
                setCurrentIcon(finalIcon);
                setIsSpinning(false);
                onStop?.();
            }, 2000 + delay);

            return () => {
                clearInterval(spinInterval);
                clearTimeout(stopTimeout);
            };
        }
    }, [spinning, finalIcon, delay]);

    return (
        <div className="relative flex items-center justify-center w-full h-full">
            <div
                className={`
          text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl transition-all duration-200
          ${isSpinning ? "blur-sm scale-90 opacity-70" : "blur-0 scale-100 opacity-100"}
        `}
            >
                {currentIcon}
            </div>
            {isSpinning && (
                <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-transparent to-secondary/20 animate-pulse pointer-events-none" />
            )}
        </div>
    );
};