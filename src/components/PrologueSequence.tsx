import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

type PrologueSequenceProps = {
  onInitialize: () => void;
};

const PROLOGUE_LINES = [
  'SYSTEM RECORD 734...',
  'SUBJECT: JETI. STATUS: TRAPPED.',
  'CONSCIOUSNESS DETECTED.',
  'OPERATOR INTERVENTION REQUIRED.',
  '...WAKE UP.',
];

const TYPE_SPEED_MS = 32;
const LINE_PAUSE_MS = 320;
const TYPING_VOLUME = 0.1;
const STATIC_VOLUME = 0.05;
const CRT_OFF_DURATION_MS = 300;

export const PrologueSequence: React.FC<PrologueSequenceProps> = ({ onInitialize }) => {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [activeLine, setActiveLine] = useState('');
  const [ready, setReady] = useState(false);
  const [transitionActive, setTransitionActive] = useState(false);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const audioStartedRef = useRef(false);
  const fadeRafRef = useRef<number | null>(null);
  const fadeTokenRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const staticSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const staticGainRef = useRef<GainNode | null>(null);
  const typingCounterRef = useRef(0);
  const transitionTimerRef = useRef<number | null>(null);

  const ensureAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    return ctx;
  };

  const startStatic = () => {
    const ctx = ensureAudioContext();
    if (!ctx || staticSourceRef.current) {
      return;
    }

    const durationSeconds = 2;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * durationSeconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.7;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(STATIC_VOLUME, ctx.currentTime);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    staticSourceRef.current = source;
    staticGainRef.current = gain;
  };

  const stopStatic = () => {
    const ctx = audioCtxRef.current;
    const source = staticSourceRef.current;
    const gain = staticGainRef.current;
    if (!ctx || !source || !gain) {
      return;
    }

    const startTime = ctx.currentTime;
    gain.gain.cancelScheduledValues(startTime);
    gain.gain.setValueAtTime(gain.gain.value, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.28);
    source.stop(startTime + 0.32);

    staticSourceRef.current = null;
    staticGainRef.current = null;
  };

  const playTypingBlip = () => {
    const ctx = ensureAudioContext();
    if (!ctx) {
      return;
    }
    typingCounterRef.current += 1;
    if (typingCounterRef.current % 3 !== 0) {
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const freq = 800 + Math.random() * 400;

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(TYPING_VOLUME, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  };

  useEffect(() => {
    const voice = new Audio('/sfx-intro-voice.wav');
    voice.volume = 1;
    voice.preload = 'auto';
    voiceRef.current = voice;
    const tryStartAudio = () => {
      if (audioStartedRef.current) {
        return;
      }
      ensureAudioContext();
      const playAttempt = voice.play();
      if (playAttempt && typeof playAttempt.then === 'function') {
        playAttempt
          .then(() => {
            audioStartedRef.current = true;
            startStatic();
          })
          .catch(() => {
            console.log('Autoplay blocked, waiting for interaction');
          });
      } else {
        audioStartedRef.current = true;
        startStatic();
      }
    };

    tryStartAudio();
    const handleUserUnlock = () => {
      tryStartAudio();
    };
    window.addEventListener('pointerdown', handleUserUnlock, { once: true });
    window.addEventListener('keydown', handleUserUnlock, { once: true });
    const handleStop = () => {
      voice.pause();
      voice.currentTime = 0;
    };
    window.addEventListener('intro-voice-stop', handleStop);

    return () => {
      window.removeEventListener('pointerdown', handleUserUnlock);
      window.removeEventListener('keydown', handleUserUnlock);
      window.removeEventListener('intro-voice-stop', handleStop);
      fadeTokenRef.current += 1;
      if (fadeRafRef.current !== null) {
        cancelAnimationFrame(fadeRafRef.current);
      }
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      stopStatic();
      voice.pause();
      voice.currentTime = 0;
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let lineIndex = 0;
    let charIndex = 0;
    let timerId: number | null = null;

    const typeNext = () => {
      if (cancelled) {
        return;
      }

      const line = PROLOGUE_LINES[lineIndex];
      charIndex += 1;
      setActiveLine(line.slice(0, charIndex));
      playTypingBlip();

      if (charIndex < line.length) {
        timerId = window.setTimeout(typeNext, TYPE_SPEED_MS);
        return;
      }

      setVisibleLines((prev) => [...prev, line]);
      setActiveLine('');
      lineIndex += 1;
      charIndex = 0;

      if (lineIndex >= PROLOGUE_LINES.length) {
        timerId = window.setTimeout(() => setReady(true), 420);
        return;
      }

      timerId = window.setTimeout(typeNext, LINE_PAUSE_MS);
    };

    timerId = window.setTimeout(typeNext, 260);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  const fadeOutVoice = () => {
    const voice = voiceRef.current;
    if (!voice) {
      return;
    }
    const token = ++fadeTokenRef.current;
    const startVolume = voice.volume;
    const startTime = performance.now();
    const duration = 480;

    const step = (now: number) => {
      if (token !== fadeTokenRef.current) {
        return;
      }
      const progress = Math.min(1, (now - startTime) / duration);
      voice.volume = startVolume * (1 - progress);
      if (progress < 1) {
        fadeRafRef.current = requestAnimationFrame(step);
      } else {
        voice.pause();
        voice.currentTime = 0;
        voice.volume = startVolume;
        fadeRafRef.current = null;
      }
    };

    if (fadeRafRef.current !== null) {
      cancelAnimationFrame(fadeRafRef.current);
    }
    fadeRafRef.current = requestAnimationFrame(step);
  };

  const handleInitialize = () => {
    if (transitionActive) {
      return;
    }
    fadeOutVoice();
    const voice = voiceRef.current;
    if (voice) {
      voice.pause();
      voice.currentTime = 0;
    }
    stopStatic();
    setTransitionActive(true);
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      onInitialize();
    }, CRT_OFF_DURATION_MS);
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black px-6 font-mono">
      <div className="pointer-events-none absolute inset-0 opacity-20 crt-scanlines" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={
          transitionActive
            ? {
                opacity: [1, 1, 1, 0],
                scaleY: [1, 0.04, 0.04, 0],
                scaleX: [1, 1, 0.04, 0],
                filter: [
                  'brightness(1) contrast(1)',
                  'brightness(1.6) contrast(1.2)',
                  'brightness(2.2) contrast(1.4)',
                  'brightness(2.2) contrast(1.4)',
                ],
              }
            : { opacity: 1, y: 0, scaleX: 1, scaleY: 1, filter: 'none' }
        }
        transition={{
          duration: transitionActive ? CRT_OFF_DURATION_MS / 1000 : 0.4,
          times: transitionActive ? [0, 0.55, 0.85, 1] : undefined,
          ease: transitionActive ? 'easeInOut' : 'easeOut',
        }}
        className="relative w-full max-w-3xl rounded-lg border border-emerald-400/20 bg-black/70 p-8 shadow-[0_0_40px_rgba(16,185,129,0.12)]"
      >
        <div className="text-[10px] uppercase tracking-[0.55em] text-emerald-200/60 mb-6">
          Black Box Transcript
        </div>
        <div className="min-h-[180px] space-y-3 text-sm md:text-base text-emerald-200/80">
          {visibleLines.map((line) => (
            <p key={line}>&gt; {line}</p>
          ))}
          {activeLine && (
            <p className="text-emerald-100">
              &gt; {activeLine}
              <span className="type-cursor">|</span>
            </p>
          )}
        </div>

        {ready && (
          <div className="mt-10 flex justify-center">
            <motion.button
              className="rounded-full border border-emerald-300/50 bg-emerald-400/10 px-8 py-3 text-xs font-bold uppercase tracking-[0.45em] text-emerald-200 shadow-[0_0_26px_rgba(16,185,129,0.25)]"
              animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.03, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              onClick={handleInitialize}
            >
              [ INITIALIZE UPLINK ]
            </motion.button>
          </div>
        )}

        {transitionActive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <motion.div
              className="h-[2px] w-[68%] bg-white shadow-[0_0_18px_rgba(255,255,255,0.8)]"
              initial={{ opacity: 0, scaleX: 0.2 }}
              animate={{ opacity: [0, 1, 1, 0], scaleX: [0.2, 1, 0.1, 0] }}
              transition={{ duration: CRT_OFF_DURATION_MS / 1000, times: [0, 0.4, 0.85, 1] }}
            />
            <motion.div
              className="absolute h-2 w-2 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.9)]"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.3, 0.2, 0] }}
              transition={{ duration: CRT_OFF_DURATION_MS / 1000, times: [0, 0.6, 0.9, 1] }}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
};
