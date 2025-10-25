"use client";

import { SlotReel } from "./SlotReel";
import Image from "next/image";

interface SlotMachineProps {
    spinning: boolean;
    reels: string[];
    onSpinComplete?: () => void;
}

export const SlotMachine = ({ spinning, reels, onSpinComplete }: SlotMachineProps) => {
    let stopsCompleted = 0;

    const handleReelStop = () => {
        stopsCompleted++;
        if (stopsCompleted === 3 && onSpinComplete) {
            onSpinComplete();
        }
    };

    return (
        <div className="relative w-full max-w-2xl mx-auto">
            {/* Main slot machine frame with arcade styling */}
            <div className="relative bg-gradient-to-b from-[hsl(270_80%_25%)] via-[hsl(270_70%_20%)] to-[hsl(270_80%_15%)] rounded-[3rem] md:rounded-[4rem] p-4 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
                
                {/* Decorative lights around the entire perimeter */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* Top arc lights */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] flex justify-around">
                        {[...Array(12)].map((_, i) => (
                            <div
                                key={`top-${i}`}
                                className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8),0_0_20px_rgba(167,139,250,0.6)] animate-pulse"
                                style={{ 
                                    animationDelay: `${i * 0.12}s`,
                                    marginTop: `${Math.abs(i - 6) * 2}px`
                                }}
                            />
                        ))}
                    </div>
                    
                    {/* Left side lights */}
                    <div className="absolute left-3 md:left-6 top-1/4 bottom-1/4 flex flex-col justify-around">
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={`left-${i}`}
                                className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8),0_0_20px_rgba(167,139,250,0.6)] animate-pulse"
                                style={{ animationDelay: `${i * 0.15}s` }}
                            />
                        ))}
                    </div>
                    
                    {/* Right side lights */}
                    <div className="absolute right-3 md:right-6 top-1/4 bottom-1/4 flex flex-col justify-around">
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={`right-${i}`}
                                className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8),0_0_20px_rgba(167,139,250,0.6)] animate-pulse"
                                style={{ animationDelay: `${i * 0.15}s` }}
                            />
                        ))}
                    </div>
                    
                    {/* Bottom lights */}
                    <div className="absolute bottom-4 md:bottom-6 left-0 right-0 flex justify-around px-8 md:px-12">
                        {[...Array(10)].map((_, i) => (
                            <div
                                key={`bottom-${i}`}
                                className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8),0_0_20px_rgba(167,139,250,0.6)] animate-pulse"
                                style={{ animationDelay: `${i * 0.13}s` }}
                            />
                        ))}
                    </div>
                </div>

                {/* Inner frame */}
                <div className="relative bg-gradient-to-b from-[hsl(270_60%_15%)] to-[hsl(270_50%_10%)] rounded-[2.5rem] md:rounded-[3.5rem] p-3 md:p-4 border-4 border-[hsl(270_80%_30%)] shadow-[inset_0_4px_20px_rgba(0,0,0,0.6)]">
                    
                    {/* Header with title */}
                    <div className="relative z-10 text-center py-4 md:py-6 px-4 bg-gradient-to-b from-[hsl(270_70%_20%)] to-[hsl(270_60%_15%)] rounded-t-[2rem] md:rounded-t-[3rem] mb-3 md:mb-4 border-b-4 border-[hsl(270_80%_30%)]">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Image src="/degen-logo.png" alt="Degen Hat" width={32} height={32} className="object-contain drop-shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                            <h2 className="text-2xl md:text-4xl lg:text-5xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent neon-glow drop-shadow-[0_0_20px_rgba(167,139,250,0.8)]">
                                MEGA SLOTS
                            </h2>
                            <Image src="/degen-logo.png" alt="Degen Hat" width={32} height={32} className="object-contain scale-x-[-1] drop-shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                        </div>
                        <p className="text-[0.65rem] md:text-xs text-muted-foreground font-semibold tracking-widest">
                            THREE HATS = JACKPOT
                        </p>
                    </div>

                    {/* Slot Reels Container */}
                    <div className="relative z-10 px-3 md:px-6 mb-3 md:mb-4">
                        <div className="bg-gradient-to-br from-[hsl(260_50%_8%)] via-[hsl(270_50%_10%)] to-[hsl(260_50%_8%)] rounded-2xl md:rounded-3xl p-4 md:p-6 border-4 md:border-6 border-[hsl(270_70%_25%)] shadow-[inset_0_0_40px_rgba(0,0,0,0.9),0_4px_20px_rgba(0,0,0,0.5)]">
                            <div className="grid grid-cols-3 gap-2 md:gap-4">
                                {reels.map((reel, index) => (
                                    <div
                                        key={index}
                                        className="aspect-square bg-gradient-to-br from-[hsl(270_30%_85%)] via-[hsl(270_25%_75%)] to-[hsl(270_30%_70%)] rounded-xl md:rounded-2xl border-3 md:border-4 border-[hsl(270_60%_40%)] shadow-[inset_0_2px_10px_rgba(255,255,255,0.3),inset_0_-2px_10px_rgba(0,0,0,0.3),0_4px_15px_rgba(0,0,0,0.4)] flex items-center justify-center overflow-hidden relative"
                                    >
                                        {/* Reel reflection effect */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/20 pointer-events-none" />
                                        <SlotReel
                                            spinning={spinning}
                                            finalIcon={reel}
                                            delay={index * 400}
                                            onStop={handleReelStop}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Jackpot Display */}
                    <div className="relative z-10 text-center pb-4 md:pb-6 px-4">
                        <div className="inline-block bg-gradient-to-r from-[hsl(270_50%_5%)] via-[hsl(270_60%_10%)] to-[hsl(270_50%_5%)] px-6 md:px-10 py-2 md:py-4 rounded-xl md:rounded-2xl border-3 md:border-4 border-[hsl(270_80%_40%)] shadow-[0_0_30px_rgba(167,139,250,0.4),inset_0_2px_10px_rgba(0,0,0,0.5)]">
                            <div className="flex items-center gap-2 md:gap-4">
                                <div className="flex gap-1">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(167,139,250,0.8)]" style={{ animationDelay: `${i * 0.1}s` }} />
                                    ))}
                                </div>
                                <span className="text-xl md:text-3xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent neon-glow tracking-wider drop-shadow-[0_0_20px_rgba(167,139,250,0.6)]">
                                    JACKPOT
                                </span>
                                <div className="flex gap-1">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(192,132,252,0.8)]" style={{ animationDelay: `${i * 0.1}s` }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
