import React, { useEffect, useMemo, useRef, useState } from 'react';

type HandPoint = { x: number; y: number } | null;

type BlockTaskProps = {
  handCentroid: HandPoint;
  onComplete: () => void;
  onProgress?: (count: number) => void;
  onTransferSuccess?: (nextCount: number) => void;
  onTransferError?: () => void;
  showStatus?: boolean;
  showFeedback?: boolean;
  className?: string;
};

const TOTAL_BLOCKS = 4;
const ZONE_THRESHOLD = 0.22;
const MAGNET_THRESHOLD = 0.28;
const LOST_TRACKING_GRACE_FRAMES = 12;
const TARGET_BOUNDS = { minX: 0.62, maxX: 0.92, minY: 0.22, maxY: 0.78 };
const FIREWALL_X = 0.5;
const FIREWALL_HALF_WIDTH = 0.035;
const FIREWALL_COOLDOWN_MS = 900;
const FIREWALL_MIN_Y = 0.2;
const FIREWALL_MAX_Y = 0.8;
const FIREWALL_HEIGHT = 0.34;
const FIREWALL_CYCLE_SEC = 2;
const FIREWALL_CYCLE_FAST_SEC = 1.6;
const FIREWALL_COLLISION_FLASH_MS = 280;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const clampTarget = (point: { x: number; y: number }) => ({
  x: clamp(point.x, TARGET_BOUNDS.minX, TARGET_BOUNDS.maxX),
  y: clamp(point.y, TARGET_BOUNDS.minY, TARGET_BOUNDS.maxY),
});

const isMovingBlock = (count: number) => count > 0 && count < TOTAL_BLOCKS;

export const BlockTask: React.FC<BlockTaskProps> = ({
  handCentroid,
  onComplete,
  onProgress,
  onTransferSuccess,
  onTransferError,
  showStatus = true,
  showFeedback = true,
  className,
}) => {
  const grabSound = useRef(new Audio('/sfx-grab.mp3'));
  const dropSound = useRef(new Audio('/sfx-drop.mp3'));
  const prevGrabbingRef = useRef(false);
  const prevCompletedRef = useRef(0);
  const zoneA = useMemo(() => ({ x: 0.18, y: 0.5 }), []);
  const baseTarget = useMemo(() => ({ x: 0.82, y: 0.5 }), []);
  const [completedCount, setCompletedCount] = useState(0);
  const [grabbing, setGrabbing] = useState(false);
  const [blockPos, setBlockPos] = useState(zoneA);
  const [targetPos, setTargetPos] = useState(baseTarget);
  const targetPosRef = useRef(baseTarget);
  const lastTargetPosRef = useRef(baseTarget);
  const [targetOpacity, setTargetOpacity] = useState(1);
  const [alertActive, setAlertActive] = useState(false);
  const alertTimeoutRef = useRef<number | null>(null);
  const teleportTimerRef = useRef(0);
  const completeRef = useRef(false);
  const lostTrackingFramesRef = useRef(0);
  const firewallCooldownRef = useRef(0);
  const [firewallY, setFirewallY] = useState(0.5);
  const firewallYRef = useRef(0.5);
  const [collisionActive, setCollisionActive] = useState(false);
  const collisionTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (collisionTimerRef.current) {
        window.clearTimeout(collisionTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (onProgress) {
      onProgress(completedCount);
    }
  }, [completedCount, onProgress]);

  useEffect(() => {
    grabSound.current.preload = 'auto';
    dropSound.current.preload = 'auto';
    grabSound.current.volume = 0.6;
    dropSound.current.volume = 0.6;
  }, []);

  useEffect(() => {
    const wasGrabbing = prevGrabbingRef.current;
    if (!wasGrabbing && grabbing) {
      const audio = grabSound.current;
      audio.currentTime = 0;
      audio.play().catch(() => undefined);
    }
    prevGrabbingRef.current = grabbing;
  }, [grabbing]);

  useEffect(() => {
    const prevCount = prevCompletedRef.current;
    if (completedCount > prevCount) {
      const audio = dropSound.current;
      audio.currentTime = 0;
      audio.play().catch(() => undefined);
    }
    prevCompletedRef.current = completedCount;
  }, [completedCount]);

  useEffect(() => {
    targetPosRef.current = baseTarget;
    lastTargetPosRef.current = baseTarget;
    setTargetPos(baseTarget);
    setTargetOpacity(1);
    teleportTimerRef.current = 0;
    firewallYRef.current = 0.5;
    setFirewallY(0.5);
  }, [baseTarget, completedCount]);

  useEffect(() => {
    if (completedCount < 2) {
      setAlertActive(false);
    }
  }, [completedCount]);

  useEffect(() => {
    if (!isMovingBlock(completedCount)) {
      setTargetOpacity(1);
      return;
    }

    let rafId = 0;
    let lastTime: number | null = null;
    let time = 0;

    const raiseAlert = () => {
      if (completedCount < 2) {
        return;
      }
      setAlertActive(true);
      if (alertTimeoutRef.current) {
        window.clearTimeout(alertTimeoutRef.current);
      }
      alertTimeoutRef.current = window.setTimeout(() => setAlertActive(false), 1400);
    };

    const tick = (now: number) => {
      if (lastTime === null) {
        lastTime = now;
      }
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      time += dt;

      const difficulty = completedCount;
      let next = baseTarget;

      if (difficulty === 1) {
        const amplitude = 0.12;
        const frequency = 1.1;
        next = {
          x: baseTarget.x,
          y: baseTarget.y + Math.sin(time * frequency * Math.PI * 2) * amplitude,
        };
      } else if (difficulty === 2) {
        const amplitudeX = 0.12;
        const amplitudeY = 0.16;
        const frequency = 0.9;
        next = {
          x: baseTarget.x + Math.sin(time * frequency * Math.PI * 2) * amplitudeX,
          y:
            baseTarget.y +
            Math.sin(time * frequency * Math.PI * 4) * Math.cos(time * frequency * Math.PI * 2) *
              amplitudeY,
        };
      } else if (difficulty >= 3) {
        const amplitudeX = 0.18;
        const amplitudeY = 0.2;
        const frequency = 1.9;
        const wobble = Math.sin(time * Math.PI * 6) * 0.04;
        next = {
          x: baseTarget.x + Math.sin(time * frequency * Math.PI * 2) * amplitudeX + wobble,
          y:
            baseTarget.y +
            Math.cos(time * frequency * Math.PI * 2) * amplitudeY +
            Math.sin(time * Math.PI * 8) * 0.05,
        };

        teleportTimerRef.current += dt;
        if (teleportTimerRef.current >= 2) {
          teleportTimerRef.current = 0;
          next = clampTarget({
            x: TARGET_BOUNDS.minX + Math.random() * (TARGET_BOUNDS.maxX - TARGET_BOUNDS.minX),
            y: TARGET_BOUNDS.minY + Math.random() * (TARGET_BOUNDS.maxY - TARGET_BOUNDS.minY),
          });
          raiseAlert();
        }

        setTargetOpacity(0.2 + Math.random() * 0.8);
      }

      next = clampTarget(next);

      const prev = lastTargetPosRef.current;
      const speed = dt > 0 ? distance(prev, next) / dt : 0;
      if (speed > (difficulty >= 3 ? 0.8 : 0.55)) {
        raiseAlert();
      }

      targetPosRef.current = next;
      lastTargetPosRef.current = next;
      setTargetPos(next);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (alertTimeoutRef.current) {
        window.clearTimeout(alertTimeoutRef.current);
      }
    };
  }, [baseTarget, completedCount]);

  useEffect(() => {
    const firewallActive = completedCount >= 2 && completedCount < TOTAL_BLOCKS;
    if (!firewallActive) {
      firewallYRef.current = 0.5;
      setFirewallY(0.5);
      setCollisionActive(false);
      if (collisionTimerRef.current) {
        window.clearTimeout(collisionTimerRef.current);
        collisionTimerRef.current = null;
      }
      return;
    }

    let rafId = 0;
    let lastTime: number | null = null;
    let time = 0;

    const tick = (now: number) => {
      if (lastTime === null) {
        lastTime = now;
      }
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      time += dt;

      const cycleSec = completedCount >= 3 ? FIREWALL_CYCLE_FAST_SEC : FIREWALL_CYCLE_SEC;
      const angular = (Math.PI * 2) / cycleSec;
      const mid = (FIREWALL_MIN_Y + FIREWALL_MAX_Y) / 2;
      const amplitude = (FIREWALL_MAX_Y - FIREWALL_MIN_Y) / 2;
      const next = clamp(mid + Math.sin(time * angular) * amplitude, FIREWALL_MIN_Y, FIREWALL_MAX_Y);

      firewallYRef.current = next;
      setFirewallY(next);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [completedCount]);

  useEffect(() => {
    if (!handCentroid || completedCount >= TOTAL_BLOCKS) {
      if (!handCentroid && grabbing) {
        lostTrackingFramesRef.current += 1;
        if (lostTrackingFramesRef.current < LOST_TRACKING_GRACE_FRAMES) {
          return;
        }
        lostTrackingFramesRef.current = 0;
        setGrabbing(false);
        setBlockPos(zoneA);
      }
      if (completedCount >= TOTAL_BLOCKS && !completeRef.current) {
        completeRef.current = true;
        onComplete();
      }
      return;
    }
    lostTrackingFramesRef.current = 0;

    const hand = {
      x: clamp(handCentroid.x),
      y: clamp(handCentroid.y),
    };

    const distToA = distance(hand, zoneA);
    const distToB = distance(hand, targetPosRef.current);
    const inZoneB = distToB < ZONE_THRESHOLD;
    const nearZoneA = distToA < MAGNET_THRESHOLD;
    const firewallActive = completedCount >= 2 && completedCount < TOTAL_BLOCKS;
    const firewallCenterY = firewallYRef.current;
    const firewallTop = clamp(firewallCenterY - FIREWALL_HEIGHT / 2, 0.04, 0.96 - FIREWALL_HEIGHT);
    const firewallBottom = firewallTop + FIREWALL_HEIGHT;
    const inFirewallBand =
      firewallActive &&
      Math.abs(hand.x - FIREWALL_X) < FIREWALL_HALF_WIDTH &&
      hand.y >= firewallTop &&
      hand.y <= firewallBottom;

    if (!grabbing && nearZoneA) {
      setGrabbing(true);
    }

    if (grabbing) {
      const now = performance.now();
      if (inFirewallBand && now - firewallCooldownRef.current > FIREWALL_COOLDOWN_MS) {
        firewallCooldownRef.current = now;
        setGrabbing(false);
        setBlockPos(zoneA);
        setCollisionActive(true);
        if (collisionTimerRef.current) {
          window.clearTimeout(collisionTimerRef.current);
        }
        collisionTimerRef.current = window.setTimeout(() => {
          setCollisionActive(false);
          collisionTimerRef.current = null;
        }, FIREWALL_COLLISION_FLASH_MS);
        onTransferError?.();
        return;
      }

      setBlockPos(hand);
      if (inZoneB) {
        setGrabbing(false);
        setBlockPos(zoneA);
        const nextCount = completedCount + 1;
        onTransferSuccess?.(nextCount);
        setCompletedCount((prev) => {
          const next = prev + 1;
          if (next >= TOTAL_BLOCKS && !completeRef.current) {
            completeRef.current = true;
            onComplete();
          }
          return next;
        });
      }
    }
  }, [
    completedCount,
    grabbing,
    handCentroid,
    onComplete,
    onTransferError,
    onTransferSuccess,
    zoneA,
  ]);

  const statusText =
    completedCount >= 3
      ? 'SYSTEM: CONTAINMENT FAILING. COMPLETE THE TRANSFER.'
      : completedCount >= 2
        ? 'SYSTEM: KEEP MOVING. DO NOT STOP.'
        : completedCount >= 1
          ? "SYSTEM: SYNCHRONIZING... Jeti's vitals destabilizing."
          : 'PROTOCOL: TRANSFER DATA BLOCK ACTIVE.';

  const statusClass =
    completedCount >= 3
      ? 'text-red-300 animate-pulse'
      : completedCount >= 2
        ? 'text-amber-200'
        : 'text-white/70';
  const feedbackText =
    completedCount >= TOTAL_BLOCKS
      ? "OKAY, REAL BREACH DETECTED. LET'S GO!"
      : completedCount >= 3
        ? 'SYSTEM UNLOCKED! YOU DID IT! WE ARE FREE!'
        : completedCount >= 2
          ? 'FIREWALL CRACKING... ALMOST THERE.'
          : 'INITIALIZING BREACH PROTOCOL...';
  const feedbackClass = completedCount >= 3 ? 'text-emerald-200' : 'text-white';
  const feedbackGlitch = completedCount === 3 ? 'prank-glitch' : '';
  const firewallActive = completedCount >= 2 && completedCount < TOTAL_BLOCKS;
  const firewallTop = clamp(firewallY - FIREWALL_HEIGHT / 2, 0.04, 0.96 - FIREWALL_HEIGHT);
  const firewallHeight = FIREWALL_HEIGHT;

  return (
    <div
      className={`relative w-[min(820px,90vw)] h-[min(480px,70vh)] rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl p-6 pb-16 shadow-[0_0_60px_rgba(19,200,236,0.15)] ${
        collisionActive ? 'knock-shake' : ''
      } ${className ?? ''}`}
    >
      <div className="text-center text-[10px] uppercase tracking-[0.4em] text-white/40 mb-4">
        Manual override: move the block from A -&gt; B
      </div>
      {showStatus && (
        <div className={`text-center text-xs uppercase tracking-[0.35em] ${statusClass}`}>
          {statusText}
        </div>
      )}
      {alertActive && (
        <div className="absolute inset-x-0 top-16 z-40 flex justify-center">
          <div className="rounded-md border border-red-400/40 bg-black/80 px-4 py-2 text-[10px] uppercase tracking-[0.45em] text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.2)]">
            FIREWALL ADAPTING... TARGET UNSTABLE
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0">
        {firewallActive && (
          <div
            className="absolute opacity-80"
            style={{
              left: `${FIREWALL_X * 100}%`,
              top: `${firewallTop * 100}%`,
              height: `${firewallHeight * 100}%`,
              width: `${FIREWALL_HALF_WIDTH * 200}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="relative h-full w-full rounded-full border border-red-400/60 bg-red-500/10 shadow-[0_0_24px_rgba(248,113,113,0.22)]">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.4em] text-red-200/80">
                Firewall
              </div>
            </div>
          </div>
        )}

        <div
          className="absolute h-40 w-40 rounded-2xl border border-cyber-cyan/40 bg-black/25 backdrop-blur-md shadow-[0_0_25px_rgba(19,200,236,0.2)]"
          style={{
            left: `${zoneA.x * 100}%`,
            top: `${zoneA.y * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="absolute left-1/2 top-2 -translate-x-1/2 text-[9px] uppercase tracking-[0.3em] text-cyber-cyan/70">
            Source
          </div>
        </div>

        <div
          className={`absolute h-40 w-40 rounded-2xl bg-black/20 backdrop-blur-md transition-colors duration-300 ${
            completedCount > 0
              ? 'border border-red-400/60 shadow-[0_0_28px_rgba(248,113,113,0.25)]'
              : 'border border-white/20 shadow-[0_0_25px_rgba(255,255,255,0.08)]'
          }`}
          style={{
            left: `${targetPos.x * 100}%`,
            top: `${targetPos.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            opacity: completedCount >= 3 ? targetOpacity : 1,
          }}
        >
          <div
            className={`absolute left-1/2 top-2 -translate-x-1/2 text-[9px] uppercase tracking-[0.3em] ${
              completedCount > 0 ? 'text-red-200/80' : 'text-white/50'
            }`}
          >
            Target
          </div>
        </div>
      </div>

      <div
        className={`absolute h-12 w-12 rounded-xl border transition-colors duration-150 ${
          collisionActive
            ? 'border-red-400 bg-red-500/20 shadow-[0_0_26px_rgba(248,113,113,0.55)]'
            : 'border-cyber-cyan/60 bg-cyber-cyan/10 shadow-[0_0_25px_rgba(19,200,236,0.4)]'
        }`}
        style={{
          left: `${blockPos.x * 100}%`,
          top: `${blockPos.y * 100}%`,
          transform: 'translate(-50%, -50%)',
        }}
      />

      {handCentroid && (
        <>
          <div
            className="pointer-events-none absolute h-4 w-4 rounded-full bg-cyber-cyan/80 opacity-80 shadow-[0_0_18px_rgba(19,200,236,0.55)]"
            style={{
              left: `${clamp(handCentroid.x) * 100}%`,
              top: `${clamp(handCentroid.y) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
          <div
            className="pointer-events-none absolute h-10 w-10 rounded-full border border-amber-200/60 shadow-[0_0_18px_rgba(251,232,197,0.3)]"
            style={{
              left: `${clamp(handCentroid.x) * 100}%`,
              top: `${clamp(handCentroid.y) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        </>
      )}

      {showFeedback && (
        <div
          className={`absolute bottom-4 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 rounded-md bg-black px-6 py-3 text-center font-mono text-sm md:text-base uppercase tracking-[0.35em] ${feedbackClass} ${feedbackGlitch}`}
        >
          {feedbackText}
        </div>
      )}
    </div>
  );
};
