import { useId } from "react";
import type { RepoSelection } from "~/domain/types";

export interface RepoDraft {
  kind: RepoSelection["kind"];
  repos: string[];
}

export function draftFrom(selection: RepoSelection): RepoDraft {
  return selection.kind === "all" ? { kind: "all", repos: [] } : { kind: "selected", repos: [...selection.repos] };
}

export function selectionFrom(draft: RepoDraft): RepoSelection {
  return draft.kind === "all" ? { kind: "all" } : { kind: "selected", repos: draft.repos };
}

export function isDraftValid(draft: RepoDraft): boolean {
  return draft.kind === "all" || draft.repos.length > 0;
}

export function RepoPicker({ repos, value, onChange }: { repos: string[]; value: RepoDraft; onChange(next: RepoDraft): void }) {
  const name = useId();

  function toggle(repo: string, checked: boolean) {
    const next = checked ? repos.filter((r) => r === repo || value.repos.includes(r)) : value.repos.filter((r) => r !== repo);
    onChange({ kind: "selected", repos: next });
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="type-label mb-2">Repository access</legend>
      <label className="flex items-start gap-3 rounded-item border border-line px-3 py-2.5">
        <input
          type="radio"
          name={name}
          className="mt-1 accent-accent"
          checked={value.kind === "all"}
          onChange={() => onChange({ kind: "all", repos: [] })}
        />
        <span className="min-w-0">
          <span className="type-label block">All repositories</span>
          <span className="type-small text-fg-muted">Includes repositories created later.</span>
        </span>
      </label>
      <label className="flex items-start gap-3 rounded-item border border-line px-3 py-2.5">
        <input
          type="radio"
          name={name}
          className="mt-1 accent-accent"
          checked={value.kind === "selected"}
          onChange={() => onChange({ kind: "selected", repos: value.repos })}
        />
        <span className="min-w-0">
          <span className="type-label block">Only select repositories</span>
          <span className="type-small text-fg-muted">Infrared sees only the repositories you tick.</span>
        </span>
      </label>
      {value.kind === "selected" && (
        <ul className="ml-2 flex flex-col gap-1 border-l border-line pl-4" aria-label="Repositories">
          {repos.map((repo) => (
            <li key={repo}>
              <label className="flex min-h-9 items-center gap-3">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={value.repos.includes(repo)}
                  onChange={(event) => toggle(repo, event.target.checked)}
                />
                <span className="type-code min-w-0 break-all">{repo}</span>
              </label>
            </li>
          ))}
          {value.repos.length === 0 && <li className="type-small text-danger-ink">Tick at least one repository.</li>}
        </ul>
      )}
    </fieldset>
  );
}
