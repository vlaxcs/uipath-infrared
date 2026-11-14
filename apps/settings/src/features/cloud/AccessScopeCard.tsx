import { Card } from "~/ui/Card";

const READS = [
  "Resource inventory: EC2, RDS, ElastiCache, EKS, Lambda and the list of S3 buckets",
  "CloudWatch utilisation metrics",
  "Cost and usage data, and public AWS pricing",
];

const NEVER = [
  "Create, change or delete any resource",
  "Read data inside S3 objects or databases",
  "Hold long-lived keys: access is a role you can revoke at any time",
];

function List({ heading, items, mark, tone }: { heading: string; items: string[]; mark: string; tone: string }) {
  return (
    <div>
      <h3 className="type-eyebrow mb-2 text-fg-muted">{heading}</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="type-body flex gap-2">
            <span aria-hidden className={`font-semibold ${tone}`}>
              {mark}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AccessScopeCard() {
  return (
    <Card
      title="What Infrared can access"
      description="Access is read-only. Infrared proposes changes; your own CI applies the ones you approve."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <List heading="Infrared reads" items={READS} mark="✓" tone="text-success" />
        <List heading="Infrared never" items={NEVER} mark="✕" tone="text-danger-ink" />
      </div>
    </Card>
  );
}
