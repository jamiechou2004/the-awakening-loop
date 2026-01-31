import React from 'react';

type EchoNote = {
  id: number;
  name: string;
  text: string;
};

type EchoLogProps = {
  notes: EchoNote[];
};

export const EchoLog: React.FC<EchoLogProps> = ({ notes }) => {
  const hasNotes = notes.length > 0;
  const shouldLoop = notes.length > 4;
  const rollNotes = shouldLoop ? [...notes, ...notes] : notes;
  const duration = Math.max(14, notes.length * 3);

  return (
    <div className="relative h-56 overflow-hidden rounded-xl border border-white/10 bg-black/80 px-4 py-3">
      <div
        className="echo-roll space-y-3 font-mono text-sm text-white/70"
        style={
          {
            '--echo-duration': `${duration}s`,
            '--echo-shift': shouldLoop ? '-50%' : '-100%',
          } as React.CSSProperties
        }
      >
        {hasNotes ? (
          rollNotes.map((note, index) => {
            const baseIndex = notes.length ? index % notes.length : 0;
            const opacity =
              notes.length <= 1 ? 0.8 : 0.35 + (0.65 * baseIndex) / (notes.length - 1);
            return (
              <p key={`${note.id}-${index}`} style={{ opacity }}>
                &gt; [{note.name}]: "{note.text}"
              </p>
            );
          })
        ) : (
          <p className="text-white/40">&gt; [System]: "No echoes yet."</p>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
    </div>
  );
};
