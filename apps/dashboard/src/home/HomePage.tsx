import { Plus } from "lucide-react";
import { CreditMark } from "~/credits/CreditMarks";
import { Mascot } from "~/mascot/Mascot";

type HomePageProps = {
  extensionUrl: string | null;
  onAnalyze: () => void;
  onPrevious: () => void;
};

const PILL = "flex items-center gap-2 rounded-pill px-5 py-3 text-label font-semibold shadow-sm";

export function HomePage({ extensionUrl, onAnalyze, onPrevious }: HomePageProps) {
  return (
    <div className="flex min-h-[calc(100dvh-7.5rem)] items-center justify-center">
      <Mascot animation="hood" className="h-48 w-48" />
      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 p-4">
        <nav aria-label="Analyses" className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onAnalyze} className={`${PILL} bg-credit text-on-credit`}>
            <CreditMark className="h-5 w-5 text-on-credit" />
            Analyze
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
            type="button"
            disabled
            title="Not published yet"
            className={`${PILL} border border-dashed border-border-strong bg-surface text-fg-muted`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Browser extension
          </button>
        )}
      </div>
    </div>
  );
}
