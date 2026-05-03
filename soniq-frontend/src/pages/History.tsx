import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getHistory } from '@/lib/history';

const History = () => {
  const items = getHistory();
  return (
    <main className="min-h-screen bg-background py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-mono-ui mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> BACK
        </Link>
        <h1 className="font-display text-5xl tracking-wider text-glow-white mb-8">HISTORY</h1>
        {items.length === 0 ? (
          <div className="font-body text-white/40 text-sm">No tracks analyzed yet.</div>
        ) : (
          <ul className="space-y-2">
            {items.map(i => (
              <li key={i.id} className="glass rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-mono-ui text-sm text-white">{i.name}</div>
                  <div className="font-mono-ui text-[10px] text-white/40">
                    {i.genre ?? '—'} · {i.bpm ?? '—'} BPM · {new Date(i.analyzedAt).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
};

export default History;
