export function CreditMark({ className = "h-4 w-4 text-credit" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" data-credit-mark>
      <path d="M8 8 2.27 3.99A7 7 0 1 1 2.27 12.01Z" fill="currentColor" />
    </svg>
  );
}

export function CreditMarks({ credits }: { credits: number }) {
  const label = credits === 0 ? "No runs left" : `${credits} ${credits === 1 ? "run" : "runs"} left`;
  return (
    <span role="img" aria-label={label} className="inline-flex items-center gap-1">
      <CreditMark />
      <span className="text-label font-semibold tabular-nums">{credits}x</span>
    </span>
  );
}
