import React from 'react';

type FinalInputProps = {
  userName: string;
  message: string;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
};

export const FinalInput: React.FC<FinalInputProps> = ({
  userName,
  message,
  onMessageChange,
  onSubmit,
}) => {
  const displayName = userName.trim() || 'Operator';
  const canSubmit = message.trim().length > 0;

  return (
    <div className="relative flex h-full w-full items-center justify-center px-6 py-10">
      <div className="absolute inset-0 bg-black/75" />
      <form
        className="relative z-10 flex w-full max-w-2xl flex-col gap-5 rounded-sm border border-emerald-400/30 bg-black/70 p-8 font-mono shadow-[0_0_40px_rgba(16,185,129,0.12)] backdrop-blur-md"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) {
            onSubmit();
          }
        }}
      >
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-emerald-300/80">
            Transmission Link Established
          </p>
          <p className="text-sm uppercase tracking-[0.35em] text-white/70">
            Jeti is listening. Leave your final log entry.
          </p>
          <p className="text-[11px] uppercase tracking-[0.45em] text-emerald-200/70">
            Operator: {displayName}
          </p>
        </div>

        <textarea
          className="min-h-[140px] w-full resize-none rounded-sm border border-emerald-400/40 bg-transparent px-4 py-3 text-sm leading-relaxed text-emerald-100 outline-none shadow-[0_0_25px_rgba(16,185,129,0.08)] focus:border-emerald-300 focus:shadow-[0_0_35px_rgba(16,185,129,0.18)]"
          placeholder=">> FINAL LOG ENTRY..."
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-sm border border-emerald-300/50 bg-emerald-400/10 px-6 py-3 text-xs font-bold uppercase tracking-[0.45em] text-emerald-200 transition hover:border-emerald-200 hover:bg-emerald-300/15 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Upload Message
        </button>
      </form>
    </div>
  );
};

