import { Link } from 'react-router-dom';
import { Settings, History } from 'lucide-react';

interface Props { showLinks?: boolean; minimal?: boolean; }

export const Topbar = ({ showLinks = true, minimal = false }: Props) => {
  return (
    <header className={`fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-6 py-4 ${minimal ? 'pointer-events-none' : ''}`}>
      <Link to="/" className="font-display text-3xl sm:text-4xl tracking-wider text-white pointer-events-auto text-glow-white">
        SONIQ
      </Link>
      {showLinks && (
        <div className="flex items-center gap-2 pointer-events-auto">
          <Link to="/history" aria-label="History" className="glass rounded-full p-2.5 hover:bg-white/10 transition">
            <History className="w-4 h-4" />
          </Link>
          <Link to="/settings" aria-label="Settings" className="glass rounded-full p-2.5 hover:bg-white/10 transition">
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      )}
    </header>
  );
};
