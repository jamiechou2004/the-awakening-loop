import React from 'react';

type CRTOverlayProps = {
  active?: boolean;
  intensity?: number;
  className?: string;
};

export const CRTOverlay: React.FC<CRTOverlayProps> = ({
  active = true,
  intensity = 0.6,
  className,
}) => {
  const scanlineOpacity = active ? 0.18 + intensity * 0.18 : 0.08;
  const noiseOpacity = active ? 0.1 + intensity * 0.2 : 0.04;

  return (
    <div className={`pointer-events-none absolute inset-0 z-40 ${className ?? ''}`}>
      <div className="crt-scanlines absolute inset-0" style={{ opacity: scanlineOpacity }} />
      <div className="crt-noise absolute inset-0 crt-flicker" style={{ opacity: noiseOpacity }} />
      <div className="crt-vignette absolute inset-0" />
    </div>
  );
};
