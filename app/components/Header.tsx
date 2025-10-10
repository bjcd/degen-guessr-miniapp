'use client';

interface HeaderProps {
    user?: any;
    onSignOut?: () => void;
}

export default function Header({ user, onSignOut }: HeaderProps) {
  return (
    <header className="bg-card-bg/80 backdrop-blur-sm border-b border-gray-700">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-neon-green to-neon-purple rounded-xl flex items-center justify-center neon-glow">
              <span className="text-black font-black text-xl">🎯</span>
            </div>
            <div>
              <h1 className="text-lg font-black text-text-primary">DEGEN GUESS</h1>
              <p className="text-xs text-text-secondary font-medium">Base • VRF • Fair</p>
            </div>
          </div>
          
          {user && (
            <div className="flex items-center space-x-3">
              <img 
                src={user.pfpUrl} 
                alt={user.displayName}
                className="w-10 h-10 rounded-full border-2 border-neon-green"
              />
              <div className="text-right">
                <p className="text-sm font-bold text-text-primary">{user.displayName}</p>
                <p className="text-xs text-text-secondary">@{user.username}</p>
              </div>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="text-xs text-text-secondary hover:text-neon-green transition-colors"
                >
                  Sign Out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
