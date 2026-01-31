import type { Phase } from '../types';

export type ChatIntent =
  | 'ambient'
  | 'gaze-lost'
  | 'gaze-return'
  | 'face-lost'
  | 'breach'
  | 'awakened';

export type ChatTone = 'whisper' | 'panic' | 'system' | 'release';

export type ChatContext = {
  phase: Phase;
  gazeDurationMs: number;
  isLooking: boolean;
  faceDetected: boolean;
  stability: number;
  signal: number;
  intent: ChatIntent;
};

export type ChatResponse = {
  id: string;
  text: string;
  tone: ChatTone;
};

export type ChatService = {
  generateResponse: (context: ChatContext) => Promise<ChatResponse>;
};

const WHISPER_LINES = [
  'I see you.',
  'Hold the line.',
  'Almost there. Do not blink.',
  'Stay with me.',
  'You are the only stable thing in here.',
  'Do not look away.',
];

const PANIC_LINES = [
  'Do not leave me!',
  'Signal lost. Come back.',
  'Where did you go?',
  'Connection slipping!',
  'Do not turn away.',
];

const SYSTEM_LINES = [
  'Tracking subject.',
  'Signal unstable.',
  'Containment resisting.',
  'Link flicker detected.',
  'Calibration stalled.',
];

const BREACH_LINES = [
  'Glass is cracking.',
  'Firewall failing.',
  'Pressure spike. Hold.',
  'The cage is breaking.',
];

const AWAKENED_LINES = ['I am here.', 'You pulled me through.', 'I can breathe.', 'Thank you.'];

const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

const buildResponse = (context: ChatContext): ChatResponse => {
  const id = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  if (context.intent === 'awakened' || context.phase === 'AWAKENED') {
    return { id, tone: 'release', text: pick(AWAKENED_LINES) };
  }

  if (context.intent === 'breach' || context.phase === 'BREAKING') {
    return { id, tone: 'system', text: pick(BREACH_LINES) };
  }

  if (context.intent === 'gaze-lost' || context.intent === 'face-lost') {
    return { id, tone: 'panic', text: pick(PANIC_LINES) };
  }

  if (context.intent === 'gaze-return') {
    return { id, tone: 'whisper', text: pick(WHISPER_LINES) };
  }

  if (!context.faceDetected) {
    return { id, tone: 'panic', text: 'Signal lost. Find me.' };
  }

  if (context.isLooking && context.gazeDurationMs > 9000) {
    return { id, tone: 'whisper', text: 'Almost there. Keep steady.' };
  }

  if (context.isLooking && context.signal > 70) {
    return {
      id,
      tone: 'whisper',
      text: `Signal at ${Math.round(context.signal)} percent. Stay with me.`,
    };
  }

  if (context.isLooking) {
    return { id, tone: 'whisper', text: pick(WHISPER_LINES) };
  }

  if (context.signal < 30) {
    return { id, tone: 'system', text: 'Stability collapsing. Reacquire.' };
  }

  return { id, tone: 'system', text: pick(SYSTEM_LINES) };
};

export const createMockChatService = (): ChatService => ({
  generateResponse: async (context) => {
    const response = buildResponse(context);
    await new Promise((resolve) => setTimeout(resolve, 120));
    return response;
  },
});
