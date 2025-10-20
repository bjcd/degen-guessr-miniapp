"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Trophy, Zap, Crown, Sparkles } from "lucide-react";
import Image from "next/image";
import { useContract } from "../hooks/useContract";

interface ModeSelectionDialogProps {
    isOpen: boolean;
    onSelectMode: (mode: 'degen' | 'super-degen') => void;
    onClose: () => void;
}

export default function ModeSelectionDialog({ isOpen, onSelectMode, onClose }: ModeSelectionDialogProps) {
    const [degenPot, setDegenPot] = useState(0);
    const [superDegenPot, setSuperDegenPot] = useState(0);
    const [isLoadingPots, setIsLoadingPots] = useState(true);

    // Get pot values for both modes
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
            const [degenPotValue, superDegenPotValue] = await Promise.all([
                degenContract.getPot(),
                superDegenContract.getPot()
            ]);
            setDegenPot(degenPotValue);
            setSuperDegenPot(superDegenPotValue);
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
                            CHOOSE MODE
                        </h1>
                        <Image src="/degen-logo.png" alt="Degen Hat" width={48} height={48} className="w-12 h-12 object-contain animate-[bounce_2s_ease-in-out_infinite] scale-x-[-1]" />
                    </div>
                    <p className="text-muted-foreground text-lg">Pick your poison and let's get degen! 🎩</p>
                </div>

                {/* Mode Selection */}
                <div className="p-8">
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Degen Mode */}
                        <Card className="glass-card gradient-border p-8 relative overflow-hidden hover:scale-105 transition-transform duration-300">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10" />
                            <div className="relative z-10 space-y-6">
                                {/* Mode Header */}
                                <div className="text-center space-y-2">
                                    <div className="flex items-center justify-center gap-2 text-primary font-bold text-xl">
                                        <Crown className="w-6 h-6" />
                                        <span>Degen Mode</span>
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
                                        Lower odds, but more cautious stakes
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

                        {/* Super Degen Mode */}
                        <Card className="glass-card gradient-border p-8 relative overflow-hidden hover:scale-105 transition-transform duration-300">
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-orange-500/5 to-red-500/10" />
                            <div className="relative z-10 space-y-6">
                                {/* Mode Header */}
                                <div className="text-center space-y-2">
                                    <div className="flex items-center justify-center gap-2 text-yellow-400 font-bold text-xl">
                                        <Crown className="w-6 h-6" />
                                        <span>Super Degen Mode</span>
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
                                        Better odds, higher stakes
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
