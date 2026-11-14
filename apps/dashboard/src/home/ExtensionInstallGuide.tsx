import { useEffect, useRef, useState } from "react";

const EXTENSIONS_ADDRESS = "chrome://extensions";

type CopyState = "idle" | "copied" | "failed";

const COPY_LABELS: Record<CopyState, string> = { idle: "Copy", copied: "Copied", failed: "Copy failed" };

const CODE = "rounded-control bg-surface-muted px-1.5 py-0.5 font-mono text-caption text-fg";

export function ExtensionInstallGuide({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copy, setCopy] = useState<CopyState>("idle");

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(EXTENSIONS_ADDRESS);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="extension-guide-title"
      onClose={onClose}
      className="m-auto w-full max-w-lg rounded-card border border-border bg-surface p-6 text-fg shadow-sm backdrop:bg-fg/40"
    >
      <h2 id="extension-guide-title" className="text-title font-semibold">
        Install the Infrared extension
      </h2>
      <p className="mt-1 text-label text-fg-muted">It is not in the Chrome Web Store yet. Load it from the repository.</p>
      <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-body">
        <li>
          Build it: in the repository, run <code className={CODE}>cd apps/chrome-extension</code>, <code className={CODE}>npm install</code>{" "}
          and <code className={CODE}>npm run build</code>.
        </li>
        <li>
          Open <code className={`${CODE} select-all`}>{EXTENSIONS_ADDRESS}</code>{" "}
          <button
            type="button"
            onClick={copyAddress}
            aria-label={`Copy ${EXTENSIONS_ADDRESS}`}
            className="rounded-control border border-border px-2 py-0.5 text-caption font-semibold hover:bg-surface-muted"
          >
            {COPY_LABELS[copy]}
          </button>{" "}
          in a new tab and turn on <strong>Developer mode</strong>.
        </li>
        <li>
          Choose <strong>Load unpacked</strong> and select <code className={CODE}>apps/chrome-extension/dist</code>.
        </li>
        <li>Open any page on github.com. The Infrared card appears on it.</li>
        <li>
          For a hosted orchestrator, open the extension's <strong>Settings</strong> and enter its <code className={CODE}>https://</code> URL.
        </li>
      </ol>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          className="rounded-pill border border-border bg-surface px-4 py-2 text-label font-semibold hover:bg-surface-muted"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
