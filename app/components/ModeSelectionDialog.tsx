"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Trophy, Zap, Crown, Sparkles } from "lucide-react";
import Image from "next/image";
import { useContract } from "../hooks/useContract";

interface ModeSelectionDialogProps {
    isOpen: boolean;
    onSelectMode: (mode: 'mega-degen' | 'degen' | 'super-degen') => void;
    onClose: () => void;
}

export default function ModeSelectionDialog({ isOpen, onSelectMode, onClose }: ModeSelectionDialogProps) {
    const [megaDegenPot, setMegaDegenPot] = useState(0);
    const [degenPot, setDegenPot] = useState(0);
    const [superDegenPot, setSuperDegenPot] = useState(0);
    const [isLoadingPots, setIsLoadingPots] = useState(true);

    // Get pot values for all modes
    const megaDegenContract = useContract(undefined, process.env.NEXT_PUBLIC_SLOT_CONTRACT_ADDRESS || '0x6285b23b5CbDD84187B15cC1aC23cFC5F659Ac21');
    const degenContract = useContract(undefined, process.env.NEXT_PUBLIC_CONTRACT_ADDRESS);
    const superDegenContract = useContract(undefined, process.env.NEXT_PUBLIC_CONTRACT_1000_ADDRESS);

    useEffect(() => {
        if (isOpen) {
            loadPotValues();
        }
    }, [isOpen]);

    const loadPotValues = async () => {
        try {
            setIsLoadingPots(true);

            // Load pots sequentially to avoid RPC batch limits
            try {
                const megaDegenPotValue = await megaDegenContract.getPot();
                setMegaDegenPot(megaDegenPotValue);
            } catch (error) {
                console.error('Error loading Mega Degen pot:', error);
            }

            try {
                const degenPotValue = await degenContract.getPot();
                setDegenPot(degenPotValue);
            } catch (error) {
                console.error('Error loading Degen pot:', error);
            }

            try {
                const superDegenPotValue = await superDegenContract.getPot();
                setSuperDegenPot(superDegenPotValue);
            } catch (error) {
                console.error('Error loading Super Degen pot:', error);
            }
        } catch (error) {
            console.error('Error loading pot values:', error);
        } finally {
            setIsLoadingPots(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-background via-[hsl(270_50%_10%)] to-background rounded-3xl border-2 border-primary/30 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-8 text-center border-b border-primary/20">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <Image src="/degen-logo.png" alt="Degen Hat" width={48} height={48} className="w-12 h-12 object-contain animate-[bounce_2s_ease-in-out_infinite]" />
                        <h1 className="text-4xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent neon-glow">
                            CHOOSE GAME
                        </h1>
                        <Image src="/degen-logo.png" alt="Degen Hat" width={48} height={48} className="w-12 h-12 object-contain animate-[bounce_2s_ease-in-out_infinite] scale-x-[-1]" />
                    </div>
                    <p className="text-muted-foreground text-lg">Pick your poison and let's get degen! 🎩</p>
                </div>

                {/* Mode Selection */}
                <div className="p-8 space-y-8">
                    {/* Mega Degen - Slot Machine */}
                    <Card className="glass-card gradient-border p-8 relative overflow-hidden hover:scale-105 transition-transform duration-300 border-4 border-gradient-to-r from-purple-500/30 via-pink-500/30 to-red-500/30">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/15 via-pink-500/10 to-red-500/15" />
                        <div className="relative z-10 space-y-6">
                            {/* Mode Header */}
                            <div className="text-center space-y-2">
                                <div className="flex items-center justify-center gap-2 text-purple-400 font-bold text-xl relative">
                                    <Crown className="w-6 h-6" />
                                    <span>Mega Degen</span>
                                    <span className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white text-xs px-3 py-1 rounded-full animate-pulse font-black shadow-lg">
                                        NEW
                                    </span>
                                </div>
                                <div className="text-3xl font-black bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
                                    {isLoadingPots ? (
                                        <div className="animate-pulse">...</div>
                                    ) : (
                                        `${Math.floor(megaDegenPot)} $DEGEN`
                                    )}
                                </div>
                                <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
                                    <Trophy className="w-4 h-4" />
                                    <span>CURRENT PRIZE POT</span>
                                </div>
                            </div>

                            {/* Slot Display */}
                            <div className="flex items-center justify-center gap-4 text-6xl font-black">
                                <span>⭐</span>
                                <span>🎩</span>
                                <span>🍒</span>
                            </div>

                            {/* Mode Details */}
                            <div className="space-y-3 text-center">
                                <p className="text-foreground font-semibold">
                                    Spin the machine slot to win FAST 🔥
                                </p>
                                <div className="bg-muted/40 rounded-xl p-4 space-y-2">
                                    <div className="flex items-center justify-center gap-2 text-sm">
                                        <Zap className="w-4 h-4 text-purple-400" />
                                        <span className="font-bold">100 DEGEN per spin</span>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-sm">
                                        <Sparkles className="w-4 h-4 text-pink-400" />
                                        <span>50% chance to win</span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Button */}
                            <Button
                                onClick={() => onSelectMode('mega-degen')}
                                className="w-full h-16 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-black text-xl transition-all duration-300 rounded-2xl flex items-center justify-center gap-3 shadow-lg"
                            >
                                <span>Play Mega Degen</span>
                                <Sparkles className="w-6 h-6" />
                            </Button>
                        </div>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Guessr Degen Mode */}
                        <Card className="glass-card gradient-border p-8 relative overflow-hidden hover:scale-105 transition-transform duration-300">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10" />
                            <div className="relative z-10 space-y-6">
                                {/* Mode Header */}
                                <div className="text-center space-y-2">
                                    <div className="flex items-center justify-center gap-2 text-primary font-bold text-xl">
                                        <Crown className="w-6 h-6" />
                                        <span>Degen Guessr</span>
                                    </div>
                                    <div className="text-3xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                                        {isLoadingPots ? (
                                            <div className="animate-pulse">...</div>
                                        ) : (
                                            `${Math.floor(degenPot)} $DEGEN`
                                        )}
                                    </div>
                                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
                                        <Trophy className="w-4 h-4" />
                                        <span>CURRENT PRIZE POT</span>
                                    </div>
                                </div>

                                {/* Mode Details */}
                                <div className="space-y-3 text-center">
                                    <p className="text-foreground font-semibold">
                                        Guess a number between 1 and 100. Lower odds, cautious stakes
                                    </p>
                                    <div className="bg-muted/40 rounded-xl p-4 space-y-2">
                                        <div className="flex items-center justify-center gap-2 text-sm">
                                            <Zap className="w-4 h-4 text-yellow-500" />
                                            <span className="font-bold">100 DEGEN per guess</span>
                                        </div>
                                        <div className="flex items-center justify-center gap-2 text-sm">
                                            <Sparkles className="w-4 h-4 text-primary" />
                                            <span>1 in 100 chances</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Button */}
                                <Button
                                    onClick={() => onSelectMode('degen')}
                                    className="w-full h-16 bg-gradient-to-r from-primary to-secondary hover:from-primary-glow hover:to-secondary-glow text-white font-black text-xl transition-all duration-300 neon-button rounded-2xl flex items-center justify-center gap-3"
                                >
                                    <span>I'm feeling lucky 🍀</span>
                                </Button>
                            </div>
                        </Card>

                        {/* Guessr Super Degen Mode */}
                        <Card className="glass-card gradient-border p-8 relative overflow-hidden hover:scale-105 transition-transform duration-300">
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-orange-500/5 to-red-500/10" />
                            <div className="relative z-10 space-y-6">
                                {/* Mode Header */}
                                <div className="text-center space-y-2">
                                    <div className="flex items-center justify-center gap-2 text-yellow-400 font-bold text-xl">
                                        <Crown className="w-6 h-6" />
                                        <span>Degen Guessr Super</span>
                                    </div>
                                    <div className="text-3xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                                        {isLoadingPots ? (
                                            <div className="animate-pulse">...</div>
                                        ) : (
                                            `${Math.floor(superDegenPot)} $DEGEN`
                                        )}
                                    </div>
                                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
                                        <Trophy className="w-4 h-4" />
                                        <span>CURRENT PRIZE POT</span>
                                    </div>
                                </div>

                                {/* Mode Details */}
                                <div className="space-y-3 text-center">
                                    <p className="text-foreground font-semibold">
                                        Guess a number between 1 and 10. Good odds, higher stakes.
                                    </p>
                                    <div className="bg-muted/40 rounded-xl p-4 space-y-2">
                                        <div className="flex items-center justify-center gap-2 text-sm">
                                            <Zap className="w-4 h-4 text-yellow-500" />
                                            <span className="font-bold">1000 DEGEN per guess</span>
                                        </div>
                                        <div className="flex items-center justify-center gap-2 text-sm">
                                            <Sparkles className="w-4 h-4 text-yellow-400" />
                                            <span>1 in 10 chances</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Button */}
                                <Button
                                    onClick={() => onSelectMode('super-degen')}
                                    className="w-full h-16 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-black text-xl transition-all duration-300 rounded-2xl flex items-center justify-center gap-3"
                                >
                                    <Crown className="w-8 h-8" />
                                    <span>I'm feeling degen 🎩</span>
                                </Button>
                            </div>
                        </Card>
                    </div>

                    {/* Close Button */}
                    <div className="mt-8 text-center">
                        <Button
                            onClick={onClose}
                            variant="outline"
                            className="px-8 py-3 border-primary/30 text-primary hover:bg-primary/10"
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
