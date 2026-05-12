import { useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';

const GENRE_COLORS: Record<string, string> = {
  Electronic: '#00F5FF',
  Rock: '#FF2D55',
  Jazz: '#FFD700',
  'Hip-Hop': '#BF5FFF',
  Pop: '#FF8C00',
  Classical: '#00FFC8',
  Ambient: '#00FFC8',
  Unknown: '#888',
};

export const GenreBadge = () => {
  const [expanded, setExpanded] = useState(false);
  const track = usePlayerStore(s => s.track);
  if (!track?.genre) return null;

  const color = GENRE_COLORS[track.genre] ?? '#FFFFFF';

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      className="glass rounded-full px-3 py-1.5 transition-all text-left"
      style={{ borderColor: color }}
      aria-label={`Genre: ${track.genre}. Click for details.`}
    >
      <div className="font-mono-ui text-[10px] tracking-wider flex items-center gap-2 flex-wrap" style={{ color }}>
        <span>{track.genre.toUpperCase()}</span>
        {expanded && (
          <span className="text-white/70">
            BPM: {track.bpm ?? '—'} · KEY: {track.key ?? '—'}
          </span>
        )}
      </div>
    </button>
  );
};
