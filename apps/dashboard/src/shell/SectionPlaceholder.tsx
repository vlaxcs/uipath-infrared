import type { Section } from "~/navigation/sections";
import { StatusBadge } from "~/runs/StatusBadge";

export function SectionPlaceholder({ section }: { section: Section }) {
  return (
    <section className="flex max-w-xl flex-col items-start gap-4">
      <StatusBadge label="Not built yet" tone="neutral" />
      <p className="text-body text-fg-muted">{section.description}</p>
    </section>
  );
}
