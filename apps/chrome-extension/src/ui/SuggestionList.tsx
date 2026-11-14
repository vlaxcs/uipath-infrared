import { formatHours } from "~/domain/format";
import type { RunnerSuggestion } from "~/domain/types";

export function SuggestionList({
  suggestions,
  note,
}: {
  suggestions: RunnerSuggestion[];
  note?: string;
}) {
  if (suggestions.length === 0) {
    return <p className="ir-muted ir-small">{note ?? "No runner suggestions."}</p>;
  }

  return (
    <ul className="ir-suggestions">
      {suggestions.map((suggestion) => (
        <li key={suggestion.id} className="ir-suggestion">
          <p className="ir-suggestion-title">{suggestion.title}</p>
          <p className="ir-muted ir-small">{suggestion.detail}</p>
          <p className="ir-chips">
            <span className="ir-chip">{formatHours(suggestion.hours)}</span>
            {suggestion.workflows !== null ? (
              <span className="ir-chip">{suggestion.workflows} workflows</span>
            ) : null}
            <span className="ir-chip ir-mono">{suggestion.runnerType}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
