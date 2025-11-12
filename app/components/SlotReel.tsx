"use client";

import { useEffect, useState, useRef } from "react";

interface SlotReelProps {
    spinning: boolean;
    finalIcon: string;
    delay?: number;
    onStop?: () => void;
}

export const SlotReel = ({ spinning, finalIcon, delay = 0, onStop }: SlotReelProps) => {
    const [currentIcon, setCurrentIcon] = useState(finalIcon);
    const [isSpinning, setIsSpinning] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const icons = ["🎰", "💎", "⭐", "👑", "🍒", "🔔", "💰", "🎲"];

    useEffect(() => {
        // Clear any existing intervals/timeouts
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (spinning) {
            // Start spinning
            console.log('🎰 Starting reel spin with 3000ms interval');
            setIsSpinning(true);
            intervalRef.current = setInterval(() => {
                const randomIcon = icons[Math.floor(Math.random() * icons.length)];
                console.log('🎰 Reel changing to:', randomIcon);
                setCurrentIcon(randomIcon);
            }, 3000); // Much much much slower spinning speed
        } else {
            // Stop spinning and show final result
            console.log('🎰 Stopping reel spin, final icon:', finalIcon);
            setIsSpinning(false);
            if (finalIcon && finalIcon !== 'undefined') {
                timeoutRef.current = setTimeout(() => {
                    console.log('🎰 Reel stopping with final icon:', finalIcon);
                setCurrentIcon(finalIcon);
                onStop?.();
                }, delay);
            }
        }

        // Cleanup function
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
        }
        };
    }, [spinning, finalIcon, delay, onStop]);

    return (
        <div className="relative flex items-center justify-center w-full h-full">
            <div
                className={`
          text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl transition-all duration-100
          ${isSpinning ? "blur-sm scale-95 opacity-80 animate-pulse" : "blur-0 scale-100 opacity-100"}
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