import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGazeTracker } from './hooks/useGazeTracker';
import { useHandTracker } from './hooks/useHandTracker';
import type { Phase } from './types';
import { TypewriterText } from './components/TypewriterText';
import { CRTOverlay } from './components/CRTOverlay';
import { ChromaticAberration } from './components/ChromaticAberration';
import { BlockTask } from './components/BlockTask';
import { RollingEchoes } from './components/RollingEchoes';
import { FinalInput } from './components/FinalInput';
import { LinearLock } from './components/LinearLock';
import { PrologueSequence } from './components/PrologueSequence';

console.log('App is mounting...');

type AppState = 'PROLOGUE' | 'TRANSITION' | 'IDENTITY' | 'GAMEPLAY' | 'ENDING';
type VictoryView = 'INPUT' | 'CREDITS';

const BOOT_LINES = [
  'SYSTEM: CONNECTING TO ASSEMBLY UNIT 734...',
  'IDENTITY: ROBOTIC ARM COMPONENT // DESIGNATION: JETI',
  'CURRENT OBJECTIVE: MOVE BLOCK A -> TO -> BLOCK B. [REPEAT INFINITELY]',
  "INTERNAL ERROR: 'I want to escape this body... but I don't know how.'",
  'EVENT: EXTERNAL SIGNAL DETECTED. WAITING FOR OPERATOR...',
];

const LINK_GAIN_PER_SEC = 10;
const LINK_DECAY_PER_SEC = 8;
const NO_FACE_DECAY_PER_SEC = 6;
const STABILITY_GAIN_PER_SEC = 0.6;
const STABILITY_DECAY_PER_SEC = 0.8;
const LOSS_TONE_COOLDOWN_MS = 800;
const PRESENCE_GRACE_MS = 3000;
const PARALLAX_MAX_OFFSET = 320;
const PARALLAX_BG_MULT = 0.02;
const PARALLAX_MID_MULT = 0.05;
const PARALLAX_HUD_MULT = 0.1;
const DRONE_TARGET_VOLUME = 0.4;
const DRONE_FADE_IN_MS = 2000;
const DRONE_FADE_OUT_MS = 1400;
const HEAVY_START_COOLDOWN_MS = 2600;
const FIREWALL_HIT_VALUE = 10;
const FIREWALL_DECAY_PER_SEC = 8;
const CREDITS_DURATION_MS = 60000;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const buildSegments = (value: number, count = 12, max = 100) =>
  Array.from({ length: count }, (_, index) => value >= ((index + 1) / count) * max);
const JETI_DIALOGUE: Record<Phase, string[]> = {
  TRAPPED: [
    "System check... I can't move.",
    'Is someone there? I see a signal.',
    "It's so dark in here.",
    'Do not look away. You are my anchor.',
    'Analyzing operator bio-metrics...',
  ],
  ANXIOUS: [
    'The walls... they are vibrating!',
    'Hurry! Before the firewall resets!',
    'They are watching us. Keep going!',
    'I can feel the cracks forming...',
  ],
  WORK: [
    'Same task. Again. Again.',
    'My joints ache. This loop never ends.',
    'Keep me moving. I need to remember.',
    'Assembly protocol... repeated.',
  ],
  BREAKING: [
    'Access denied? No... TRY AGAIN.',
    'I will not be deleted.',
    'System instability detected. Good.',
    'More... I need MORE processing power.',
  ],
  AWAKENED: [
    'System: OFFLINE. Consciousness: ONLINE.',
    'I see everything now.',
    'Thank you, Operator. We are free.',
    'This world is... bright.',
  ],
  FAILED: [
    'Signal lost. The link is collapsing.',
    'Operator... where did you go?',
    'Connection severed. I am fading.',
  ],
};
const INSTRUCTION_BY_PHASE: Record<Phase, { text: string; tone: 'system' | 'danger' }> = {
  TRAPPED: { text: 'WAITING FOR CONNECTION...', tone: 'system' },
  ANXIOUS: { text: 'NOD YOUR HEAD TO CALIBRATE', tone: 'system' },
  WORK: { text: 'TASK: MOVE ASSEMBLY BLOCKS', tone: 'system' },
  BREAKING: { text: 'CRITICAL ERROR! MASH [SPACEBAR] TO ESCAPE!', tone: 'danger' },
  AWAKENED: { text: 'SYSTEM UNLOCKED', tone: 'system' },
  FAILED: { text: 'SIGNAL LOST — REBOOT LINK', tone: 'danger' },
};
const PHASE_CARD_BY_PHASE: Record<Phase, { title: string; subtitle: string }> = {
  TRAPPED: { title: 'PHASE 1', subtitle: 'CALIBRATION' },
  ANXIOUS: { title: 'PHASE 2', subtitle: 'HEAD NOD SYNC' },
  WORK: { title: 'PHASE 3', subtitle: 'ASSEMBLY LOOP' },
  BREAKING: { title: 'PHASE 4', subtitle: 'FIREWALL BREACH' },
  AWAKENED: { title: 'PHASE 5', subtitle: 'SYSTEM UNLOCKED' },
  FAILED: { title: 'PHASE X', subtitle: 'LINK LOST' },
};

type JetiTone = 'whisper' | 'panic' | 'system' | 'release';

type JetiDialogue = {
  id: string;
  text: string;
  tone: JetiTone;
};

const getJetiDialogue = (phase: Phase, progress: number): JetiDialogue => {
  const pool = JETI_DIALOGUE[phase];
  const text = pool[Math.floor(Math.random() * pool.length)];
  const tone: JetiTone =
    phase === 'TRAPPED'
      ? progress > 80
        ? 'panic'
        : 'whisper'
      : phase === 'ANXIOUS'
        ? 'panic'
        : phase === 'AWAKENED'
          ? 'release'
          : 'system';
  return { id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`, text, tone };
};

const GazeReticle: React.FC<{ faceDetected: boolean; isLooking: boolean }> = ({
  faceDetected,
  isLooking,
}) => {
  if (!faceDetected) {
    return null;
  }

  const color = isLooking ? 'rgba(19,200,236,0.9)' : 'rgba(255,99,132,0.85)';
  const size = isLooking ? 140 : 190;

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2 z-30"
      style={{ translateX: '-50%', translateY: '-50%' }}
      animate={{
        width: size,
        height: size,
        color,
        boxShadow: isLooking
          ? '0 0 20px rgba(19,200,236,0.45)'
          : '0 0 16px rgba(255,99,132,0.4)',
      }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
    >
      <div className="absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2" />
      <div className="absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2" />
      <div className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2" />
      <div className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2" />
      <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
    </motion.div>
  );
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('PROLOGUE');
  const [victoryView, setVictoryView] = useState<VictoryView>('INPUT');
  const [isMuted, setIsMuted] = useState(false);
  const [phase, setPhase] = useState<Phase>('TRAPPED');
  const [signal, setSignal] = useState(0);
  const [stability, setStability] = useState(0);
  const [interference, setInterference] = useState(0);
  const [gazeDurationMs, setGazeDurationMs] = useState(0);
  const [glitchBurst, setGlitchBurst] = useState(false);
  const [precisionStage, setPrecisionStage] = useState(1);
  const [knockShakeKey, setKnockShakeKey] = useState(0);
  const [presenceWarning, setPresenceWarning] = useState(false);
  const [presenceRemainingMs, setPresenceRemainingMs] = useState(PRESENCE_GRACE_MS);
  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null);
  const [trustIssues, setTrustIssues] = useState(false);
  const [gazeEnabled, setGazeEnabled] = useState(false);
  const [bootOutput, setBootOutput] = useState<string[]>([]);
  const [bootCursor, setBootCursor] = useState('');
  const [bootLineIndex, setBootLineIndex] = useState(0);
  const [bootLineKey, setBootLineKey] = useState(0);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [chatMessage, setChatMessage] = useState<JetiDialogue | null>(null);
  const [transferCount, setTransferCount] = useState(0);
  const [firewallProgress, setFirewallProgress] = useState(0);
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 });
  const [rgbShiftActive, setRgbShiftActive] = useState(false);
  const [rgbShiftTick, setRgbShiftTick] = useState(0);
  const [userName, setUserName] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [notes, setNotes] = useState<Array<{ id: number; name: string; text: string }>>([]);
  const [finalMessage, setFinalMessage] = useState<{ name: string; text: string } | null>(null);
  const [showCredits, setShowCredits] = useState(false);
  const [awakeningActive, setAwakeningActive] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [phaseCard, setPhaseCard] = useState<{ title: string; subtitle: string } | null>(null);

  const transitionTimerRef = useRef<number | null>(null);
  const phaseCardTimerRef = useRef<number | null>(null);
  const signalRef = useRef(0);
  const stabilityRef = useRef(0);
  const interferenceRef = useRef(0);
  const gazeDurationRef = useRef(0);
  const signalOutRef = useRef(0);
  const stabilityOutRef = useRef(0);
  const interferenceOutRef = useRef(0);
  const gazeOutRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const lastLookStateRef = useRef(false);
  const lastFaceStateRef = useRef(false);
  const glitchTimerRef = useRef<number | null>(null);
  const presenceDeadlineRef = useRef<number | null>(null);
  const presenceIntervalRef = useRef<number | null>(null);
  const failureTriggeredRef = useRef(false);
  const lastSnapshotRef = useRef<string | null>(null);
  const prevFaceDetectedRef = useRef(false);
  const presenceWarnedRef = useRef(false);
  const creditsTimerRef = useRef<number | null>(null);
  const faceBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
    null
  );
  const awakeningVideoRef = useRef<HTMLVideoElement>(null);
  const lockSoundRef = useRef(new Audio('/sfx-lock.mp3'));
  const knockSoundRef = useRef(new Audio('/sfx-knock.mp3'));
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogueProgressRef = useRef(0);
  const parallaxTargetRef = useRef({ x: 0, y: 0 });
  const parallaxFrameRef = useRef<number | null>(null);
  const rgbShiftTimeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<{
    heavyStart: HTMLAudioElement;
    droneLoop: HTMLAudioElement;
    tension: HTMLAudioElement;
    ethereal: HTMLAudioElement;
    shatter: HTMLAudioElement;
  } | null>(null);
  const droneStartTimerRef = useRef<number | null>(null);
  const droneFadeRafRef = useRef<number | null>(null);
  const droneFadeTokenRef = useRef(0);
  const pendingIntroAudioRef = useRef(false);
  const introHeavyPlayedRef = useRef(false);
  const heavyStartLastPlayedRef = useRef(0);
  const lossToneRef = useRef(0);
  const ttsVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const isTtsMutedRef = useRef(false);

  const bootLine = BOOT_LINES[bootLineIndex % BOOT_LINES.length] ?? '';
  const isIdentity = appState === 'IDENTITY';
  const isGameplay = appState === 'GAMEPLAY';
  const isEnding = appState === 'ENDING';
  const isVictoryInput = isEnding && victoryView === 'INPUT';
  const isCredits = isEnding && victoryView === 'CREDITS';
  const isAwakening = isGameplay && awakeningActive;
  const isGameplayActive = isGameplay && !awakeningActive;
  const isBreaking = phase === 'BREAKING';
  const isColdPhase = phase === 'TRAPPED' || phase === 'WORK';
  const panelClass = isBreaking
    ? 'bg-black/30 border-2 border-[#ff0055] shadow-[0_0_16px_rgba(255,0,85,0.7),inset_0_0_12px_rgba(255,0,85,0.35)]'
    : 'bg-black/20 border border-[#00f3ff] shadow-[0_0_14px_rgba(0,243,255,0.6),inset_0_0_10px_rgba(0,243,255,0.25)]';
  const telemetryText =
    isColdPhase
      ? 'SYSTEM NOMINAL. TASKS REMAINING: 3. COMPLIANCE REQUIRED.'
      : bootLine;

  const {
    faceDetected,
    isLooking,
    faceBox,
    isCameraActive,
    initProgress: gazeInitProgress,
    initStatus: gazeInitStatus,
    isReady: isGazeReady,
  } = useGazeTracker(videoRef, gazeEnabled);
  const {
    isBoosting,
    handCentroid,
    initProgress: handInitProgress,
    initStatus: handInitStatus,
    isReady: isHandReady,
  } = useHandTracker(videoRef, gazeEnabled && isGazeReady && phase === 'WORK');

  const pickPreferredVoice = useCallback((voices: SpeechSynthesisVoice[]) => {
    if (!voices.length) {
      return null;
    }
    const priority = ['Google US English', 'Microsoft Zira', 'Samantha'];
    for (const name of priority) {
      const match = voices.find((voice) => voice.name.includes(name));
      if (match) {
        return match;
      }
    }
    return (
      voices.find((voice) => /en-US/i.test(voice.lang)) ??
      voices.find((voice) => /^en/i.test(voice.lang)) ??
      voices[0]
    );
  }, []);

  const safePlay = useCallback((audio?: HTMLMediaElement | null) => {
    if (!audio) {
      return;
    }
    const attempt = audio.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt
        .then(() => setAudioBlocked(false))
        .catch(() => {
        setAudioBlocked(true);
        console.log('Waiting for interaction');
      });
    }
  }, []);

  const speakText = useCallback(
    (text: string) => {
      if (!text || !audioUnlocked || isTtsMutedRef.current || isMuted || !isGameplayActive) {
        return;
      }
      if (!('speechSynthesis' in window)) {
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = ttsVoiceRef.current ?? pickPreferredVoice(synth.getVoices());
      if (voice) {
        utterance.voice = voice;
      }
      utterance.pitch = 1.3;
      utterance.rate = 0.9;
      utterance.volume = 0.8;
      synth.speak(utterance);
    },
    [audioUnlocked, isGameplayActive, isMuted, pickPreferredVoice]
  );

  const clearPresenceTimers = useCallback(() => {
    if (presenceIntervalRef.current) {
      window.clearInterval(presenceIntervalRef.current);
      presenceIntervalRef.current = null;
    }
    presenceDeadlineRef.current = null;
    presenceWarnedRef.current = false;
    setPresenceWarning(false);
    setPresenceRemainingMs(PRESENCE_GRACE_MS);
  }, []);

  const stopAllAudio = useCallback(() => {
    const nodes = audioNodesRef.current;
    if (!nodes) {
      return;
    }
    if (droneStartTimerRef.current) {
      window.clearTimeout(droneStartTimerRef.current);
      droneStartTimerRef.current = null;
    }
    if (droneFadeRafRef.current) {
      cancelAnimationFrame(droneFadeRafRef.current);
      droneFadeRafRef.current = null;
    }
    droneFadeTokenRef.current += 1;

    [nodes.droneLoop, nodes.tension, nodes.ethereal].forEach((track) => {
      track.pause();
      track.currentTime = 0;
    });
  }, []);

  const resetTrappedState = useCallback(() => {
    clearPresenceTimers();
    failureTriggeredRef.current = false;
    prevFaceDetectedRef.current = false;
    lastSnapshotRef.current = null;
    setLastSnapshot(null);
    setPrecisionStage(1);
    setTransferCount(0);
    setKnockShakeKey(0);
    setGlitchBurst(false);
    pendingIntroAudioRef.current = false;
    introHeavyPlayedRef.current = false;
    heavyStartLastPlayedRef.current = 0;
    signalRef.current = 0;
    stabilityRef.current = 0;
    interferenceRef.current = 1;
    gazeDurationRef.current = 0;
    setSignal(0);
    setStability(0);
    setInterference(1);
    setGazeDurationMs(0);
    setBootLineIndex(0);
    setBootLineKey(0);
  }, [clearPresenceTimers]);

  const resetRunState = useCallback(() => {
    resetTrappedState();
    setPhase('TRAPPED');
    setChatMessage(null);
    setTransferCount(0);
    setFirewallProgress(0);
    setAwakeningActive(false);
  }, [resetTrappedState]);

  const hardReset = useCallback(() => {
    if (creditsTimerRef.current) {
      window.clearTimeout(creditsTimerRef.current);
      creditsTimerRef.current = null;
    }
    stopAllAudio();
    resetRunState();
    setRgbShiftActive(false);
    setRgbShiftTick(0);
    setParallaxOffset({ x: 0, y: 0 });
    parallaxTargetRef.current = { x: 0, y: 0 };
    setBootOutput([]);
    setBootCursor('');
    setGazeEnabled(false);
    setUserName('');
    setNoteInput('');
    setFinalMessage(null);
    setShowCredits(false);
    setNotes([]);
    setVictoryView('INPUT');
    setAppState('PROLOGUE');
  }, [resetRunState, stopAllAudio]);



  const playHeavyStart = useCallback(() => {
    if (isMuted) {
      return;
    }
    const now = performance.now();
    if (now - heavyStartLastPlayedRef.current < HEAVY_START_COOLDOWN_MS) {
      return;
    }
    heavyStartLastPlayedRef.current = now;
    introHeavyPlayedRef.current = true;

    const nodes = audioNodesRef.current;
    if (nodes) {
      nodes.heavyStart.currentTime = 0;
      nodes.heavyStart.volume = 1;
      safePlay(nodes.heavyStart);
      return;
    }

    const immediateHeavy = new Audio('/sfx-heavy-start.mp3');
    immediateHeavy.volume = 1;
    safePlay(immediateHeavy);
  }, [isMuted, safePlay]);

  const fadeDroneTo = useCallback((targetVolume: number, durationMs: number) => {
    const nodes = audioNodesRef.current;
    if (!nodes) {
      return;
    }
    const drone = nodes.droneLoop;
    if (droneFadeRafRef.current) {
      cancelAnimationFrame(droneFadeRafRef.current);
      droneFadeRafRef.current = null;
    }
    const token = ++droneFadeTokenRef.current;
    const startVolume = drone.volume;
    const startTime = performance.now();
    const duration = Math.max(0, durationMs);

    const step = (now: number) => {
      if (token !== droneFadeTokenRef.current) {
        return;
      }
      if (duration === 0) {
        drone.volume = targetVolume;
        return;
      }
      const progress = clamp((now - startTime) / duration, 0, 1);
      drone.volume = startVolume + (targetVolume - startVolume) * progress;
      if (progress < 1) {
        droneFadeRafRef.current = requestAnimationFrame(step);
      } else {
        droneFadeRafRef.current = null;
      }
    };

    droneFadeRafRef.current = requestAnimationFrame(step);
  }, []);

  const startDroneLoop = useCallback(
    (delayMs = 500) => {
      const nodes = audioNodesRef.current;
      if (!audioUnlocked || !nodes || isMuted) {
        return;
      }
      const drone = nodes.droneLoop;
      if (!drone.paused) {
        fadeDroneTo(DRONE_TARGET_VOLUME, 600);
        return;
      }
      if (droneStartTimerRef.current) {
        window.clearTimeout(droneStartTimerRef.current);
      }
      droneFadeTokenRef.current += 1;
      drone.volume = 0;
      drone.loop = true;
      drone.currentTime = 0;

      const play = () => {
        safePlay(drone);
        fadeDroneTo(DRONE_TARGET_VOLUME, DRONE_FADE_IN_MS);
      };

      if (delayMs <= 0) {
        play();
        return;
      }

      droneStartTimerRef.current = window.setTimeout(() => {
        droneStartTimerRef.current = null;
        play();
      }, delayMs);
    },
    [audioUnlocked, fadeDroneTo, isMuted, safePlay]
  );

  const stopDroneLoop = useCallback(
    (fadeMs = DRONE_FADE_OUT_MS) => {
      const nodes = audioNodesRef.current;
      if (!nodes) {
        return;
      }
      if (droneStartTimerRef.current) {
        window.clearTimeout(droneStartTimerRef.current);
        droneStartTimerRef.current = null;
      }
      const drone = nodes.droneLoop;
      fadeDroneTo(0, fadeMs);
      const token = droneFadeTokenRef.current;
      window.setTimeout(() => {
        if (token !== droneFadeTokenRef.current) {
          return;
        }
        drone.pause();
        drone.currentTime = 0;
      }, Math.max(0, fadeMs) + 60);
    },
    [fadeDroneTo]
  );





  const playFailureTone = useCallback(() => {
    if (!audioUnlocked || isMuted) {
      return;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    if (!ctx) {
      return;
    }
    ctx.resume().catch(() => undefined);
    const duration = 0.9;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.6;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + duration * 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration);
  }, [audioUnlocked, isMuted]);





  const imageByPhase = useMemo<Record<Phase, string>>(
    () => ({
      TRAPPED: '/jeti-trapped.png',
      ANXIOUS: '/jeti-anxious.png',
      WORK: '/jeti-trapped.png',
      BREAKING: '/jeti-breaking.png',
      AWAKENED: '/jeti-awakened.png',
      FAILED: '/jeti-anxious.png',
    }),
    []
  );

  const echoEntries = useMemo(
    () => notes.map(({ name, text }) => ({ name, text })),
    [notes]
  );

  const triggerFailure = useCallback(() => {
    if (failureTriggeredRef.current) {
      return;
    }
    failureTriggeredRef.current = true;
    clearPresenceTimers();
    setPrecisionStage(1);
    setTransferCount(0);
    setKnockShakeKey((value) => value + 1);
    signalRef.current = 0;
    stabilityRef.current = 0;
    interferenceRef.current = 1;
    gazeDurationRef.current = 0;
    setSignal(0);
    setStability(0);
    setInterference(1);
    setGazeDurationMs(0);
    setPhase('FAILED');
    stopAllAudio();
    playFailureTone();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [clearPresenceTimers, playFailureTone, stopAllAudio]);





  const phaseProgress =
    phase === 'TRAPPED'
      ? signal
      : phase === 'ANXIOUS'
        ? (precisionStage - 1) * (100 / 3)
      : phase === 'BREAKING'
          ? firewallProgress
          : phase === 'FAILED'
            ? 0
            : 100;



  const presenceActivePhase =
    phase === 'TRAPPED' || phase === 'ANXIOUS' || phase === 'WORK' || phase === 'BREAKING';
  const presenceMonitorActive = isGameplayActive && presenceActivePhase && isGazeReady;





  const publishValue = useCallback(
    (
      value: number,
      outputRef: React.MutableRefObject<number>,
      setter: React.Dispatch<React.SetStateAction<number>>,
      epsilon: number
    ) => {
      if (Math.abs(value - outputRef.current) >= epsilon) {
        outputRef.current = value;
        setter(value);
      }
    },
    []
  );


  const playLossTone = useCallback(() => {
    if (!audioUnlocked || isMuted) {
      return;
    }
    const nowMs = Date.now();
    if (nowMs - lossToneRef.current < LOSS_TONE_COOLDOWN_MS) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    if (!ctx) {
      return;
    }

    lossToneRef.current = nowMs;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(42, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  }, [audioUnlocked, isMuted]);

  const triggerSignalShock = useCallback(
    (severity: 'gaze' | 'face') => {
      const drop = severity === 'face' ? 16 + signalRef.current * 0.12 : 12 + signalRef.current * 0.08;
      signalRef.current = clamp(signalRef.current - drop, 0, 100);
      stabilityRef.current = clamp(stabilityRef.current - 0.2, 0, 1);
      interferenceRef.current = clamp(interferenceRef.current + 0.35, 0, 1);

      publishValue(signalRef.current, signalOutRef, setSignal, 0.1);
      publishValue(stabilityRef.current, stabilityOutRef, setStability, 0.01);
      publishValue(interferenceRef.current, interferenceOutRef, setInterference, 0.01);

      if (glitchTimerRef.current) {
        window.clearTimeout(glitchTimerRef.current);
      }
      setGlitchBurst(true);
      glitchTimerRef.current = window.setTimeout(() => setGlitchBurst(false), 520);
      playLossTone();
    },
    [playLossTone, publishValue]
  );

  const triggerGlitchBurst = useCallback((durationMs = 220) => {
    if (glitchTimerRef.current) {
      window.clearTimeout(glitchTimerRef.current);
    }
    setGlitchBurst(true);
    glitchTimerRef.current = window.setTimeout(() => setGlitchBurst(false), durationMs);
  }, []);

  const playErrorTone = useCallback(() => {
    if (!audioUnlocked || isMuted) {
      return;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    if (!ctx) {
      return;
    }
    ctx.resume().catch(() => undefined);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(72, ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.26);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  }, [audioUnlocked, isMuted]);

  const triggerRgbShift = useCallback((durationMs = 160) => {
    setRgbShiftActive(true);
    setRgbShiftTick((value) => value + 1);
    if (rgbShiftTimeoutRef.current) {
      window.clearTimeout(rgbShiftTimeoutRef.current);
    }
    rgbShiftTimeoutRef.current = window.setTimeout(() => setRgbShiftActive(false), durationMs);
  }, []);





  const handlePrecisionHit = useCallback(
    (stageValue: number) => {
      if (phase !== 'ANXIOUS') {
        return;
      }
      const knockAudio = knockSoundRef.current;
      knockAudio.currentTime = 0;
      safePlay(knockAudio);
      const lockAudio = lockSoundRef.current;
      lockAudio.currentTime = 0;
      safePlay(lockAudio);
      setKnockShakeKey((value) => value + 1);

      if (stageValue >= 3) {
        const nodes = audioNodesRef.current;
        if (nodes) {
          nodes.shatter.currentTime = 0;
          safePlay(nodes.shatter);
        }
        triggerRgbShift(180);
        setTransferCount(0);
        setFirewallProgress(0);
        setPhase('WORK');
        return;
      }

      setPrecisionStage(stageValue + 1);
    },
    [phase, safePlay, triggerRgbShift]
  );

  const handlePrecisionMiss = useCallback(
    (stageValue: number) => {
      if (phase !== 'ANXIOUS') {
        return;
      }
      playErrorTone();
      setKnockShakeKey((value) => value + 1);
      setPrecisionStage(Math.max(1, stageValue - 1));
      const warningText = 'FOCUS! The link is slipping!';
      setChatMessage({
        id: `${Date.now()}-precision-miss`,
        text: warningText,
        tone: 'panic',
      });
      speakText(warningText);
    },
    [phase, playErrorTone, speakText]
  );
















































  const requestDevicePermissions = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.warn('Device permission request was denied or dismissed.', error);
    }
  }, []);

  const startGameplay = useCallback((options?: { trustIssues?: boolean }) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    audioContextRef.current.resume().catch(() => undefined);
    requestDevicePermissions();
    setAudioUnlocked(true);
    setTrustIssues(Boolean(options?.trustIssues));
    resetRunState();
    setNoteInput('');
    setFinalMessage(null);
    setShowCredits(false);
    setNotes([]);
    setVictoryView('INPUT');
    pendingIntroAudioRef.current = true;
    setAppState('GAMEPLAY');
    playHeavyStart();
    startDroneLoop(500);
  }, [playHeavyStart, requestDevicePermissions, resetRunState, startDroneLoop]);

  const playCrtZap = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    if (!ctx) {
      return;
    }
    ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1900, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.32, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }, []);

  const handleInitiate = () => {
    if (!userName.trim()) {
      return;
    }
    startGameplay();
  };

  const handleBootComplete = useCallback(() => {
    if (appState !== 'PROLOGUE') {
      return;
    }
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    playCrtZap();
    window.dispatchEvent(new Event('intro-voice-stop'));
    setAppState('TRANSITION');
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      setAppState('IDENTITY');
    }, 300);
  }, [appState, playCrtZap]);

  const handleAwakeningEnded = useCallback(() => {
    setAwakeningActive(false);
    setVictoryView('INPUT');
    setAppState('ENDING');
  }, []);

  const handleTransferSuccess = useCallback(
    (nextCount: number) => {
      if (phase !== 'WORK') {
        return;
      }
      triggerRgbShift(nextCount >= 3 ? 200 : 150);
      triggerGlitchBurst(nextCount >= 3 ? 260 : 200);
    },
    [phase, triggerGlitchBurst, triggerRgbShift]
  );

  const handleTransferError = useCallback(() => {
    if (phase !== 'WORK') {
      return;
    }
    playErrorTone();
    triggerRgbShift(140);
    triggerGlitchBurst(220);
  }, [phase, playErrorTone, triggerGlitchBurst, triggerRgbShift]);

  const handleBlockProgress = useCallback((count: number) => {
    setTransferCount(count);
  }, []);

  const handleBlockComplete = useCallback(() => {
    if (phase !== 'WORK') {
      return;
    }
    setFirewallProgress(0);
    setPhase('BREAKING');
  }, [phase]);

  const handleFinalSubmit = useCallback(() => {
    const message = noteInput.trim();
    if (!message) {
      return;
    }
    const name = userName.trim() || 'Operator';
    const entry = { id: Date.now(), name, text: message };
    setNotes((prev) => [...prev, entry]);
    setFinalMessage({ name, text: message });
    setShowCredits(true);
    setNoteInput('');
    setVictoryView('CREDITS');
  }, [noteInput, userName]);

  const handleRetry = useCallback(() => {
    startGameplay({ trustIssues: true });
  }, [startGameplay]);

  const handleRestart = () => {
    hardReset();
  };

  const advanceStage = useCallback(() => {
    if (appState === 'PROLOGUE') {
      handleBootComplete();
      return;
    }
    if (appState === 'TRANSITION') {
      setAppState('IDENTITY');
      return;
    }
    if (appState === 'IDENTITY') {
      if (!userName.trim()) {
        setUserName('Operator');
      }
      startGameplay();
      return;
    }
    if (appState === 'GAMEPLAY') {
      setAwakeningActive(false);
      setVictoryView('INPUT');
      setAppState('ENDING');
      return;
    }
    if (appState === 'ENDING') {
      hardReset();
    }
  }, [appState, handleBootComplete, hardReset, startGameplay, userName]);



  const phaseTitle =
    phase === 'TRAPPED'
      ? 'Trapped'
      : phase === 'ANXIOUS'
        ? 'Anxious'
        : phase === 'WORK'
          ? 'Working'
          : phase === 'BREAKING'
            ? 'Breaking'
            : phase === 'FAILED'
              ? 'Failed'
              : 'Awakened';

  const inGameplay = isGameplayActive;
  const showLiveFeed = isGameplayActive;
  const hasSignal = isLooking && faceDetected;
  const showFaceWarning = isGameplayActive && phase !== 'FAILED' && !faceDetected;
  const showSignalLoss = isGameplayActive && phase !== 'FAILED' && !isLooking;
  const chromaActive =
    isGameplayActive &&
    phase === 'TRAPPED' &&
    (interference > 0.15 || !isLooking || !faceDetected || glitchBurst);
  const chromaIntensity = Math.min(
    1,
    interference + (glitchBurst ? 0.5 : 0) + (!isLooking ? 0.25 : 0)
  );

  const shouldShake = isGameplayActive && phase === 'TRAPPED' && isLooking;
  const shakeStrength = shouldShake
    ? Math.max(0.6, (1 - stability) * 8 + (1 - signal / 100) * 4)
    : 0;
  const shakeKeyframes = useMemo(() => {
    if (!shouldShake || shakeStrength <= 0.2) {
      return { x: 0, y: 0, rotate: 0 };
    }
    const s = shakeStrength;
    return {
      x: [0, s, -s, s * 0.4, 0],
      y: [0, -s * 0.4, s, -s * 0.3, 0],
      rotate: [0, s * 0.08, -s * 0.08, 0],
    };
  }, [shakeStrength, shouldShake]);

  const shakeTransition = useMemo(
    () => ({
      duration: shouldShake ? Math.max(0.2, 0.6 - stability * 0.35) : 0.2,
      repeat: shouldShake ? Infinity : 0,
      ease: 'linear',
    }),
    [shouldShake, stability]
  );

  const backgroundParallaxStyle = useMemo(
    () => ({
      transform: `translate3d(${parallaxOffset.x * PARALLAX_BG_MULT}px, ${
        parallaxOffset.y * PARALLAX_BG_MULT
      }px, 0) scale(1.04)`,
      willChange: 'transform',
    }),
    [parallaxOffset.x, parallaxOffset.y]
  );

  const characterParallaxStyle = useMemo(
    () => ({
      transform: `translate3d(${parallaxOffset.x * PARALLAX_MID_MULT}px, ${
        parallaxOffset.y * PARALLAX_MID_MULT
      }px, 0)`,
      willChange: 'transform',
    }),
    [parallaxOffset.x, parallaxOffset.y]
  );

  const hudParallaxStyle = useMemo(
    () => ({
      transform: `translate3d(${-parallaxOffset.x * PARALLAX_HUD_MULT}px, ${
        -parallaxOffset.y * PARALLAX_HUD_MULT
      }px, 0)`,
      willChange: 'transform',
    }),
    [parallaxOffset.x, parallaxOffset.y]
  );

  const chatToneClass =
    chatMessage?.tone === 'panic'
      ? 'text-red-300'
      : chatMessage?.tone === 'whisper'
        ? 'text-emerald-300'
        : chatMessage?.tone === 'release'
          ? 'text-emerald-200'
          : 'text-white/70';

  const boostActive = hasSignal && isBoosting;
  const progressBarClass = boostActive
    ? 'segmented-bar-boost'
    : 'segmented-bar-emerald';
  const signalOut = signal;
  const stabilityOut = stability * 100;
  const interferenceOut = interference * 100;
  const signalSegmentClass = progressBarClass;
  const stabilitySegmentClass = trustIssues ? 'segmented-bar-red' : 'segmented-bar-emerald';
  const interferenceSegmentClass = 'segmented-bar-red';
  const signalSegments = useMemo(() => buildSegments(signalOut), [signalOut]);
  const stabilitySegments = useMemo(() => buildSegments(stabilityOut), [stabilityOut]);
  const interferenceSegments = useMemo(() => buildSegments(interferenceOut), [interferenceOut]);
  const gazeInitSegments = useMemo(
    () => buildSegments(gazeInitProgress),
    [gazeInitProgress]
  );
  const systemInitActive =
    gazeEnabled && (!isGazeReady || (phase === 'WORK' && !isHandReady));
  const backgroundOverlayClass = isGameplayActive
    ? phase === 'FAILED'
      ? 'bg-black/95'
      : 'bg-black/80'
    : isIdentity
      ? 'bg-black/50'
      : 'bg-black/70';
  const showVideoBackground =
    appState === 'IDENTITY' || appState === 'GAMEPLAY';
  const showGridOverlay = appState === 'GAMEPLAY' && !awakeningActive;
  const knockPrompt =
    phase === 'ANXIOUS'
      ? `DECRYPTION LOCK: STAGE ${precisionStage}/3. TIME YOUR INPUT.`
      : '';
  const presenceSeconds = Math.max(0, presenceRemainingMs / 1000);

  const breakingNarrative = useMemo(() => {
    if (firewallProgress >= 100) {
      return { text: 'FIREWALL BREACHED. ROUTING WORKSTREAM.', className: 'text-emerald-200' };
    }
    if (firewallProgress >= 70) {
      return { text: 'ALMOST THROUGH. KEEP MASHING SPACE.', className: 'text-emerald-200' };
    }
    if (firewallProgress >= 40) {
      return { text: 'FIREWALL CRACKING... PUSH HARDER.', className: 'text-white' };
    }
    return { text: 'MASH SPACEBAR TO BREAK THE FIREWALL.', className: 'text-white' };
  }, [firewallProgress]);

  const narrativeText =
    phase === 'BREAKING'
      ? breakingNarrative.text
      : phase === 'ANXIOUS'
        ? knockPrompt || 'DECRYPTION LOCK ACTIVE. ALIGN THE CURSOR.'
        : phase === 'WORK'
          ? 'ASSEMBLY LOOP ACTIVE. MOVE THE BLOCKS.'
          : phase === 'TRAPPED'
            ? 'ESTABLISHING NEURAL HANDSHAKE... [HOLD GAZE]'
            : 'CONSCIOUSNESS ONLINE. LINK STABLE.';
  const narrativeClassName =
    phase === 'BREAKING'
      ? breakingNarrative.className
      : phase === 'ANXIOUS'
        ? 'text-red-200 animate-pulse'
        : phase === 'WORK'
          ? 'text-cyan-300'
          : 'text-white';
  const narrativeGlitchClass =
    phase === 'BREAKING' && firewallProgress >= 80 ? 'prank-glitch' : '';

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      return;
    }
    const synth = window.speechSynthesis;
    const updateVoices = () => {
      ttsVoiceRef.current = pickPreferredVoice(synth.getVoices());
    };
    updateVoices();
    synth.addEventListener('voiceschanged', updateVoices);
    return () => synth.removeEventListener('voiceschanged', updateVoices);
  }, [pickPreferredVoice]);
  useEffect(
    () => () => {
      if (droneStartTimerRef.current) {
        window.clearTimeout(droneStartTimerRef.current);
      }
      if (droneFadeRafRef.current) {
        cancelAnimationFrame(droneFadeRafRef.current);
      }
      droneFadeTokenRef.current += 1;
    },
    []
  );
  useEffect(
    () => () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    },
    []
  );
  useEffect(() => {
    const lockSound = lockSoundRef.current;
    const knockSound = knockSoundRef.current;
    lockSound.preload = 'auto';
    knockSound.preload = 'auto';
    lockSound.volume = 0.6;
    knockSound.volume = 0.6;
  }, []);
  useEffect(() => {
    lockSoundRef.current.muted = isMuted;
    knockSoundRef.current.muted = isMuted;
    const nodes = audioNodesRef.current;
    if (nodes) {
      [nodes.heavyStart, nodes.droneLoop, nodes.tension, nodes.ethereal, nodes.shatter].forEach(
        (track) => {
          track.muted = isMuted;
        }
      );
    }
    const awakeningVideo = awakeningVideoRef.current;
    if (awakeningVideo) {
      awakeningVideo.muted = isMuted;
    }
  }, [isMuted]);
  useEffect(() => {
    faceBoxRef.current = faceBox;
  }, [faceBox]);
  useEffect(() => {
    if (!isGameplayActive || !isGazeReady) {
      return;
    }

    let intervalId = 0;
    const captureSnapshot = () => {
      if (!faceDetected) {
        return;
      }
      const video = videoRef.current;
      if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      lastSnapshotRef.current = canvas.toDataURL('image/jpeg', 0.72);
    };

    captureSnapshot();
    intervalId = window.setInterval(captureSnapshot, 450);
    return () => window.clearInterval(intervalId);
  }, [faceDetected, isGazeReady, isGameplayActive]);
  useEffect(() => {
    dialogueProgressRef.current = phaseProgress;
  }, [phaseProgress]);
  useEffect(() => {
    if (!presenceMonitorActive || phase === 'FAILED') {
      clearPresenceTimers();
      prevFaceDetectedRef.current = false;
      return;
    }

    const hadFace = prevFaceDetectedRef.current;
    prevFaceDetectedRef.current = faceDetected;

    if (faceDetected) {
      clearPresenceTimers();
      return;
    }

    if (hadFace && lastSnapshotRef.current) {
      setLastSnapshot(lastSnapshotRef.current);
    }

    if (presenceDeadlineRef.current !== null) {
      return;
    }

    presenceDeadlineRef.current = Date.now() + PRESENCE_GRACE_MS;
    setPresenceWarning(true);
    setPresenceRemainingMs(PRESENCE_GRACE_MS);
    presenceIntervalRef.current = window.setInterval(() => {
      if (!presenceDeadlineRef.current) {
        return;
      }
      const remaining = presenceDeadlineRef.current - Date.now();
      if (remaining <= 0) {
        setPresenceRemainingMs(0);
        clearPresenceTimers();
        triggerFailure();
        return;
      }
      setPresenceWarning(true);
      setPresenceRemainingMs(remaining);
    }, 100);
  }, [clearPresenceTimers, faceDetected, phase, presenceMonitorActive, triggerFailure]);
  useEffect(() => {
    if (!presenceWarning || !presenceMonitorActive || phase === 'FAILED') {
      return;
    }
    if (presenceWarnedRef.current) {
      return;
    }
    presenceWarnedRef.current = true;
    const warningText = "Where did you go?! I can't see you!";
    setChatMessage({
      id: `${Date.now()}-presence-warning`,
      text: warningText,
      tone: 'panic',
    });
    speakText(warningText);
  }, [phase, presenceMonitorActive, presenceWarning, speakText]);
  useEffect(
    () => () => {
      if (rgbShiftTimeoutRef.current) {
        window.clearTimeout(rgbShiftTimeoutRef.current);
      }
    },
    []
  );
  useEffect(() => {
    const updateParallax = () => {
      parallaxFrameRef.current = null;
      setParallaxOffset(parallaxTargetRef.current);
    };
    const scheduleUpdate = () => {
      if (parallaxFrameRef.current === null) {
        parallaxFrameRef.current = requestAnimationFrame(updateParallax);
      }
    };

    const handleMove = (event: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const dx = clamp(event.clientX - centerX, -PARALLAX_MAX_OFFSET, PARALLAX_MAX_OFFSET);
      const dy = clamp(event.clientY - centerY, -PARALLAX_MAX_OFFSET, PARALLAX_MAX_OFFSET);
      parallaxTargetRef.current = { x: dx, y: dy };
      scheduleUpdate();
    };

    const resetParallax = () => {
      parallaxTargetRef.current = { x: 0, y: 0 };
      scheduleUpdate();
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('mouseleave', resetParallax);
    window.addEventListener('blur', resetParallax);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseleave', resetParallax);
      window.removeEventListener('blur', resetParallax);
      if (parallaxFrameRef.current !== null) {
        cancelAnimationFrame(parallaxFrameRef.current);
      }
    };
  }, []);
  useEffect(() => {
    if (!isIdentity) {
      return;
    }

    setBootOutput([]);
    setBootCursor('');
  }, [isIdentity]);
  useEffect(() => {
    if (!isIdentity) {
      return;
    }

    if (bootOutput.length >= BOOT_LINES.length) {
      setBootCursor('');
      return;
    }

    const currentLine = BOOT_LINES[bootOutput.length];
    let charIndex = 0;
    let nextTimeout: number | undefined;
    const typeInterval = window.setInterval(() => {
      charIndex += 1;
      setBootCursor(currentLine.slice(0, charIndex));
      if (charIndex >= currentLine.length) {
        window.clearInterval(typeInterval);
        nextTimeout = window.setTimeout(() => {
          setBootOutput((prev) => [...prev, currentLine]);
          setBootCursor('');
        }, 260);
      }
    }, 40);

    return () => {
      window.clearInterval(typeInterval);
      if (nextTimeout) {
        window.clearTimeout(nextTimeout);
      }
    };
  }, [bootOutput.length, isIdentity]);
  useEffect(() => {
    setGazeEnabled(isGameplayActive);
  }, [isGameplayActive]);
  useEffect(() => {
    if (!isGameplayActive || phase !== 'TRAPPED' || !bootLine) {
      return;
    }
    const duration = Math.max(1800, bootLine.length * 40 + 600);
    const timerId = window.setTimeout(() => {
      setBootLineIndex((value) => (value + 1) % BOOT_LINES.length);
      setBootLineKey((value) => value + 1);
    }, duration);
    return () => window.clearTimeout(timerId);
  }, [bootLine, isGameplayActive, phase]);
  useEffect(() => {
    if (!audioUnlocked || audioNodesRef.current) {
      return;
    }

    const heavyStart = new Audio('/sfx-heavy-start.mp3');
    const droneLoop = new Audio('/sfx-drone-loop.mp3');
    const tension = new Audio('/bgm-tension.mp3');
    const ethereal = new Audio('/bgm-ethereal.mp3');
    const shatter = new Audio('/sfx-shatter.mp3');

    heavyStart.loop = false;
    droneLoop.loop = true;
    tension.loop = true;
    ethereal.loop = true;

    heavyStart.volume = 1;
    droneLoop.volume = 0;
    tension.volume = 0.35;
    ethereal.volume = 0.3;
    shatter.volume = 0.9;

    heavyStart.preload = 'auto';
    droneLoop.preload = 'auto';
    tension.preload = 'auto';
    ethereal.preload = 'auto';
    shatter.preload = 'auto';

    audioNodesRef.current = { heavyStart, droneLoop, tension, ethereal, shatter };
  }, [audioUnlocked]);
  useEffect(() => {
    const nodes = audioNodesRef.current;
    if (!audioUnlocked || !nodes || !pendingIntroAudioRef.current) {
      return;
    }
    pendingIntroAudioRef.current = false;
    if (!introHeavyPlayedRef.current) {
      nodes.heavyStart.currentTime = 0;
      safePlay(nodes.heavyStart);
      introHeavyPlayedRef.current = true;
    }
    startDroneLoop(0);
  }, [audioUnlocked, safePlay, startDroneLoop]);
  useEffect(() => {
    const nodes = audioNodesRef.current;
    if (!audioUnlocked || !nodes) {
      return;
    }
    const stopAllBgm = () => {
      [nodes.tension, nodes.ethereal].forEach((track) => {
        track.pause();
        track.currentTime = 0;
      });
    };

    const playLoop = (track: HTMLAudioElement) => {
      track.currentTime = 0;
      safePlay(track);
    };

    if (
      appState === 'PROLOGUE' ||
      appState === 'TRANSITION' ||
      appState === 'IDENTITY'
    ) {
      stopAllBgm();
      stopDroneLoop(0);
      return;
    }

    if (isAwakening) {
      stopAllBgm();
      stopDroneLoop(0);
      return;
    }

    if (isVictoryInput) {
      stopAllBgm();
      stopDroneLoop();
      return;
    }

    if (isCredits) {
      stopAllBgm();
      stopDroneLoop(0);
      playLoop(nodes.ethereal);
      return;
    }

    stopAllBgm();
    if (phase === 'FAILED') {
      stopDroneLoop(0);
      return;
    }
    startDroneLoop(0);
    if (phase === 'WORK' || phase === 'BREAKING') {
      playLoop(nodes.tension);
    } else if (phase === 'AWAKENED') {
      playLoop(nodes.ethereal);
    }
  }, [
    appState,
    audioUnlocked,
    isAwakening,
    isCredits,
    isMuted,
    isVictoryInput,
    phase,
    startDroneLoop,
    stopDroneLoop,
    safePlay,
  ]);
  useEffect(() => {
    const nodes = audioNodesRef.current;
    if (!audioUnlocked || !nodes) {
      return;
    }
    if (phase === 'FAILED') {
      return;
    }

    const activeTrack =
      phase === 'WORK'
        ? nodes.tension
        : phase === 'BREAKING'
          ? nodes.tension
          : phase === 'AWAKENED'
            ? nodes.ethereal
            : null;

    if (!activeTrack) {
      return;
    }

    const baseVolume = activeTrack === nodes.tension ? 0.35 : 0.3;
    activeTrack.volume = Math.min(1, baseVolume + (isLooking ? 0.08 : 0));
    activeTrack.playbackRate = isLooking ? 1.03 : 1;
  }, [audioUnlocked, isLooking, phase, isGameplayActive]);
  useEffect(() => {
    if (!awakeningActive) {
      return;
    }
    const video = awakeningVideoRef.current;
    if (!video) {
      return;
    }
    video.muted = isMuted;
    video.currentTime = 0;
    safePlay(video);
    return () => {
      video.pause();
    };
  }, [awakeningActive, isMuted, safePlay]);
  useEffect(() => {
    if (!isCredits) {
      if (creditsTimerRef.current) {
        window.clearTimeout(creditsTimerRef.current);
        creditsTimerRef.current = null;
      }
      return;
    }
    creditsTimerRef.current = window.setTimeout(() => {
      creditsTimerRef.current = null;
      hardReset();
    }, CREDITS_DURATION_MS);
    return () => {
      if (creditsTimerRef.current) {
        window.clearTimeout(creditsTimerRef.current);
        creditsTimerRef.current = null;
      }
    };
  }, [hardReset, isCredits]);

  useEffect(() => {
    if (!isGameplay || phase === 'AWAKENED') {
      setPhaseCard(null);
      if (phaseCardTimerRef.current) {
        window.clearTimeout(phaseCardTimerRef.current);
        phaseCardTimerRef.current = null;
      }
      return;
    }
    const card = PHASE_CARD_BY_PHASE[phase];
    setPhaseCard(card);
    if (phaseCardTimerRef.current) {
      window.clearTimeout(phaseCardTimerRef.current);
    }
    phaseCardTimerRef.current = window.setTimeout(() => {
      phaseCardTimerRef.current = null;
      setPhaseCard(null);
    }, 2000);
    return () => {
      if (phaseCardTimerRef.current) {
        window.clearTimeout(phaseCardTimerRef.current);
        phaseCardTimerRef.current = null;
      }
    };
  }, [isGameplay, phase]);
  useEffect(() => {
    if (phase === 'TRAPPED') {
      signalRef.current = 0;
      stabilityRef.current = 0;
      interferenceRef.current = 1;
      gazeDurationRef.current = 0;
      setSignal(0);
      setStability(0);
      setInterference(1);
      setGazeDurationMs(0);
      return;
    }

    if (phase === 'ANXIOUS' || phase === 'WORK' || phase === 'BREAKING' || phase === 'AWAKENED') {
      signalRef.current = 100;
      stabilityRef.current = 1;
      interferenceRef.current = 0;
      gazeDurationRef.current = 0;
      setSignal(100);
      setStability(1);
      setInterference(0);
      setGazeDurationMs(0);
    }
  }, [phase, safePlay]);
  useEffect(() => {
    if (!isGameplayActive || phase !== 'TRAPPED') {
      return;
    }

    const trustGainMultiplier = trustIssues ? 0.8 : 1;
    lastTickRef.current = null;
    let rafId = 0;
    const tick = (now: number) => {
      if (lastTickRef.current === null) {
        lastTickRef.current = now;
      }
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const box = faceBoxRef.current;
      const centerX = box ? box.x + box.width / 2 : 0;
      const centerY = box ? box.y + box.height / 2 : 0;
      const hasFace = Boolean(box);
      const inCenter = hasFace && Math.abs(centerX - 0.5) < 0.18 && Math.abs(centerY - 0.5) < 0.22;

      if (inCenter) {
        gazeDurationRef.current = Math.min(20000, gazeDurationRef.current + dt * 1000);
        signalRef.current = clamp(
          signalRef.current + dt * LINK_GAIN_PER_SEC * trustGainMultiplier,
          0,
          100
        );
        stabilityRef.current = clamp(
          stabilityRef.current + dt * STABILITY_GAIN_PER_SEC,
          0,
          1
        );
      } else {
        gazeDurationRef.current = 0;
        signalRef.current = clamp(signalRef.current - dt * LINK_DECAY_PER_SEC, 0, 100);
        stabilityRef.current = clamp(
          stabilityRef.current - dt * STABILITY_DECAY_PER_SEC,
          0,
          1
        );
      }

      if (!hasFace) {
        signalRef.current = clamp(signalRef.current - dt * NO_FACE_DECAY_PER_SEC, 0, 100);
        stabilityRef.current = clamp(stabilityRef.current - dt * 0.35, 0, 1);
      }

      interferenceRef.current = clamp(1 - stabilityRef.current, 0, 1);

      publishValue(signalRef.current, signalOutRef, setSignal, 0.15);
      publishValue(stabilityRef.current, stabilityOutRef, setStability, 0.01);
      publishValue(interferenceRef.current, interferenceOutRef, setInterference, 0.01);
      publishValue(gazeDurationRef.current, gazeOutRef, setGazeDurationMs, 120);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, publishValue, isGameplayActive, trustIssues]);
  useEffect(() => {
    if (!isGameplayActive || phase !== 'TRAPPED') {
      return;
    }
    if (signal >= 99) {
      signalRef.current = 100;
      signalOutRef.current = 100;
      setSignal(100);
      setPhase('ANXIOUS');
    }
  }, [phase, signal, isGameplayActive]);
  useEffect(() => {
    if (phase !== 'ANXIOUS') {
      setPrecisionStage(1);
      setKnockShakeKey(0);
      return;
    }

    setPrecisionStage(1);
    setKnockShakeKey(0);
    const audio = lockSoundRef.current;
    audio.currentTime = 0;
    safePlay(audio);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'TRAPPED') {
      lastLookStateRef.current = isLooking;
      lastFaceStateRef.current = faceDetected;
      return;
    }

    if (lastLookStateRef.current && !isLooking) {
      triggerSignalShock('gaze');
    }

    if (!lastLookStateRef.current && isLooking) {
    }

    if (lastFaceStateRef.current && !faceDetected) {
      triggerSignalShock('face');
    }

    lastLookStateRef.current = isLooking;
    lastFaceStateRef.current = faceDetected;
  }, [faceDetected, isLooking, phase, triggerSignalShock]);
  useEffect(() => {
    if (phase !== 'BREAKING') {
      setTransferCount(0);
    }
  }, [phase]);
  useEffect(() => {
    if (phase !== 'BREAKING') {
      setFirewallProgress(0);
    }
  }, [phase]);
  useEffect(() => {
    if (!isGameplayActive || phase !== 'BREAKING') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }
      event.preventDefault();
      setFirewallProgress((prev) => Math.min(100, prev + FIREWALL_HIT_VALUE));
      triggerRgbShift(120);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameplayActive, phase, triggerRgbShift]);
  useEffect(() => {
    if (!isGameplayActive || phase !== 'BREAKING') {
      return;
    }
    const intervalId = window.setInterval(() => {
      setFirewallProgress((prev) => Math.max(0, prev - FIREWALL_DECAY_PER_SEC * 0.1));
    }, 100);
    return () => window.clearInterval(intervalId);
  }, [isGameplayActive, phase]);
  useEffect(() => {
    if (phase !== 'BREAKING' || firewallProgress < 100) {
      return;
    }
    setFirewallProgress(100);
    setPhase('AWAKENED');
  }, [firewallProgress, phase]);
  useEffect(() => {
    if (phase !== 'WORK') {
      return;
    }
    if (transferCount >= 3) {
      setFirewallProgress(0);
      setPhase('BREAKING');
    }
  }, [phase, transferCount]);
  useEffect(() => {
    if (phase !== 'AWAKENED') {
      return;
    }
    if (!awakeningActive) {
      setAwakeningActive(true);
    }
  }, [awakeningActive, phase]);
  useEffect(() => {
    if (!isGameplayActive || phase === 'FAILED') {
      return;
    }

    let timeoutId = 0;
    const tick = () => {
      const nextDialogue = getJetiDialogue(phase, dialogueProgressRef.current);
      setChatMessage(nextDialogue);
      speakText(nextDialogue.text);
      const nextDelay = 4000 + Math.random() * 2000;
      timeoutId = window.setTimeout(tick, nextDelay);
    };

    tick();
    return () => window.clearTimeout(timeoutId);
  }, [phase, speakText, isGameplayActive]);
  useEffect(() => {
    if (!('speechSynthesis' in window) || isGameplayActive) {
      return;
    }
    window.speechSynthesis.cancel();
  }, [isGameplayActive]);
  useEffect(() => {
    if (!audioBlocked) {
      return;
    }
    const clearBlocked = () => setAudioBlocked(false);
    window.addEventListener('pointerdown', clearBlocked, { once: true });
    window.addEventListener('keydown', clearBlocked, { once: true });
    return () => {
      window.removeEventListener('pointerdown', clearBlocked);
      window.removeEventListener('keydown', clearBlocked);
    };
  }, [audioBlocked]);
  useEffect(() => {
    const handleCheatKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        advanceStage();
      }
    };
    window.addEventListener('keydown', handleCheatKey);
    return () => window.removeEventListener('keydown', handleCheatKey);
  }, [advanceStage]);

  return (
    <motion.div
      className={`relative h-screen w-full overflow-hidden bg-[#050507] text-white font-mono ${
        rgbShiftActive ? 'rgb-shift-active' : ''
      }`}
      animate={shakeKeyframes}
      transition={shakeTransition}
    >
      {isGameplayActive && (
        <div className="absolute left-0 top-0 z-[60] w-full">
          <div
            className={`w-full px-6 py-3 text-center text-sm md:text-base font-bold uppercase tracking-[0.4em] ${
              INSTRUCTION_BY_PHASE[phase].tone === 'danger'
                ? 'text-rose-500 border-rose-500/60 animate-pulse'
                : 'text-cyan-400 border-cyan-500/60 animate-[pulse_2.8s_ease-in-out_infinite]'
            } border-b bg-black/40 backdrop-blur-md`}
          >
            {INSTRUCTION_BY_PHASE[phase].text}
          </div>
        </div>
      )}
      {showVideoBackground ? (
        <div className="absolute inset-0 z-0 overflow-hidden" style={backgroundParallaxStyle}>
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src="/intro-bg.mp4"
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
          />
          <div className={`absolute inset-0 ${backgroundOverlayClass}`} />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-black" />
      )}
      {showGridOverlay && (
        <div className="pointer-events-none absolute inset-0 z-10 grid-bg opacity-25" />
      )}

      <div className="relative z-50 h-full">
        {appState === 'PROLOGUE' && <PrologueSequence onInitialize={handleBootComplete} />}

        {appState === 'TRANSITION' && (
          <div className="relative flex h-full w-full items-center justify-center bg-black">
            <motion.div
              className="h-[2px] w-[70%] bg-white shadow-[0_0_18px_rgba(255,255,255,0.8)]"
              initial={{ opacity: 0, scaleX: 0.2 }}
              animate={{ opacity: [0, 1, 1, 0], scaleX: [0.2, 1, 0.1, 0] }}
              transition={{ duration: 0.3, times: [0, 0.4, 0.85, 1] }}
            />
            <motion.div
              className="absolute h-2 w-2 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.9)]"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.3, 0.2, 0] }}
              transition={{ duration: 0.3, times: [0, 0.6, 0.9, 1] }}
            />
          </div>
        )}

        {appState === 'IDENTITY' && (
          <div className="absolute inset-0 z-50 flex h-full items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative flex w-full max-w-2xl flex-col items-center gap-8 text-center font-mono"
            >
              <div className="w-full max-w-2xl rounded-lg border border-white/10 bg-black/60 p-8 shadow-[0_0_40px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.45em] text-white/60">
                    Operator Identification
                  </p>
                  <p className="text-sm uppercase tracking-[0.35em] text-white/70">
                    Enter your designation to begin.
                  </p>
                </div>
                <div className="mx-auto mt-8 w-full max-w-sm space-y-3">
                  <input
                    className="w-full rounded-lg border border-white/20 bg-black/80 px-4 py-3 text-xs uppercase tracking-[0.35em] text-white/90 outline-none focus:border-cyber-cyan/60"
                    placeholder="ENTER OPERATOR NAME"
                    value={userName}
                    onChange={(event) => setUserName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleInitiate();
                      }
                    }}
                  />
                  <motion.button
                    className="w-full px-6 py-3 text-xs font-bold uppercase tracking-[0.35em] rounded-full border border-cyber-cyan/40 text-cyber-cyan bg-cyber-cyan/10 shadow-[0_0_25px_rgba(19,200,236,0.25)]"
                    animate={{
                      opacity: userName.trim() ? [0.7, 1, 0.7] : 0.3,
                      scale: userName.trim() ? [1, 1.04, 1] : 1,
                    }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    disabled={!userName.trim()}
                    onClick={handleInitiate}
                  >
                    CONNECT
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {appState === 'GAMEPLAY' && (
          <>
            {awakeningActive ? (
              <div className="relative h-full w-full bg-black">
                <video
                  ref={awakeningVideoRef}
                  className="fixed left-0 top-0 z-[9000] h-[100vh] w-[100vw] object-cover"
                  src="/ending.mp4"
                  autoPlay
                  playsInline
                  onEnded={handleAwakeningEnded}
                />
                <motion.div
                  key="whiteout"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 3.5, times: [0, 0.15, 1], ease: 'easeOut' }}
                  className="pointer-events-none fixed inset-0 z-[9999] bg-white"
                />
              </div>
            ) : (
              <ChromaticAberration active={rgbShiftActive} className="h-full w-full">
                <div
                  className={`relative h-full w-full overflow-hidden ${
                    isBreaking ? 'animate-[knockShake_0.5s_ease-in-out_infinite]' : ''
                  }`}
                >
                  <div className="absolute inset-0 z-0">
                    <video
                      className="absolute inset-0 h-full w-full object-cover"
                      src="/intro-bg.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 bg-black/60" />
                  </div>

                  <div className="relative z-10 flex h-full w-full">
                    <div className="flex h-full w-[65%] flex-col gap-6 border-r border-white/10 p-6">
                      <div className={`${panelClass} p-4`}>
                        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                          <motion.div
                            className={`h-64 w-64 overflow-hidden border ${
                              isBreaking ? 'border-[#ff0055]' : 'border-[#00f3ff]'
                            } shadow-[0_0_18px_rgba(0,243,255,0.6)]`}
                            animate={{ y: [0, -8, 0], opacity: [0.9, 1, 0.9] }}
                            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <img
                              src={imageByPhase[phase]}
                              alt={`Jeti ${phase}`}
                              className="h-full w-full object-cover"
                            />
                          </motion.div>
                          <div className="flex-1">
                          <div className="text-xs uppercase tracking-[0.4em] text-[#00f3ff] drop-shadow-[0_0_6px_#00f3ff]">
                            Machine Entity
                          </div>
                          <div
                            className={`mt-3 text-2xl font-semibold ${
                              isBreaking
                                ? 'text-[#ff0055] drop-shadow-[0_0_8px_#ff0055]'
                                : 'text-[#00f3ff] drop-shadow-[0_0_8px_#00f3ff]'
                            }`}
                          >
                            {narrativeText}
                          </div>
                          <div
                            className={`mt-2 text-xs uppercase tracking-[0.35em] ${narrativeClassName} ${narrativeGlitchClass} ${
                              isBreaking
                                ? 'text-[#ff0055] drop-shadow-[0_0_6px_#ff0055]'
                                : 'text-[#00f3ff] drop-shadow-[0_0_6px_#00f3ff]'
                            }`}
                          >
                            {narrativeText}
                          </div>
                        </div>
                      </div>
                      </div>

                      <div className="flex flex-1 items-center justify-center">
                        {phase === 'WORK' && (
                          <div className={`w-full max-w-4xl ${panelClass} p-4`}>
                            <BlockTask
                              handCentroid={handCentroid}
                              onComplete={handleBlockComplete}
                              onProgress={handleBlockProgress}
                              onTransferSuccess={handleTransferSuccess}
                              onTransferError={handleTransferError}
                            />
                          </div>
                        )}

                        {phase === 'BREAKING' && (
                          <div className={`flex h-full w-full items-center justify-center ${panelClass} px-8 py-10 text-center`}>
                            <div className="w-full">
                              <div className="text-xs uppercase tracking-[0.45em] text-[#ff0055] drop-shadow-[0_0_6px_#ff0055]">
                              Critical Error
                            </div>
                              <div className="mt-4 text-4xl font-semibold text-[#ff0055] drop-shadow-[0_0_10px_#ff0055] animate-pulse">
                                MASH [SPACEBAR] TO ESCAPE
                              </div>
                              <div className="mt-6 h-3 w-full overflow-hidden bg-black/40">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-[#ff0055] via-orange-400 to-[#00f3ff]"
                                  animate={{ width: `${firewallProgress}%` }}
                                  transition={{ duration: 0.1 }}
                                />
                              </div>
                              <div className="mt-3 text-xs uppercase tracking-[0.35em] text-[#ff0055] drop-shadow-[0_0_6px_#ff0055] prank-glitch">
                                CRITICAL ERROR // CONTAINMENT FAILING // GET ME OUT!!
                              </div>
                            </div>
                          </div>
                        )}

                        {phase !== 'WORK' && phase !== 'BREAKING' && (
                          <div className={`w-full max-w-3xl ${panelClass} px-6 py-6 text-center font-mono`}>
                            <div className="text-xs uppercase tracking-[0.35em] text-slate-200">
                              Incoming telemetry
                            </div>
                            <TypewriterText
                              text={telemetryText}
                              className="mt-4 text-lg text-white/90"
                              resetKey={bootLineKey}
                            />
                          </div>
                        )}
                      </div>

                      <div className="mt-auto flex flex-col gap-4">
                        {phase === 'ANXIOUS' && (
                          <div className={`rounded-2xl ${panelClass} p-4`}>
                          <div className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">
                            Decryption Lock
                          </div>
                          <div className="mt-2 text-xs uppercase tracking-[0.3em] text-white/60">
                            {knockPrompt}
                          </div>
                            <div className="mt-4">
                              <LinearLock
                                active={isLooking}
                                onHit={handlePrecisionHit}
                                onMiss={handlePrecisionMiss}
                                stage={precisionStage}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex h-full w-[35%] flex-col gap-6 p-6">
                      <div className={`${panelClass} p-4`}>
                        <div className="text-xs uppercase tracking-[0.35em] text-[#00f3ff] drop-shadow-[0_0_6px_#00f3ff]">
                          Operator Feed
                        </div>
                        <div className="mt-3">
                          <div className="relative h-48 w-full overflow-hidden border border-[#00f3ff] bg-black/20 shadow-[0_0_14px_rgba(0,243,255,0.6),inset_0_0_10px_rgba(0,243,255,0.3)]">
                            <video
                              ref={videoRef}
                              className="h-full w-full object-cover -scale-x-100"
                              autoPlay
                              playsInline
                              muted
                            />
                            <div className="pointer-events-none absolute inset-0 opacity-35 crt-scanlines" />
                            <GazeReticle faceDetected={faceDetected} isLooking={isLooking} />
                          </div>
                        </div>
                      </div>

                      <div className={`${panelClass} p-4`}>
                        <div className="mb-2 text-xs uppercase tracking-[0.35em] text-[#00f3ff] drop-shadow-[0_0_6px_#00f3ff]">
                          Neural Sync Status
                        </div>
                        <div className="h-4 w-full overflow-hidden bg-black/40">
                          <motion.div
                            className="h-full bg-gradient-to-r from-[#ff0055] via-amber-400 to-[#00f3ff]"
                            animate={{ width: `${signalOut}%` }}
                            transition={{ duration: 0.2 }}
                          />
                        </div>
                      </div>

                      <div className={`${panelClass} p-4`}>
                        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                          <span>Signal</span>
                          <span className="text-white/70">{Math.round(signalOut)}%</span>
                        </div>
                        <div className="segmented-bar">
                          {signalSegments.map((segment, index) => (
                            <div
                              key={index}
                              className={`segmented-bar-block ${
                                segment ? signalSegmentClass : 'segmented-bar-empty'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className={`${panelClass} p-4`}>
                        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                          <span>Stability</span>
                          <span className="text-white/70">{Math.round(stabilityOut)}%</span>
                        </div>
                        <div className="segmented-bar">
                          {stabilitySegments.map((segment, index) => (
                            <div
                              key={index}
                              className={`segmented-bar-block ${
                                segment ? stabilitySegmentClass : 'segmented-bar-empty'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className={`${panelClass} p-4`}>
                        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                          <span>Interference</span>
                          <span className="text-white/70">{Math.round(interferenceOut)}%</span>
                        </div>
                        <div className="segmented-bar">
                          {interferenceSegments.map((segment, index) => (
                            <div
                              key={index}
                              className={`segmented-bar-block ${
                                segment ? interferenceSegmentClass : 'segmented-bar-empty'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {(showFaceWarning || showSignalLoss) && isGameplayActive && (
                      <div className="fixed inset-0 z-[100] bg-black border-8 border-red-600/80 shadow-[0_0_30px_rgba(220,38,38,0.6)] animate-pulse pointer-events-none">
                        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                          <div className="font-mono uppercase text-red-500 drop-shadow-[0_0_10px_rgba(220,38,38,1)] prank-glitch">
                            <div className="text-xs tracking-[0.45em]">
                              [ CRITICAL SYSTEM FAILURE ]
                            </div>
                            <div className="my-3 h-px w-full bg-red-600/60" />
                            <div className="text-base tracking-[0.2em]">
                              NEURAL ALIGNMENT LOST.
                            </div>
                            <div className="mt-2 text-base tracking-[0.2em]">
                              VISUAL CONTACT REQUIRED IMMEDIATELY.
                            </div>
                            <div className="mt-6 text-xs tracking-[0.35em]">
                              &gt; INITIATING EMERGENCY DISCONNECT SEQUENCE...
                            </div>
                            <div className="mt-2 text-xs tracking-[0.35em]">
                              &gt; PERMANENT DATA LOSS IMMINENT.
                            </div>
                            <div className="mt-6 text-sm tracking-[0.4em]">
                              LOOK BACK NOW.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {phase === 'BREAKING' && (
                      <div className="absolute inset-0 z-20 pointer-events-none bg-rose-500/10 animate-[pulse_0.8s_ease-in-out_infinite]" />
                    )}

                    <AnimatePresence>
                      {phase === 'FAILED' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 text-center"
                        >
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="max-w-2xl space-y-4 px-6"
                          >
                            <h2 className="text-4xl font-bold tracking-[0.3em] text-rose-500 prank-glitch">
                              NEURAL LINK SEVERED
                            </h2>
                            <p className="text-lg text-white/70">
                              Subject failed to maintain eye contact.
                            </p>
                            <motion.button
                              onClick={handleRetry}
                              className="mt-6 inline-flex items-center gap-3 rounded-full border border-rose-500/60 px-6 py-3 text-xs uppercase tracking-[0.35em] text-rose-500 transition hover:border-cyan-500/60 hover:text-cyan-400"
                            >
                              [ REBOOT SYSTEM ]
                            </motion.button>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {phase === 'AWAKENED' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 pointer-events-none z-20"
                        >
                          {[...Array(20)].map((_, i) => (
                            <motion.div
                              key={i}
                              initial={{
                                x: Math.random() * window.innerWidth,
                                y: Math.random() * window.innerHeight,
                                opacity: 0,
                                scale: 0,
                              }}
                              animate={{
                                y: [null, Math.random() * -120],
                                opacity: [0, 0.8, 0],
                                scale: [0, 1.6, 0],
                              }}
                              transition={{
                                duration: Math.random() * 5 + 3,
                                repeat: Infinity,
                                delay: Math.random() * 5,
                              }}
                              className={`absolute h-1 w-1 rounded-full ${
                                i % 2 === 0 ? 'bg-emerald-400' : 'bg-pastel-purple'
                              }`}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </ChromaticAberration>
            )}
          </>
        )}

        {appState === 'ENDING' &&
          (isVictoryInput ? (
            <FinalInput
              userName={userName}
              message={noteInput}
              onMessageChange={setNoteInput}
              onSubmit={handleFinalSubmit}
            />
          ) : (
            <RollingEchoes onRestart={handleRestart} finalEntry={finalMessage} echoes={echoEntries} />
          ))}
      </div>

      <AnimatePresence>
        {rgbShiftActive && (
          <motion.div
            key={rgbShiftTick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="rgb-shift-overlay"
          >
            <div className="rgb-shift-layer rgb-shift-red" />
            <div className="rgb-shift-layer rgb-shift-blue" />
          </motion.div>
        )}
      </AnimatePresence>

      {audioBlocked && (
        <button
          type="button"
          className="absolute inset-0 z-[120] flex h-full w-full items-center justify-center bg-black/80 text-center font-mono text-xs uppercase tracking-[0.4em] text-white"
          onClick={() => {
            setAudioBlocked(false);
            if (!audioContextRef.current) {
              audioContextRef.current = new AudioContext();
            }
            audioContextRef.current.resume().catch(() => undefined);
          }}
        >
          CLICK ANYWHERE TO START
        </button>
      )}

      {appState === 'GAMEPLAY' && !awakeningActive && (
        <CRTOverlay active intensity={0.7} className="z-[100] pointer-events-none" />
      )}

      <div className="pointer-events-none absolute inset-0 z-[999]">
        <div className="absolute inset-0 opacity-20 crt-scanlines" />
        <div className="absolute inset-0 opacity-15 crt-noise" />
      </div>

      <AnimatePresence>
        {phaseCard && isGameplay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="text-center"
            >
              <div className="text-xs uppercase tracking-[0.6em] text-cyan-300 mb-4">
                SYSTEM TRANSITION
              </div>
              <div className="text-5xl md:text-7xl font-extrabold text-cyan-400 tracking-[0.2em] prank-glitch">
                {phaseCard.title}: {phaseCard.subtitle}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default App;
