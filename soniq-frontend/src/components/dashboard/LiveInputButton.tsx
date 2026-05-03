import { useState } from 'react';
import { Mic, Monitor, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props { onStart: (stream: MediaStream, kind: 'mic' | 'system') => void; }

export const LiveInputButton = ({ onStart }: Props) => {
  const [open, setOpen] = useState(false);

  const startMic = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      onStart(s, 'mic'); setOpen(false);
    } catch { toast.error('Microphone permission denied.'); }
  };
  const startSystem = async () => {
    const ua = navigator.userAgent;
    if (!/Chrome|Chromium|Edg/.test(ua)) {
      toast.error('System audio capture requires Chrome. Try mic input instead.');
      return;
    }
    try {
      // @ts-ignore - displayMedia audio
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const audioTracks = s.getAudioTracks();
      if (audioTracks.length === 0) { toast.error('No audio captured. Make sure to share a tab with audio.'); s.getTracks().forEach(t => t.stop()); return; }
      // Stop video tracks, we only need audio
      s.getVideoTracks().forEach(t => t.stop());
      const audioOnly = new MediaStream(audioTracks);
      onStart(audioOnly, 'system'); setOpen(false);
    } catch { toast.error('Could not capture system audio.'); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 bottom-4 z-30 glass rounded-full px-4 py-3 flex items-center gap-2 hover:bg-white/10 transition safe-bottom"
      >
        <Mic className="w-4 h-4 text-bass" />
        <span className="font-mono-ui text-[11px] tracking-wider">LIVE INPUT</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setOpen(false)}>
          <div className="glass rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-2xl tracking-wider">LIVE INPUT SOURCE</h3>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <button onClick={startMic} className="w-full glass rounded-xl p-4 flex items-center gap-4 hover:bg-white/5 text-left">
                <Mic className="w-6 h-6 text-bass" />
                <div>
                  <div className="font-display text-lg tracking-wide">MICROPHONE</div>
                  <div className="font-body text-xs text-white/60">Use any connected mic</div>
                </div>
              </button>
              <button onClick={startSystem} className="w-full glass rounded-xl p-4 flex items-center gap-4 hover:bg-white/5 text-left">
                <Monitor className="w-6 h-6 text-drums" />
                <div>
                  <div className="font-display text-lg tracking-wide">SYSTEM AUDIO</div>
                  <div className="font-body text-xs text-white/60">Chrome only — share a tab with audio</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
