import { useCallback, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

interface Props { onFile: (file: File) => void; }

export const DropZone = ({ onFile }: Props) => {
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|m4a|ogg)$/i.test(file.name)) {
      toast.error('Please upload an audio file (MP3, WAV, FLAC).');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large. Max 50MB.');
      return;
    }
    // Simulated upload progress for UX
    setProgress(0);
    let p = 0;
    const id = setInterval(() => {
      p += 10 + Math.random() * 25;
      if (p >= 100) {
        clearInterval(id);
        setProgress(null);
        onFile(file);
      } else setProgress(Math.min(95, p));
    }, 80);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300 ${drag ? 'border-white scale-[1.02] bg-white/5' : 'border-border hover:border-white/60'} p-12 md:p-20 text-center`}
    >
      <input ref={inputRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <UploadCloud className="w-16 h-16 mx-auto mb-6 text-white/80" style={{ filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.4))' }} />
      <div className="font-display text-4xl md:text-5xl text-white mb-2">DROP YOUR TRACK HERE</div>
      <div className="font-body text-white/60 mb-1">or click to browse</div>
      <div className="font-mono-ui text-xs text-white/40">MP3 · WAV · FLAC — up to 50MB</div>
      {progress !== null && (
        <div className="mt-6 max-w-md mx-auto">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="font-mono-ui text-[11px] text-white/50 mt-2">UPLOADING {Math.round(progress)}%</div>
        </div>
      )}
    </div>
  );
};
