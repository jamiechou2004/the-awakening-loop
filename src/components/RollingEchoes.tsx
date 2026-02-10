import React from 'react';
import { LiveSignalFeed } from './LiveSignalFeed';

const AUTHOR_CREDIT = 'Jamie Zhou';

type EchoEntry = {
  name: string;
  text: string;
};

type RollingEchoesProps = {
  onRestart?: () => void;
  finalEntry?: EchoEntry | null;
  echoes?: EchoEntry[];
};

export const RollingEchoes: React.FC<RollingEchoesProps> = ({
  onRestart,
  finalEntry,
  echoes = [],
}) => {
  const operatorName = finalEntry?.name?.trim() || 'Operator';
  const systemEchoes = echoes.filter(
    (entry) => entry.text.trim() && entry.text.trim() !== finalEntry?.text.trim()
  );

  return (
    <div className="fixed inset-0 z-50 flex w-full justify-center overflow-hidden bg-black">
      {onRestart && (
        <button
          className="absolute right-6 top-6 z-[60] rounded-sm border border-yellow-400/40 bg-black/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.35em] text-yellow-300"
          onClick={onRestart}
        >
          New Session
        </button>
      )}
      <div className="relative h-full w-full max-w-5xl" style={{ perspective: '400px' }}>
        <div className="pointer-events-none absolute inset-0 flex justify-center">
        <div
          className="animate-crawl absolute top-full w-full max-w-4xl origin-top rotate-x-[20deg] translate-y-[100%] px-6"
          style={{ animationIterationCount: 1, animationFillMode: 'forwards' }}
        >
            <div className="space-y-10 pt-24 text-center font-mono leading-relaxed tracking-widest text-yellow-400">
              {finalEntry && (
                <div className="space-y-4">
                  <p className="text-3xl font-extrabold">OPERATOR PRIORITY LOG</p>
                  <p className="text-4xl font-black text-yellow-300 drop-shadow-[0_0_18px_rgba(250,204,21,0.35)]">
                    {finalEntry.name}
                  </p>
                  <p className="mx-auto max-w-3xl text-2xl font-bold text-yellow-200">
                    "{finalEntry.text}"
                  </p>
                </div>
              )}

              <div className="space-y-2 text-2xl font-bold">
                <p className="text-yellow-300">SYSTEM LOGS</p>
                <p className="text-yellow-200/90">Connection Closed...</p>
                <p className="text-yellow-200/90">Jeti Status: FREE</p>
                <p className="text-yellow-200/90">Signal archived in echo memory.</p>
              </div>

              <div className="space-y-2 text-2xl font-bold">
                <p className="text-yellow-300">CREDITS</p>
                <p className="py-1 text-3xl font-extrabold text-yellow-300 drop-shadow-[0_0_16px_rgba(250,204,21,0.35)]">
                  Design &amp; Concept: {AUTHOR_CREDIT}
                </p>
                <p className="text-yellow-200/90">Visuals: Jeti Unit</p>
                <p className="text-yellow-200/90">Special Thanks: Google Xi Event &amp; Gemini AI</p>
              </div>

              <div className="space-y-4 text-2xl font-bold">
                <p className="text-yellow-300">SIGNAL FEED</p>
                <LiveSignalFeed echoes={systemEchoes} />
                <p className="pt-2 text-yellow-300/90">ROLLING ECHOES</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
