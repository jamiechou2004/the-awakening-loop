import React from 'react';

type ChromaticAberrationProps = {
  active?: boolean;
  intensity?: number;
  className?: string;
  children: React.ReactNode;
};

export const ChromaticAberration: React.FC<ChromaticAberrationProps> = ({
  active = false,
  intensity = 1,
  className,
  children,
}) => {
  const shift = active ? Math.max(0.4, intensity * 2) : 0;
  const filter = active
    ? `drop-shadow(${shift}px 0 rgba(18, 240, 255, 0.35)) drop-shadow(${-shift}px 0 rgba(255, 64, 128, 0.35))`
    : 'none';

  return (
    <div className={className} style={{ filter, transition: 'filter 220ms ease' }}>
      {children}
    </div>
  );
};
