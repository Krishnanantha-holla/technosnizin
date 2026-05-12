import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, Music2, ListMusic, Plus, Play, ChevronLeft } from 'lucide-react';
import { searchTracks, getBestAlbumArt, getUserPlaylists, getPlaylistTracks, addToQueue, type SpotifyTrack, type SpotifyPlaylist } from '@/lib/spotifyApi';
import { spotifyPlayer } from '@/lib/spotifyPlayer';
import { toast } from 'sonner';

interface Props {
  onPickTrack: (track: SpotifyTrack) => void;
}

type Tab = 'search' | 'playlists';

export const SpotifySearch = ({ onPickTrack }: Props) => {
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [open, setOpen] = useState(false);

  // Playlists
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
  const [playlistTracksLoading, setPlaylistTracksLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  // Debounced search
  useEffect(() => {
    if (tab !== 'search') return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }

    timerRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const tracks = await searchTracks(query, 8);
        setResults(tracks);
        setActiveIdx(0);
        setOpen(tracks.length > 0);
      } catch {
        setResults([]); setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [query, tab]);

  // Load playlists when tab switches
  useEffect(() => {
    if (tab !== 'playlists' || playlists.length > 0) return;
    setPlaylistsLoading(true);
    getUserPlaylists(50)
      .then(data => {
        setPlaylists(data);
        if (data.length === 0) toast('No playlists found — make sure you re-connected Spotify after the latest update');
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Could not load playlists: ${msg}`);
      })
      .finally(() => setPlaylistsLoading(false));
  }, [tab, playlists.length]);

  const openPlaylist = async (pl: SpotifyPlaylist) => {
    setSelectedPlaylist(pl);
    setPlaylistTracksLoading(true);
    try {
      const tracks = await getPlaylistTracks(pl.id, 50);
      setPlaylistTracks(tracks);
    } catch {
      toast.error('Could not load playlist tracks');
    } finally {
      setPlaylistTracksLoading(false);
    }
  };

  const pick = (track: SpotifyTrack) => {
    setQuery(''); setResults([]); setOpen(false);
    onPickTrack(track);
  };

  const queueTrack = async (track: SpotifyTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    const deviceId = spotifyPlayer.getDeviceId();
    if (!deviceId) { toast.error('Start playing a track first to use the queue'); return; }
    try {
      await addToQueue(track.uri, deviceId);
      toast.success(`Added to queue: ${track.name}`);
    } catch {
      toast.error('Could not add to queue');
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(results.length - 1, i + 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); }
    if (e.key === 'Enter')     { e.preventDefault(); const t = results[activeIdx]; if (t) pick(t); }
    if (e.key === 'Escape')    { setOpen(false); inputRef.current?.blur(); }
  };

  const fmtDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className="w-full">
      {/* Tab bar */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setTab('search')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono-ui text-[10px] tracking-wider transition ${
            tab === 'search' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Search className="w-3 h-3" /> SEARCH
        </button>
        <button
          onClick={() => setTab('playlists')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono-ui text-[10px] tracking-wider transition ${
            tab === 'playlists' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <ListMusic className="w-3 h-3" /> PLAYLISTS
        </button>
      </div>

      {/* ── Search tab ── */}
      {tab === 'search' && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 animate-spin" />}
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              onFocus={() => results.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Search any song on Spotify..."
              className="w-full h-12 pl-10 pr-10 rounded-xl border border-white/15 bg-white/5 text-white text-sm placeholder:text-white/30 outline-none focus:border-[#1DB954]/60 transition"
              aria-label="Search Spotify"
            />
          </div>

          {open && results.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 glass rounded-xl overflow-hidden shadow-2xl border border-white/10">
              {results.map((track, i) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition group ${
                    i === activeIdx ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                  onMouseDown={() => pick(track)}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  {getBestAlbumArt(track, 'small') ? (
                    <img src={getBestAlbumArt(track, 'small')} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Music2 className="w-4 h-4 text-white/30" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-mono-ui text-sm text-white truncate">{track.name}</div>
                    <div className="font-mono-ui text-[11px] text-white/45 truncate">
                      {track.artists.map(a => a.name).join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono-ui text-[10px] text-white/30">{fmtDuration(track.duration_ms)}</span>
                    <button
                      onMouseDown={e => { e.stopPropagation(); void queueTrack(track, e); }}
                      title="Add to queue"
                      className="opacity-0 group-hover:opacity-100 text-white/50 hover:text-white transition p-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Playlists tab ── */}
      {tab === 'playlists' && (
        <div className="glass rounded-xl overflow-hidden border border-white/10 max-h-72 overflow-y-auto">
          {/* Playlist list */}
          {!selectedPlaylist && (
            <>
              {playlistsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
                </div>
              )}
              {!playlistsLoading && playlists.length === 0 && (
                <div className="py-6 text-center font-mono-ui text-[11px] text-white/30">No playlists found</div>
              )}
              {playlists.map(pl => (
                <button
                  key={pl.id}
                  onClick={() => void openPlaylist(pl)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition text-left"
                >
                  {pl.images[0]?.url ? (
                    <img src={pl.images[0].url} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
                      <ListMusic className="w-4 h-4 text-white/30" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-mono-ui text-sm text-white truncate">{pl.name}</div>
                    <div className="font-mono-ui text-[10px] text-white/40">{pl.tracks.total} tracks</div>
                  </div>
                  <Play className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                </button>
              ))}
            </>
          )}

          {/* Playlist tracks */}
          {selectedPlaylist && (
            <>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/8 sticky top-0 bg-black/80 backdrop-blur-sm">
                <button onClick={() => setSelectedPlaylist(null)} className="text-white/50 hover:text-white transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono-ui text-[11px] text-white/70 truncate">{selectedPlaylist.name}</span>
              </div>
              {playlistTracksLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
                </div>
              )}
              {playlistTracks.map(track => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition cursor-pointer group"
                  onClick={() => pick(track)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono-ui text-[12px] text-white truncate">{track.name}</div>
                    <div className="font-mono-ui text-[10px] text-white/40 truncate">
                      {track.artists.map(a => a.name).join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono-ui text-[10px] text-white/25">{fmtDuration(track.duration_ms)}</span>
                    <button
                      onClick={e => void queueTrack(track, e)}
                      title="Add to queue"
                      className="opacity-0 group-hover:opacity-100 text-white/50 hover:text-white transition p-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
