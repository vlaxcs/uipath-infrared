import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import iconUrl from "~/assets/infrared-icon.svg";
import { keepAnalysesDecision, pickLayoutDecision } from "~/runs/decisions";
import type { AnalysisOption } from "~/runs/findings";
import { formatEUR, formatPercent, formatRisk } from "~/runs/format";
import type { HumanDecision, LayoutOption, RunEvent } from "~/runs/types";
import type { ArtifactState } from "~/runs/useRunArtifact";
import { feasibleLayouts } from "~/runs/xCandidates";

type LayoutChatProps = {
  options: readonly LayoutOption[];
  analyses: readonly AnalysisOption[];
  analysesStatus: ArtifactState["status"];
  analysesError?: string;
  onRetryAnalyses?: () => void;
  onSubmit: (decision: HumanDecision) => Promise<RunEvent | null>;
  busy: boolean;
  error: string | null;
  onRefresh?: () => void;
  typingMs?: number;
};

const DOT_DELAYS = ["[animation-delay:0ms]", "[animation-delay:150ms]", "[animation-delay:300ms]"];
const SUGGESTION = "best payback that stays in the EU";

/* The layout gate as a conversation: keep analyses, say why, pick a layout, say why. */
export function LayoutChat({
  options,
  analyses,
  analysesStatus,
  analysesError,
  onRetryAnalyses,
  onSubmit,
  busy,
  error,
  onRefresh,
  typingMs = 700,
}: LayoutChatProps) {
  const feasible = feasibleLayouts(options);
  const infeasible = options.filter((option) => !option.feasible);
  const [dropped, setDropped] = useState<ReadonlySet<string>>(() => new Set());
  const [keepAnswer, setKeepAnswer] = useState<readonly string[] | "skip" | null>(null);
  const [keepReason, setKeepReason] = useState<string | null>(null);
  const [kept, setKept] = useState(false);
  const [layout, setLayout] = useState(() => feasible[0]?.id ?? "");
  const [layoutAnswer, setLayoutAnswer] = useState<string | null>(null);
  const [layoutReason, setLayoutReason] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLayout((current) => current || feasible[0]?.id || "");
  }, [feasible]);

  const loading = analysesStatus === "idle" || analysesStatus === "loading";
  const noAnalyses = analysesStatus === "unavailable" || (analysesStatus === "ready" && analyses.length === 0);
  const selected = analyses.map((analysis) => analysis.id).filter((id) => !dropped.has(id));
  const layoutStage = noAnalyses || keepAnswer === "skip" || kept;
  const composer: "keep" | "layout" | null =
    Array.isArray(keepAnswer) && !kept && keepReason === null ? "keep" : layoutAnswer && layoutReason === null ? "layout" : null;

  const toggle = (id: string) =>
    setDropped((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    if (composer === "keep" && Array.isArray(keepAnswer)) {
      setKeepReason(text);
      const appended = await onSubmit(keepAnalysesDecision(keepAnswer, text));
      if (appended) setKept(true);
      else setKeepReason(null);
    } else if (composer === "layout" && layoutAnswer) {
      setLayoutReason(text);
      const appended = await onSubmit(pickLayoutDecision(layoutAnswer, text));
      if (!appended) setLayoutReason(null);
    }
  };

  const onComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const messages: { key: string; from: "bot" | "me"; body: ReactNode }[] = [];
  const bot = (key: string, body: ReactNode) => messages.push({ key, from: "bot", body });
  const me = (key: string, body: ReactNode) => messages.push({ key, from: "me", body });

  if (loading) {
    messages.push({ key: "loading", from: "bot", body: null });
  } else if (analysesStatus === "error") {
    bot(
      "analyses-error",
      <div className="flex flex-col gap-2">
        <p>I couldn't load the analyses: {analysesError ?? "unknown error"}.</p>
        <div className="flex gap-2">
          {onRetryAnalyses ? <ChatButton onClick={onRetryAnalyses}>Retry analyses</ChatButton> : null}
          <ChatButton onClick={() => setKeepAnswer("skip")} disabled={keepAnswer !== null}>
            Skip
          </ChatButton>
        </div>
      </div>,
    );
  } else if (noAnalyses) {
    bot("no-analyses", <p>I have no analyses to keep this time.</p>);
  } else {
    bot(
      "analyses",
      <div className="flex flex-col gap-3">
        <p>
          I found {analyses.length} {analyses.length === 1 ? "problem" : "problems"} in the estate. Which should I keep for the next plans?
        </p>
        <fieldset disabled={keepAnswer !== null} className="flex flex-col gap-2">
          <legend className="sr-only">Analyses to keep</legend>
          {analyses.map((analysis) => (
            <label key={analysis.id} className="flex items-start gap-2 rounded-control bg-surface px-3 py-1.5">
              <input type="checkbox" className="mt-1" checked={!dropped.has(analysis.id)} onChange={() => toggle(analysis.id)} />
              <span>
                <span className="font-medium">{analysis.title}</span>
                {analysis.category ? <span className="block text-caption text-fg-subtle">{analysis.category}</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
        {keepAnswer === null ? (
          <div className="flex gap-2">
            <ChatButton primary disabled={selected.length === 0} onClick={() => setKeepAnswer(selected)}>
              Keep these
            </ChatButton>
            <ChatButton onClick={() => setKeepAnswer("skip")}>Skip</ChatButton>
          </div>
        ) : null}
      </div>,
    );
  }

  if (keepAnswer === "skip") me("skip", "Skip, keep none.");
  if (Array.isArray(keepAnswer)) {
    me("keep", `Keep ${keepAnswer.length} of ${analyses.length}.`);
    bot("keep-why", <p>Why keep them?</p>);
    if (keepReason) me("keep-reason", keepReason);
    if (kept) bot("kept", <p>Noted. I kept {keepAnswer.length === 1 ? "it" : `all ${keepAnswer.length}`} for the next plans.</p>);
  }

  if (layoutStage) {
    if (feasible.length === 0) {
      bot("no-layout", <p>None of the layouts passes the hard constraints. Decide this gate from Slack.</p>);
    } else {
      bot(
        "layout",
        <div className="flex flex-col gap-3">
          <p>Which layout should I rehearse?</p>
          <fieldset disabled={layoutAnswer !== null} className="flex flex-col gap-2">
            <legend className="sr-only">Feasible layouts</legend>
            {feasible.map((option) => (
              <label key={option.id} className="flex items-start gap-2 rounded-control bg-surface px-3 py-2">
                <input type="radio" name="layout" className="mt-1" value={option.id} checked={layout === option.id} onChange={() => setLayout(option.id)} />
                <span>
                  <span className="font-mono">{option.id}</span>
                  <span className="block text-caption text-fg-subtle">
                    rank {option.rank ?? "—"} · {formatEUR(option.monthly_eur)}/mo · {formatPercent(option.availability_pct)} · risk {formatRisk(option.risk)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {infeasible.length > 0 ? <p className="text-caption text-fg-subtle">Ruled out: {infeasible.map((option) => option.id).join(", ")}</p> : null}
          {layoutAnswer === null ? (
            <ChatButton primary disabled={!layout} onClick={() => setLayoutAnswer(layout)}>
              Choose
            </ChatButton>
          ) : null}
        </div>,
      );
    }
  }

  if (layoutAnswer) {
    me("layout-answer", <span className="font-mono">{layoutAnswer}</span>);
    bot("layout-why", <p>Why this one?</p>);
    if (layoutReason) me("layout-reason", layoutReason);
  }

  if (busy) messages.push({ key: "busy", from: "bot", body: null });

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [messages.length]);

  return (
    <section aria-label="Layout decision" className="flex flex-col gap-3 rounded-card border border-border p-4">
      <ol className="flex flex-col gap-3">
        {messages.map((message) =>
          message.from === "me" ? (
            <li key={message.key} className="flex animate-chat-in justify-end">
              <p className="max-w-[80%] rounded-card rounded-br-control bg-accent px-3 py-2 text-label text-on-accent">{message.body}</p>
            </li>
          ) : (
            <BotMessage key={message.key} typingMs={message.body === null ? null : typingMs}>
              {message.body}
            </BotMessage>
          ),
        )}
        {error ? (
          <li role="alert" className="flex animate-chat-in flex-col gap-2 text-label text-status-failed">
            <p>{error}</p>
            {onRefresh ? (
              <ChatButton onClick={onRefresh}>Refresh run</ChatButton>
            ) : null}
          </li>
        ) : null}
      </ol>
      <div ref={end} />

      {composer ? (
        <form onSubmit={send} className="flex animate-chat-in flex-col gap-2">
          {composer === "layout" ? (
            <button
              type="button"
              onClick={() => setDraft(SUGGESTION)}
              className="self-start rounded-full border border-border px-3 py-1 text-caption text-fg-muted hover:bg-surface"
            >
              {SUGGESTION}
            </button>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              aria-label={composer === "keep" ? "Reason for keeping" : "Reason"}
              placeholder="Type your reason…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onComposerKey}
              rows={1}
              autoFocus
              className="min-h-10 flex-1 resize-none rounded-control border border-border bg-surface px-3 py-2 text-label text-fg"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="rounded-control bg-accent px-4 py-2 text-label font-medium text-on-accent disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

/* Shows the typing dots first, then the message; null children keep the dots. */
function BotMessage({ typingMs, children }: { typingMs: number | null; children: ReactNode }) {
  const [shown, setShown] = useState(() => typingMs === 0 || reducedMotion());

  useEffect(() => {
    if (shown || typingMs === null) return;
    const timer = window.setTimeout(() => setShown(true), typingMs);
    return () => window.clearTimeout(timer);
  }, [shown, typingMs]);

  return (
    <li className="flex animate-chat-in items-start gap-2">
      <img src={iconUrl} alt="" className="h-7 w-7 shrink-0" />
      <div className="max-w-[85%] rounded-card rounded-bl-control bg-surface-muted px-3 py-2 text-label text-fg">
        {shown && typingMs !== null ? (
          <div className="animate-chat-in">{children}</div>
        ) : (
          <span role="status" aria-label="Typing" className="flex gap-1 py-1">
            {DOT_DELAYS.map((delay) => (
              <span key={delay} className={`h-1.5 w-1.5 animate-typing rounded-full bg-fg-muted ${delay}`} />
            ))}
          </span>
        )}
      </div>
    </li>
  );
}

function ChatButton({ primary = false, disabled = false, onClick, children }: { primary?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`self-start rounded-control px-3 py-1.5 text-label font-medium disabled:opacity-50 ${primary ? "bg-accent text-on-accent" : "border border-border text-fg hover:bg-surface"}`}
    >
      {children}
    </button>
  );
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
