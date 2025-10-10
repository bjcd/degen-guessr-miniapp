'use client';

interface WalletConnectProps {
    onConnect: () => void;
}

export default function WalletConnect({ onConnect }: WalletConnectProps) {
  return (
    <div className="card text-center neon-glow">
      <div className="mb-6">
        <div className="w-16 h-16 bg-gradient-to-r from-neon-green to-neon-purple rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-neon">
          <span className="text-3xl">🔗</span>
        </div>
        <h2 className="text-2xl font-black text-text-primary mb-2 gradient-text">Sign in to Play</h2>
        <p className="text-text-secondary text-sm font-medium">
          Connect with Farcaster to start your degen journey
        </p>
      </div>
      
      <button
        onClick={onConnect}
        className="btn-primary w-full text-lg py-4 font-black"
      >
        🚀 SIGN IN WITH FARCASTER
      </button>
      
      <div className="mt-6 p-4 bg-gradient-to-r from-neon-green/10 to-neon-purple/10 rounded-xl border border-neon-green/20">
        <h3 className="font-black text-text-primary mb-3 text-sm gradient-text">HOW TO PLAY:</h3>
        <ul className="text-xs text-text-secondary space-y-2 text-left font-medium">
          <li className="flex items-center">
            <span className="w-2 h-2 bg-neon-green rounded-full mr-2"></span>
            Guess a number between 1-100
          </li>
          <li className="flex items-center">
            <span className="w-2 h-2 bg-neon-purple rounded-full mr-2"></span>
            Each guess costs 100 $DEGEN
          </li>
          <li className="flex items-center">
            <span className="w-2 h-2 bg-neon-orange rounded-full mr-2"></span>
            90 to pot, 10 to treasury
          </li>
          <li className="flex items-center">
            <span className="w-2 h-2 bg-neon-green rounded-full mr-2"></span>
            Win the entire pot if you guess correctly!
          </li>
        </ul>
      </div>
    </div>
  );
}
