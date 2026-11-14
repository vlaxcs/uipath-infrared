import type { GithubPermission } from "~/domain/types";
import { Badge } from "~/ui/Badge";

export function PermissionList({ permissions }: { permissions: GithubPermission[] }) {
  return (
    <ul className="divide-y divide-line rounded-well border border-line" aria-label="Permissions">
      {permissions.map((permission) => (
        <li key={permission.scope} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5">
          <div className="min-w-0">
            <p className="type-body">{permission.reason}</p>
            <code className="type-code text-fg-muted">{permission.scope}</code>
          </div>
          <Badge tone={permission.access === "write" ? "warn" : "info"}>{permission.access === "write" ? "Write" : "Read"}</Badge>
        </li>
      ))}
    </ul>
  );
}
