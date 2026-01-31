import type { WasmFileset } from '@mediapipe/tasks-vision';

let visionPromise: Promise<typeof import('@mediapipe/tasks-vision')> | null = null;
let resolverPromise: Promise<WasmFileset> | null = null;

export const loadVisionModule = () => {
  if (!visionPromise) {
    visionPromise = import('@mediapipe/tasks-vision');
  }
  return visionPromise;
};

export const getVisionResolver = async (wasmPath: string): Promise<WasmFileset> => {
  if (!resolverPromise) {
    const vision = await loadVisionModule();
    resolverPromise = vision.FilesetResolver.forVisionTasks(wasmPath);
  }
  return resolverPromise;
};
