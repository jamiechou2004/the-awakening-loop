import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { getVisionResolver, loadVisionModule } from './visionTasks';

type GazeState = {
  isLooking: boolean;
  faceDetected: boolean;
  faceBox: FaceBox;
  isCameraActive: boolean;
  isInitializing: boolean;
  initProgress: number;
  initStatus: string;
  isReady: boolean;
  hasError: boolean;
};

type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const TASKS_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

const LOOK_CENTER_X_TOL = 0.12;
const LOOK_CENTER_Y_TOL = 0.18;

export const useGazeTracker = (
  videoRef?: RefObject<HTMLVideoElement>,
  enabled = true
): GazeState => {
  const [isLooking, setIsLooking] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceBox, setFaceBox] = useState<FaceBox>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [initStatus, setInitStatus] = useState('IDLE');
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isLookingRef = useRef(false);
  const faceDetectedRef = useRef(false);
  const faceBoxRef = useRef<FaceBox>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(true);
  const ownsStreamRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setIsLooking(false);
      setFaceDetected(false);
      setFaceBox(null);
      setIsCameraActive(false);
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

    const setGazeState = (nextFaceDetected: boolean, nextIsLooking: boolean) => {
      if (nextFaceDetected !== faceDetectedRef.current) {
        faceDetectedRef.current = nextFaceDetected;
        setFaceDetected(nextFaceDetected);
      }
      if (nextIsLooking !== isLookingRef.current) {
        isLookingRef.current = nextIsLooking;
        setIsLooking(nextIsLooking);
      }
    };

    const setFaceBoxState = (next: FaceBox) => {
      const prev = faceBoxRef.current;
      const hasPrev = Boolean(prev);
      const hasNext = Boolean(next);

      if (hasPrev !== hasNext) {
        faceBoxRef.current = next;
        setFaceBox(next);
        return;
      }

      if (!prev || !next) {
        return;
      }

      const delta =
        Math.abs(prev.x - next.x) +
        Math.abs(prev.y - next.y) +
        Math.abs(prev.width - next.width) +
        Math.abs(prev.height - next.height);

      if (delta > 0.02) {
        faceBoxRef.current = next;
        setFaceBox(next);
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
        const { FaceLandmarker } = vision;

        updateInit('Loading vision runtime...', 35);
        const resolver = await getVisionResolver(TASKS_WASM_PATH);
        updateInit('Loading face model...', 55);
        const landmarker = await FaceLandmarker.createFromOptions(resolver, {
          baseOptions: { modelAssetPath: MODEL_ASSET_PATH },
          runningMode: 'VIDEO',
          numFaces: 1,
        });

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
        setIsCameraActive(true);
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
          const landmarks = results.faceLandmarks?.[0];
          const hasFace = Boolean(landmarks && landmarks.length);

          let looking = false;
          let nextFaceBox: FaceBox = null;
          if (hasFace) {
            const anchor = landmarks[1] ?? landmarks[0];
            const dx = Math.abs(anchor.x - 0.5);
            const dy = Math.abs(anchor.y - 0.5);
            looking = dx < LOOK_CENTER_X_TOL && dy < LOOK_CENTER_Y_TOL;

            let minX = 1;
            let minY = 1;
            let maxX = 0;
            let maxY = 0;
            landmarks.forEach((point) => {
              minX = Math.min(minX, point.x);
              minY = Math.min(minY, point.y);
              maxX = Math.max(maxX, point.x);
              maxY = Math.max(maxY, point.y);
            });

            nextFaceBox = {
              x: Math.max(0, minX),
              y: Math.max(0, minY),
              width: Math.min(1, maxX) - Math.max(0, minX),
              height: Math.min(1, maxY) - Math.max(0, minY),
            };
          }

          setGazeState(hasFace, hasFace && looking);
          setFaceBoxState(nextFaceBox);
          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (error) {
        console.warn('Failed to initialize gaze tracker.', error);
        setHasError(true);
        updateInit('INITIALIZATION FAILED', 0);
        setGazeState(false, false);
        setFaceBoxState(null);
        setIsCameraActive(false);
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
      setIsCameraActive(false);
    };
  }, [videoRef, enabled]);

  return {
    isLooking,
    faceDetected,
    faceBox,
    isCameraActive,
    isInitializing: enabled && !isReady && !hasError,
    initProgress,
    initStatus,
    isReady,
    hasError,
  };
};
