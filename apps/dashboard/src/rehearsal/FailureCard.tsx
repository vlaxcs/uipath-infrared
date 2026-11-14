import type { FailureView } from "~/rehearsal/model";
import { Card, Field } from "~/rehearsal/parts";
import { StatusBadge } from "~/ui/StatusBadge";

export function FailureCard({ failure }: { failure: FailureView }) {
  return (
    <Card
      id="failure"
      title="Failure injected"
      aside={
        <StatusBadge
          label={failure.injected ? failure.type : "No failure"}
          tone={failure.injected ? "awaiting" : "neutral"}
        />
      }
    >
      {!failure.injected ? (
        <p className="text-body text-fg-muted">
          No failure was injected in this rehearsal, so the fallback was not exercised.
        </p>
      ) : (
        <>
          <p className="text-body">{failure.headline}</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Target">
              <span className="font-mono">{failure.target}</span>
            </Field>
            <Field label="Injected at">{failure.injectedAt}</Field>
            <Field label="Duration">{failure.duration}</Field>
          </dl>
          {failure.detail ? (
            <details className="rounded-control border border-border p-3">
              <summary className="cursor-pointer text-label font-medium">Injection detail</summary>
              <p className="mt-2 break-words text-body text-fg-muted">{failure.detail}</p>
            </details>
          ) : null}
        </>
      )}
    </Card>
  );
}
