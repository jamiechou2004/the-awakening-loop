import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type LinearLockProps = {
  active: boolean;
  stage: number;
  onHit: (stage: number) => void;
  onMiss: (stage: number) => void;
};

type StageConfig = {
  speedPerSec: number;
  zoneWidth: number;
};

const STAGE_CONFIG: Record<number, StageConfig> = {
  1: { speedPerSec: 0.38, zoneWidth: 0.26 },
  2: { speedPerSec: 0.6, zoneWidth: 0.18 },
  3: { speedPerSec: 0.9, zoneWidth: 0.12 },
};

const clampStage = (value: number) => Math.min(3, Math.max(1, Math.round(value)));
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const LinearLock: React.FC<LinearLockProps> = ({ active, stage, onHit, onMiss }) => {
  const currentStage = clampStage(stage);
  const config = STAGE_CONFIG[currentStage];

  const positionRef = useRef(0);
  const directionRef = useRef<1 | -1>(1);
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const zoneStartRef = useRef(0);
  const flashTimerRef = useRef<number | null>(null);

  const [position, setPosition] = useState(0);
  const [zoneStart, setZoneStart] = useState(0.32);
  const [flash, setFlash] = useState<'white' | 'red' | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    const maxStart = Math.max(0, 1 - config.zoneWidth);
    const nextStart = Math.random() * maxStart;
    zoneStartRef.current = nextStart;
    setZoneStart(nextStart);
    positionRef.current = 0;
    directionRef.current = 1;
    setPosition(0);
  }, [config.zoneWidth, currentStage]);

  useEffect(() => {
    if (!active) {
      lastTsRef.current = null;
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const loop = (ts: number) => {
      if (lastTsRef.current === null) {
        lastTsRef.current = ts;
      }
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      let next = positionRef.current + dt * config.speedPerSec * directionRef.current;
      if (next >= 1) {
        next = 1 - (next - 1);
        directionRef.current = -1;
      } else if (next <= 0) {
        next = -next;
        directionRef.current = 1;
      }

      positionRef.current = clamp01(next);
      setPosition(positionRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, config.speedPerSec]);

  const triggerFlash = useCallback((tone: 'white' | 'red') => {
    setFlash(tone);
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = window.setTimeout(() => setFlash(null), tone === 'white' ? 140 : 190);
  }, []);

  useEffect(
    () => () => {
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current);
      }
    },
    []
  );

  const handleAttempt = useCallback(() => {
    if (!active) {
      return;
    }
    const start = zoneStartRef.current;
    const end = start + config.zoneWidth;
    const hit = positionRef.current >= start && positionRef.current <= end;
    if (hit) {
      triggerFlash('white');
      onHit(currentStage);
    } else {
      triggerFlash('red');
      setShakeKey((value) => value + 1);
      onMiss(currentStage);
    }
  }, [active, config.zoneWidth, currentStage, onHit, onMiss, triggerFlash]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const handlePointer = () => handleAttempt();
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        handleAttempt();
      }
    };
    window.addEventListener('pointerdown', handlePointer);
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [active, handleAttempt]);

  const zoneLeft = `${zoneStart * 100}%`;
  const zoneWidth = `${config.zoneWidth * 100}%`;
  const cursorLeft = `${position * 100}%`;

  const progressBlocks = useMemo(() => [1, 2, 3], []);

  return (
    <div
      key={shakeKey}
      className={`relative flex h-full w-full flex-col items-center justify-end bg-black/80 pb-14 font-mono ${
        flash === 'red' ? 'knock-shake' : ''
      }`}
    >
      {flash && (
        <div
          className={`pointer-events-none absolute inset-0 z-30 ${
            flash === 'white' ? 'bg-white/30' : 'bg-red-500/30'
          }`}
        />
      )}

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-6 px-6">
        <div className="rounded-sm border border-cyan-400/25 bg-black/85 px-4 py-3 shadow-[0_0_24px_rgba(8,12,20,0.65)]">
          <div className="flex items-center justify-center gap-3">
            {progressBlocks.map((value) => {
              const isCompleted = value < currentStage;
              const isActive = value === currentStage;
              const baseClass = isCompleted
                ? 'border-emerald-200/80 bg-emerald-200/80 shadow-[0_0_14px_rgba(167,243,208,0.55)]'
                : isActive
                  ? currentStage === 3
                    ? 'border-white/90 bg-white shadow-[0_0_18px_rgba(248,113,113,0.7)]'
                    : 'border-cyan-200/90 bg-cyan-300/85 shadow-[0_0_10px_rgba(34,211,238,0.95)]'
                  : 'border-white/25 bg-black/70';
              return (
                <div
                  key={value}
                  className={`h-4 w-12 rounded-sm border ${baseClass} ${
                    isActive ? 'animate-pulse' : ''
                  }`}
                />
              );
            })}
          </div>
        </div>

        <div className="w-full max-w-[640px]">
          <div className="relative h-12 w-full overflow-hidden rounded-md border border-gray-600/80 bg-gray-900/80 shadow-[0_0_28px_rgba(15,23,42,0.45)]">
            <div className="pointer-events-none absolute inset-0 opacity-40 crt-scanlines" />
            <div
              className="absolute inset-y-1 rounded border border-cyan-200/60 bg-cyan-400/65 shadow-[0_0_28px_rgba(34,211,238,0.7)]"
              style={{ left: zoneLeft, width: zoneWidth }}
            />
            <div className="absolute inset-y-0 left-0 w-px bg-white/20" />
            <div className="absolute inset-y-0 right-0 w-px bg-white/20" />
            <div
              className="absolute top-0 h-full w-2 -translate-x-1/2 bg-white shadow-[0_0_18px_rgba(255,255,255,0.9)]"
              style={{ left: cursorLeft }}
            >
              <div className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-cyan-300/80" />
            </div>
          </div>
        </div>

        <p className="text-xs uppercase tracking-[0.55em] text-cyan-100/80">
          Decryption Sequence:{' '}
          <span className="text-white/90">
            [ <span className="animate-pulse text-cyan-300">{currentStage}</span> / 3 ]
          </span>
        </p>
      </div>
    </div>
  );
};
