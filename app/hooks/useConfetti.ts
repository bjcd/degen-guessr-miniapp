import { useCallback } from 'react';

// Type declaration for js-confetti
declare global {
    interface Window {
        JSConfetti: any;
    }
}

export function useConfetti() {
    const triggerConfetti = useCallback(() => {
        console.log('🎉 Triggering confetti...');

        // Try js-confetti first
        const tryJSConfetti = () => {
            if (typeof window !== 'undefined' && window.JSConfetti) {
                console.log('✅ JSConfetti found, creating instance...');
                try {
                    const jsConfetti = new window.JSConfetti();

                    console.log('✅ JSConfetti instance created, triggering confetti...');
                    // Trigger confetti with ✨ and 🎩 emojis
                    jsConfetti.addConfetti({
                        emojis: ['✨', '🎩'],
                        emojiSize: 50,
                        confettiNumber: 30,
                    });

                    // Add second burst for extra celebration
                    setTimeout(() => {
                        console.log('✅ Triggering second confetti burst...');
                        try {
                            jsConfetti.addConfetti({
                                emojis: ['✨', '🎩'],
                                emojiSize: 40,
                                confettiNumber: 20,
                            });
                            console.log('✅ Second burst successful');
                        } catch (error) {
                            console.error('❌ Second burst failed:', error);
                        }
                    }, 500);

                    // Add third burst for maximum celebration! 🎉
                    setTimeout(() => {
                        console.log('✅ Triggering third confetti burst...');
                        try {
                            jsConfetti.addConfetti({
                                emojis: ['✨', '🎩'],
                                emojiSize: 35,
                                confettiNumber: 25,
                            });
                            console.log('✅ Third burst successful');
                        } catch (error) {
                            console.error('❌ Third burst failed:', error);
                        }
                    }, 1000);
                    return true;
                } catch (error) {
                    console.error('Error with JSConfetti:', error);
                    return false;
                }
            }
            return false;
        };

        // Try js-confetti, fallback to simple celebration
        if (!tryJSConfetti()) {
            console.log('🔄 JSConfetti not available, using fallback celebration...');

            // Simple fallback: create floating emojis
            const createFloatingEmoji = (emoji: string, delay: number) => {
                const emojiEl = document.createElement('div');
                emojiEl.textContent = emoji;
                emojiEl.style.position = 'fixed';
                emojiEl.style.fontSize = '30px';
                emojiEl.style.pointerEvents = 'none';
                emojiEl.style.zIndex = '9999';
                emojiEl.style.left = Math.random() * window.innerWidth + 'px';
                emojiEl.style.top = window.innerHeight + 'px';
                emojiEl.style.animation = `floatUp 3s ease-out forwards`;
                emojiEl.style.animationDelay = delay + 'ms';

                document.body.appendChild(emojiEl);

                setTimeout(() => {
                    if (emojiEl.parentNode) {
                        emojiEl.parentNode.removeChild(emojiEl);
                    }
                }, 3000 + delay);
            };

            // Add CSS animation if not already added
            if (!document.getElementById('confetti-animation')) {
                const style = document.createElement('style');
                style.id = 'confetti-animation';
                style.textContent = `
                    @keyframes floatUp {
                        0% {
                            transform: translateY(0) rotate(0deg);
                            opacity: 1;
                        }
                        100% {
                            transform: translateY(-100vh) rotate(360deg);
                            opacity: 0;
                        }
                    }
                `;
                document.head.appendChild(style);
            }

            // Create multiple floating emojis - 3 waves of celebration!
            const createWave = (startDelay: number, count: number) => {
                for (let i = 0; i < count; i++) {
                    const emoji = Math.random() > 0.5 ? '✨' : '🎩';
                    createFloatingEmoji(emoji, startDelay + i * 100);
                }
            };

            // First wave (immediate)
            console.log('🎉 Creating first wave of floating emojis...');
            createWave(0, 15);

            // Second wave (after 500ms)
            setTimeout(() => {
                console.log('🎉 Creating second wave of floating emojis...');
                createWave(0, 12);
            }, 500);

            // Third wave (after 1000ms)
            setTimeout(() => {
                console.log('🎉 Creating third wave of floating emojis...');
                createWave(0, 10);
            }, 1000);
        }
    }, []);

    return { triggerConfetti };
}
