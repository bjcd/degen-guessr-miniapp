'use client';

interface GameInterfaceProps {
    guess: number;
    setGuess: (guess: number) => void;
    onGuess: () => void;
    isLoading: boolean;
    gameStatus: 'idle' | 'guessing' | 'waiting' | 'result';
    pot: string;
    playerWins: string;
    degenBalance: string;
    lastResult: {
        type: 'win' | 'miss';
        guessedNumber: number;
        winningNumber: number;
        amount?: string;
    } | null;
    isDemoMode?: boolean;
    user?: any;
}

export default function GameInterface({
    guess,
    setGuess,
    onGuess,
    isLoading,
    gameStatus,
    pot,
    playerWins,
    degenBalance,
    lastResult,
    isDemoMode = false,
    user,
}: GameInterfaceProps) {
    const getStatusMessage = () => {
        switch (gameStatus) {
            case 'guessing':
                return 'Submitting your guess...';
            case 'waiting':
                return 'Waiting for random number...';
            case 'result':
                return lastResult?.type === 'win' ? 'You won!' : 'Better luck next time!';
            default:
                return 'Make your guess!';
        }
    };

    const getStatusColor = () => {
        switch (gameStatus) {
            case 'guessing':
            case 'waiting':
                return 'text-blue-600';
            case 'result':
                return lastResult?.type === 'win' ? 'text-green-600' : 'text-red-600';
            default:
                return 'text-gray-600';
        }
    };

  return (
    <div className="space-y-6">
      {/* Game Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-4 neon-glow">
          <div className="text-2xl font-black text-neon-green neon-text">{pot}</div>
          <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">Pot</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-black text-neon-purple">{playerWins}</div>
          <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">Wins</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-black text-neon-orange">{degenBalance}</div>
          <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">Balance</div>
        </div>
      </div>

      {/* Game Interface */}
      <div className="card neon-glow">
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-text-primary mb-3 gradient-text">
            {getStatusMessage()}
          </h2>
          {isDemoMode && (
            <div className="mb-4 p-3 bg-gradient-to-r from-neon-orange/20 to-neon-purple/20 border border-neon-orange/30 rounded-xl">
              <p className="text-xs text-neon-orange font-bold">
                🎮 DEMO MODE - NO REAL TOKENS
              </p>
            </div>
          )}
          <p className={`text-sm font-medium ${getStatusColor()}`}>
            {gameStatus === 'waiting' && 'This may take a few moments...'}
            {gameStatus === 'result' && lastResult && (
              <>
                You guessed {lastResult.guessedNumber}, winning number was {lastResult.winningNumber}
                {lastResult.type === 'win' && ` - You won ${lastResult.amount} $DEGEN!`}
              </>
            )}
          </p>
        </div>

        {/* Guess Input */}
        <div className="mb-6">
          <label htmlFor="guess" className="block text-sm font-bold text-text-primary mb-3 uppercase tracking-wider">
            Enter your guess (1-100)
          </label>
          <input
            id="guess"
            type="number"
            min="1"
            max="100"
            value={guess}
            onChange={(e) => setGuess(parseInt(e.target.value) || 1)}
            className="input-field"
            disabled={isLoading || gameStatus === 'waiting'}
          />
        </div>

        {/* Guess Button */}
        <button
          onClick={onGuess}
          disabled={isLoading || gameStatus === 'waiting' || parseFloat(degenBalance) < 100}
          className="btn-primary w-full text-lg py-4 font-black"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black mr-3"></div>
              {gameStatus === 'guessing' ? 'SUBMITTING...' : 'WAITING...'}
            </div>
          ) : (
            `🎯 GUESS FOR 100 $DEGEN`
          )}
        </button>

        {parseFloat(degenBalance) < 100 && (
          <p className="text-neon-orange text-sm text-center mt-3 font-bold">
            Insufficient DEGEN balance. You need at least 100 $DEGEN to play.
          </p>
        )}
            </div>

      {/* Game Rules */}
      <div className="card bg-gradient-to-r from-neon-green/5 to-neon-purple/5 border border-neon-green/20 py-4">
        <h3 className="font-black text-text-primary mb-4 text-sm gradient-text uppercase tracking-wider">Game Rules</h3>
        <div className="grid grid-cols-2 gap-4 text-xs text-text-secondary">
          <div>
            <h4 className="font-black text-text-primary mb-2 text-xs uppercase tracking-wider">How it works:</h4>
            <ul className="space-y-2">
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-neon-green rounded-full mr-2"></span>
                Guess 1-100
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-neon-purple rounded-full mr-2"></span>
                100 $DEGEN per guess
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-neon-orange rounded-full mr-2"></span>
                90 to pot, 10 to treasury
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-black text-text-primary mb-2 text-xs uppercase tracking-wider">Fairness:</h4>
            <ul className="space-y-2">
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-neon-green rounded-full mr-2"></span>
                Chainlink VRF randomness
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-neon-purple rounded-full mr-2"></span>
                No admin control
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-neon-orange rounded-full mr-2"></span>
                Win entire pot!
              </li>
            </ul>
          </div>
        </div>
      </div>
        </div>
    );
}
