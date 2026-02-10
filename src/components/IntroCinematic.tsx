import React, { useCallback, useEffect, useRef, useState } from 'react';

type IntroCinematicProps = {
  onComplete: () => void;
  src?: string;
};

const DEFAULT_SRC = '/Cinematic_Intro_MechaGlitch.mp4';

export const IntroCinematic: React.FC<IntroCinematicProps> = ({
  onComplete,
  src = DEFAULT_SRC,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  const attemptPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    try {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.then === 'function') {
        await playPromise;
      }
      setNeedsInteraction(false);
    } catch (error) {
      setNeedsInteraction(true);
    }
  }, []);

  useEffect(() => {
    attemptPlay();
  }, [attemptPlay]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-cover pointer-events-none"
        src={src}
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        onEnded={onComplete}
      />
      {needsInteraction && (
        <button
          type="button"
          className="absolute inset-0 flex h-full w-full items-center justify-center bg-black text-sm uppercase tracking-[0.35em] text-white sm:text-base"
          onClick={attemptPlay}
          aria-label="Click to start intro"
        >
          Click to Start
        </button>
      )}
    </div>
  );
};
