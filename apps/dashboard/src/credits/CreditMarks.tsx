const SHOWN_ONE_BY_ONE = 10;

export function CreditMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`${className} text-credit`} aria-hidden="true" data-credit-mark>
      <path d="M8 1a7 7 0 0 0 0 14Z" fill="currentColor" />
    </svg>
  );
}

export function CreditMarks({ credits }: { credits: number }) {
  const label = credits === 0 ? "No runs left" : `${credits} ${credits === 1 ? "run" : "runs"} left`;
  const marks = credits > SHOWN_ONE_BY_ONE ? 1 : credits;
  return (
    <span role="img" aria-label={label} className="inline-flex items-center gap-0.5">
      {Array.from({ length: marks }, (_, index) => (
        <CreditMark key={index} />
      ))}
      {credits > SHOWN_ONE_BY_ONE ? <span className="ml-1 text-label font-medium tabular-nums">{credits}</span> : null}
    </span>
  );
}
