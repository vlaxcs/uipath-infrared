import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { CreditMark } from "~/credits/CreditMarks";
import { ExtensionInstallGuide } from "~/home/ExtensionInstallGuide";

type HomePageProps = {
  extensionUrl: string | null;
  onAnalyze: () => void;
  onPrevious: () => void;
};

const PILL = "flex items-center gap-2 rounded-pill px-5 py-3 text-label font-semibold shadow-sm";

export function HomePage({ extensionUrl, onAnalyze, onPrevious }: HomePageProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const guideButton = useRef<HTMLButtonElement>(null);

  function closeGuide() {
    setGuideOpen(false);
    guideButton.current?.focus();
  }

  return (
    <div>
      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 p-4">
        <nav aria-label="Analyses" className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onAnalyze} aria-label="Analyze, costs 1 run" className={`${PILL} bg-credit text-on-credit`}>
            Analyze
            <span className="flex items-center gap-1 rounded-pill bg-on-credit px-2 py-0.5 text-caption font-semibold text-credit" aria-hidden="true">
              <CreditMark className="h-4 w-4 text-credit" />
              <span>1x</span>
            </span>
          </button>
          <button type="button" onClick={onPrevious} className={`${PILL} border border-border bg-surface text-fg hover:bg-surface-muted`}>
            Previous analysis
          </button>
        </nav>
        {extensionUrl ? (
          <a
            href={extensionUrl}
            target="_blank"
            rel="noreferrer"
            className={`${PILL} border border-border bg-surface text-fg hover:bg-surface-muted`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Browser extension
          </a>
        ) : (
          <button
            ref={guideButton}
            type="button"
            onClick={() => setGuideOpen(true)}
            aria-haspopup="dialog"
            className={`${PILL} border border-dashed border-border-strong bg-surface text-fg hover:bg-surface-muted`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Browser extension
          </button>
        )}
      </div>
      {guideOpen && <ExtensionInstallGuide onClose={closeGuide} />}
    </div>
  );
}
