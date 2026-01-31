import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PrecisionLockProps = {
  active: boolean;
  stage: number;
  onHit: (stage: number) => void;
  onMiss: (stage: number) => void;
};

type StageConfig = {
  speedDegPerSec: number;
  zoneSizeDeg: number;
  direction: 1 | -1;
};

const STAGE_CONFIG: Record<number, StageConfig> = {
  1: { speedDegPerSec: 70, zoneSizeDeg: 60, direction: 1 },
  2: { speedDegPerSec: 120, zoneSizeDeg: 40, direction: 1 },
  3: { speedDegPerSec: 190, zoneSizeDeg: 20, direction: -1 },
};

const clampStage = (value: number) => Math.min(3, Math.max(1, Math.round(value)));

const normalizeAngle = (deg: number) => {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
};

const isAngleInArc = (angle: number, start: number, size: number) => {
  const a = normalizeAngle(angle);
  const s = normalizeAngle(start);
  const e = normalizeAngle(start + size);
  if (s <= e) {
    return a >= s && a <= e;
  }
  return a >= s || a <= e;
};

export const PrecisionLock: React.FC<PrecisionLockProps> = ({ active, stage, onHit, onMiss }) => {
  const currentStage = clampStage(stage);
  const config = STAGE_CONFIG[currentStage];

  const angleRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const zoneStartRef = useRef(0);
  const flashTimerRef = useRef<number | null>(null);

  const [angle, setAngle] = useState(0);
  const [zoneStart, setZoneStart] = useState(0);
  const [flash, setFlash] = useState<'white' | 'red' | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    const size = config.zoneSizeDeg;
    const nextStart = Math.random() * (360 - size);
    zoneStartRef.current = nextStart;
    setZoneStart(nextStart);
  }, [config.zoneSizeDeg, currentStage]);

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
      angleRef.current = normalizeAngle(
        angleRef.current + dt * config.speedDegPerSec * config.direction
      );
      setAngle(angleRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, config.direction, config.speedDegPerSec]);

  const triggerFlash = useCallback((tone: 'white' | 'red') => {
    setFlash(tone);
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = window.setTimeout(() => {
      setFlash(null);
    }, tone === 'white' ? 140 : 180);
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
    const hit = isAngleInArc(angleRef.current, zoneStartRef.current, config.zoneSizeDeg);
    if (hit) {
      triggerFlash('white');
      onHit(currentStage);
    } else {
      triggerFlash('red');
      setShakeKey((value) => value + 1);
      onMiss(currentStage);
    }
  }, [active, config.zoneSizeDeg, currentStage, onHit, onMiss, triggerFlash]);

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

  const ringSize = 288;
  const strokeWidth = 16;
  const radius = ringSize / 2 - strokeWidth / 2 - 6;
  const size = ringSize;
  const circumference = 2 * Math.PI * radius;
  const dashLength = (config.zoneSizeDeg / 360) * circumference;
  const dashGap = Math.max(circumference - dashLength, 0);
  const dashOffset = -((zoneStart - 90) / 360) * circumference;

  const progressAngles = useMemo(() => [-90, 30, 150], []);
  const progressRadius = ringSize / 2 + 34;
  const statusStage = currentStage;

  return (
    <div
      key={shakeKey}
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-black/80 font-mono ${
        flash === 'red' ? 'knock-shake' : ''
      }`}
    >
      {flash && (
        <div
          className={`pointer-events-none absolute inset-0 z-30 ${
            flash === 'white' ? 'bg-white/35' : 'bg-red-500/30'
          }`}
        />
      )}

      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(19,200,236,0.16)_0%,rgba(5,10,18,0)_65%)]" />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.6em] text-cyan-200/80">
            Orbital Breaker
          </p>
          <p className="text-[10px] uppercase tracking-[0.5em] text-white/60">
            Align the strike within the decrypt window
          </p>
        </div>

        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
          <img
            src="/jeti-anxious.png"
            alt="JETI anxious projection"
            className="pointer-events-none absolute z-10 h-48 w-48 object-contain opacity-95 drop-shadow-[0_0_35px_rgba(56,189,248,0.55)]"
          />

          <div className="pointer-events-none absolute z-20 h-72 w-72 rounded-full border-2 border-cyan-900/70 shadow-[0_0_45px_rgba(34,211,238,0.2)]" />
          <div className="pointer-events-none absolute z-20 h-[18.5rem] w-[18.5rem] rounded-full border border-cyan-300/15" />

          <svg
            className="relative z-30 drop-shadow-[0_0_22px_rgba(34,211,238,0.35)]"
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
          >
            <g transform={`translate(${size / 2}, ${size / 2})`}>
              <circle
                r={radius}
                fill="none"
                stroke="rgba(34,211,238,0.18)"
                strokeWidth={strokeWidth}
              />
              <circle
                r={radius}
                fill="none"
                stroke="rgba(56,189,248,0.92)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${dashLength} ${dashGap}`}
                strokeDashoffset={dashOffset}
                transform="rotate(-90)"
              />
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={-radius + 12}
                stroke="rgba(248,250,252,0.96)"
                strokeWidth={7}
                strokeLinecap="round"
                transform={`rotate(${angle - 90})`}
              />
              <circle r={13} fill="rgba(248,250,252,0.94)" />
            </g>
          </svg>

          {progressAngles.map((deg, index) => {
            const value = index + 1;
            const isOn = value <= statusStage;
            const isActive = value === statusStage;
            const theta = (deg * Math.PI) / 180;
            const x = size / 2 + Math.cos(theta) * progressRadius;
            const y = size / 2 + Math.sin(theta) * progressRadius;
            const dotClass = isOn
              ? statusStage === 3
                ? 'bg-white shadow-[0_0_18px_rgba(248,113,113,0.6)]'
                : 'bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.55)]'
              : 'bg-black/70';
            return (
              <div
                key={value}
                className={`pointer-events-none absolute z-40 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/60 ${dotClass} ${
                  isActive ? 'animate-pulse' : ''
                }`}
                style={{ left: x, top: y }}
              />
            );
          })}
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.55em] text-cyan-100/80">
            Decryption Sequence:{' '}
            <span className="text-white/90">
              [ <span className="animate-pulse text-cyan-300">{statusStage}</span> / 3 ]
            </span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.45em] text-white/55">
            Press Space or Tap when the cursor enters the target arc
          </p>
        </div>
      </div>
    </div>
  );
};
