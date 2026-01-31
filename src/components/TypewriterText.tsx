import React, { useEffect, useState } from 'react';

type TypewriterTextProps = {
  text: string;
  speedMs?: number;
  cursor?: boolean;
  resetKey?: string | number;
  className?: string;
};

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  speedMs = 24,
  cursor = true,
  resetKey,
  className,
}) => {
  const [visibleText, setVisibleText] = useState('');

  useEffect(() => {
    if (resetKey !== undefined) {
      setVisibleText('');
    }
  }, [resetKey]);

  useEffect(() => {
    if (!text.startsWith(visibleText)) {
      setVisibleText('');
    }
  }, [text, visibleText]);

  useEffect(() => {
    if (visibleText.length >= text.length) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setVisibleText(text.slice(0, visibleText.length + 1));
    }, speedMs);

    return () => window.clearTimeout(timeout);
  }, [text, visibleText, speedMs]);

  const showCursor = cursor && visibleText.length < text.length;

  return (
    <span className={className}>
      {visibleText}
      {showCursor && <span className="type-cursor">|</span>}
    </span>
  );
};
