import { useState } from "react";

export function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="type-label">{label}</span>
        <button type="button" onClick={copy} className="type-small font-semibold text-accent-ink hover:underline" aria-label={`Copy ${label}`}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {multiline ? (
        <pre className="type-code max-h-48 overflow-auto rounded-item border border-line bg-sunken p-3 text-fg">{value}</pre>
      ) : (
        <code className="type-code block overflow-x-auto rounded-item border border-line bg-sunken px-3 py-2 text-fg">{value}</code>
      )}
    </div>
  );
}
