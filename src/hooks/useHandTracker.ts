import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { getVisionResolver, loadVisionModule } from './visionTasks';

type HandState = {
  isBoosting: boolean;
  handDetected: boolean;
  handCentroid: { x: number; y: number } | null;
  isInitializing: boolean;
  initProgress: number;
  initStatus: string;
  isReady: boolean;
  hasError: boolean;
};

type HandLandmark = {
  x: number;
  y: number;
  z: number;
};

type HandFrame = HandLandmark[];

const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const TASKS_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

export const useHandTracker = (
  videoRef?: RefObject<HTMLVideoElement>,
  enabled = true
): HandState => {
  const [isBoosting, setIsBoosting] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [handCentroid, setHandCentroid] = useState<{ x: number; y: number } | null>(null);
  const [initProgress, setInitProgress] = useState(0);
  const [initStatus, setInitStatus] = useState('IDLE');
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isBoostingRef = useRef(false);
  const handDetectedRef = useRef(false);
  const handCentroidRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(true);
  const ownsStreamRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setIsBoosting(false);
      setHandDetected(false);
      setHandCentroid(null);
      handCentroidRef.current = null;
      setInitProgress(0);
      setInitStatus('IDLE');
      setIsReady(false);
      setHasError(false);
      return;
    }

    activeRef.current = true;
    setIsReady(false);
    setHasError(false);
    setInitStatus('INITIALIZING SYSTEMS...');
    setInitProgress(5);

    const setHandState = (nextDetected: boolean) => {
      if (nextDetected !== handDetectedRef.current) {
        handDetectedRef.current = nextDetected;
        setHandDetected(nextDetected);
      }
      if (nextDetected !== isBoostingRef.current) {
        isBoostingRef.current = nextDetected;
        setIsBoosting(nextDetected);
      }
    };

    const setCentroidState = (next: { x: number; y: number } | null) => {
      const prev = handCentroidRef.current;
      const hasPrev = Boolean(prev);
      const hasNext = Boolean(next);

      if (hasPrev !== hasNext) {
        handCentroidRef.current = next;
        setHandCentroid(next);
        return;
      }

      if (!prev || !next) {
        return;
      }

      const delta = Math.abs(prev.x - next.x) + Math.abs(prev.y - next.y);
      if (delta > 0.02) {
        handCentroidRef.current = next;
        setHandCentroid(next);
      }
    };

    const updateInit = (status: string, progress: number) => {
      setInitStatus(status);
      setInitProgress(progress);
    };

    const setup = async () => {
      try {
        updateInit('Loading vision core...', 15);
        const vision = await loadVisionModule();
        const { HandLandmarker } = vision;

        updateInit('Loading vision runtime...', 35);
        const resolver = await getVisionResolver(TASKS_WASM_PATH);
        updateInit('Loading hand model...', 55);
        let landmarker: Awaited<ReturnType<typeof HandLandmarker.createFromOptions>>;
        try {
          landmarker = await HandLandmarker.createFromOptions(resolver, {
            baseOptions: { modelAssetPath: MODEL_ASSET_PATH, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numHands: 1,
          });
        } catch (error) {
          console.warn('GPU delegate unavailable, falling back to CPU.', error);
          landmarker = await HandLandmarker.createFromOptions(resolver, {
            baseOptions: { modelAssetPath: MODEL_ASSET_PATH, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numHands: 1,
          });
        }

        const video = videoRef?.current ?? document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        updateInit('Requesting camera...', 75);
        if (!video.srcObject) {
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 1280, height: 720 },
            audio: false,
          });
          ownsStreamRef.current = true;
          video.srcObject = streamRef.current;
        }

        await video.play();
        updateInit('SYSTEMS ONLINE', 100);
        setIsReady(true);

        const loop = (now: number) => {
          if (!activeRef.current) {
            return;
          }

          if (video.videoWidth <= 0 || video.videoHeight <= 0) {
            rafRef.current = requestAnimationFrame(loop);
            return;
          }

          const results = landmarker.detectForVideo(video, now);
          const hands = (results.landmarks as HandFrame[]) ?? [];
          const hasHand = hands.length > 0;
          setHandState(hasHand);

          if (hasHand) {
            const landmarks = hands[0];
            const centroid = landmarks.reduce(
              (acc, point) => {
                acc.x += point.x;
                acc.y += point.y;
                return acc;
              },
              { x: 0, y: 0 }
            );
            centroid.x /= landmarks.length;
            centroid.y /= landmarks.length;
            setCentroidState(centroid);
          } else {
            setCentroidState(null);
          }
          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (error) {
        console.warn('Failed to initialize hand tracker.', error);
        setHasError(true);
        updateInit('INITIALIZATION FAILED', 0);
        setHandState(false);
      }
    };

    setup();

    return () => {
      activeRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (ownsStreamRef.current) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
      }
      ownsStreamRef.current = false;
    };
  }, [videoRef, enabled]);

  return {
    isBoosting,
    handDetected,
    handCentroid,
    isInitializing: enabled && !isReady && !hasError,
    initProgress,
    initStatus,
    isReady,
    hasError,
  };
};
