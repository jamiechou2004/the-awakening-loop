import React, { useEffect, useState } from 'react';

const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%';

const scramble = (text: string) =>
  text
    .split('')
    .map((char) => {
      if (char === ' ') {
        return ' ';
      }
      const idx = Math.floor(Math.random() * GLITCH_CHARS.length);
      return GLITCH_CHARS[idx];
    })
    .join('');

type GlitchTextProps = {
  text: string;
  active?: boolean;
  intensity?: number;
  className?: string;
};

export const GlitchText: React.FC<GlitchTextProps> = ({
  text,
  active = false,
  intensity = 0.6,
  className,
}) => {
  const [output, setOutput] = useState(text);

  useEffect(() => {
    if (!active) {
      setOutput(text);
      return;
    }

    const intervalMs = Math.max(45, 140 - intensity * 90);
    const interval = window.setInterval(() => {
      setOutput(scramble(text));
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [active, intensity, text]);

  return <span className={className}>{output}</span>;
};
