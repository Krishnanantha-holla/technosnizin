import { useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';

const GENRE_COLORS: Record<string, string> = {
  Electronic: '#00F5FF', Rock: '#FF2D55', Jazz: '#FFD700', 'Hip-Hop': '#BF5FFF',
  Pop: '#FF8C00', Classical: '#00FFC8', Ambient: '#00FFC8', Unknown: '#888',
};

export const GenreBadge = () => {
  const [expanded, setExpanded] = useState(false);
  const track = usePlayerStore(s => s.track);
  if (!track?.genre) return null;
  const color = GENRE_COLORS[track.genre] || '#FFFFFF';
  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onClick={() => setExpanded(e => !e)}
      className="glass rounded-full px-3 py-1.5 cursor-pointer transition-all"
      style={{ borderColor: color }}
    >
      <div className="font-mono-ui text-[10px] tracking-wider" style={{ color }}>
        {track.genre.toUpperCase()}
        {expanded && (
          <span className="ml-3 text-white/70">
            BPM: {track.bpm ?? '—'} · KEY: {track.key ?? '—'}
          </span>
        )}
      </div>
    </div>
  );
};
