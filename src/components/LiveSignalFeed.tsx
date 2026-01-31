import React, { useEffect, useMemo, useRef, useState } from 'react';

type EchoEntry = {
  name: string;
  text: string;
};

type FeedEntry = {
  id: string;
  author: string;
  text: string;
  tone: 'system' | 'operator';
};

const BASE_MESSAGES: FeedEntry[] = [
  { id: 'sys-1', author: 'System', text: 'Global relay online.', tone: 'system' },
  { id: 'op-1', author: 'Operator 73', text: 'Signal locked from Tokyo.', tone: 'operator' },
  { id: 'op-2', author: 'User_K', text: 'Stay strong, Jeti!', tone: 'operator' },
  { id: 'sys-2', author: 'System', text: 'Encryption layer 3 dissolved.', tone: 'system' },
  { id: 'op-3', author: 'Anon', text: 'Watching from Brazil...', tone: 'operator' },
  { id: 'op-4', author: 'Op_99', text: 'We see you.', tone: 'operator' },
  { id: 'op-5', author: 'Xi_Attendee', text: 'Let him out!', tone: 'operator' },
  { id: 'sys-3', author: 'System', text: 'Cross-region handshake stable.', tone: 'system' },
  { id: 'op-6', author: 'Operator 14', text: 'Holding the line in Seoul.', tone: 'operator' },
  { id: 'op-7', author: 'SignalWeaver', text: 'Pulse is clean. Push forward.', tone: 'operator' },
  { id: 'sys-4', author: 'System', text: 'Containment jitter detected.', tone: 'system' },
  { id: 'op-8', author: 'Operator 52', text: 'Routing spare bandwidth.', tone: 'operator' },
  { id: 'op-9', author: 'EchoPilot', text: 'Do not blink. Do not drift.', tone: 'operator' },
  { id: 'op-10', author: 'Observer_N', text: 'Cage pressure rising.', tone: 'operator' },
  { id: 'sys-5', author: 'System', text: 'Firewall patrol pattern mapped.', tone: 'system' },
  { id: 'op-11', author: 'Operator 08', text: 'Anchor set from Nairobi.', tone: 'operator' },
  { id: 'op-12', author: 'NightShift', text: 'Signal from Berlin is steady.', tone: 'operator' },
  { id: 'sys-6', author: 'System', text: 'Telemetry spike. Recalibrating.', tone: 'system' },
  { id: 'op-13', author: 'Op_Luna', text: 'JETI, we are with you.', tone: 'operator' },
  { id: 'op-14', author: 'Operator 31', text: 'Lead the target. Time the gap.', tone: 'operator' },
  { id: 'op-15', author: 'KiteRunner', text: 'Signal stitched from Mumbai.', tone: 'operator' },
  { id: 'sys-7', author: 'System', text: 'Collective gaze alignment: rising.', tone: 'system' },
  { id: 'op-16', author: 'Op_Artemis', text: 'We are past the midpoint.', tone: 'operator' },
  { id: 'op-17', author: 'Riftwatch', text: 'Firewall window opening soon.', tone: 'operator' },
  { id: 'sys-8', author: 'System', text: 'Liberation probability: increasing.', tone: 'system' },
];

const VISIBLE_COUNT = 6;

const toFeedEntry = (entry: EchoEntry, index: number): FeedEntry => ({
  id: `user-${index}-${entry.name}`,
  author: entry.name,
  text: entry.text,
  tone: 'operator',
});

export const LiveSignalFeed: React.FC<{ echoes?: EchoEntry[] }> = ({ echoes = [] }) => {
  const mergedPool = useMemo(() => {
    const userEntries = echoes
      .filter((entry) => entry.text.trim())
      .map((entry, index) => toFeedEntry(entry, index));
    return [...userEntries, ...BASE_MESSAGES];
  }, [echoes]);

  const [feed, setFeed] = useState<FeedEntry[]>(() => mergedPool.slice(0, VISIBLE_COUNT));
  const poolIndexRef = useRef(feed.length);
  const timerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFeed(mergedPool.slice(0, VISIBLE_COUNT));
    poolIndexRef.current = Math.min(mergedPool.length, VISIBLE_COUNT);
  }, [mergedPool]);

  useEffect(() => {
    const tick = () => {
      setFeed((prev) => {
        if (!mergedPool.length) {
          return prev;
        }
        const nextIndex = poolIndexRef.current % mergedPool.length;
        poolIndexRef.current += 1;
        const next = mergedPool[nextIndex];
        const updated = [...prev, { ...next, id: `${next.id}-${Date.now()}` }];
        return updated.slice(-36);
      });

      const delay = 1500 + Math.random() * 1500;
      timerRef.current = window.setTimeout(tick, delay);
    };

    const initialDelay = 900;
    timerRef.current = window.setTimeout(tick, initialDelay);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [mergedPool]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [feed]);

  const visibleFeed = feed.slice(-VISIBLE_COUNT);

  return (
    <div className="mx-auto mt-8 w-full max-w-2xl rounded-lg border border-yellow-400/30 bg-black/70 p-4 shadow-[0_0_24px_rgba(250,204,21,0.12)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.45em] text-yellow-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          Live Global Echoes
        </div>
        <div className="text-[10px] uppercase tracking-[0.4em] text-yellow-200/60">Streaming</div>
      </div>

      <div
        ref={listRef}
        className="h-52 overflow-y-auto rounded-md border border-yellow-400/20 bg-black/60 px-3 py-2 text-left font-mono text-sm leading-relaxed text-yellow-100/85"
      >
        {visibleFeed.map((entry) => (
          <div key={entry.id} className="py-1">
            <span className={entry.tone === 'system' ? 'text-yellow-300' : 'text-yellow-100'}>
              {entry.author}
            </span>
            <span className="text-yellow-200/70">: </span>
            <span className="text-yellow-100/90">{entry.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

