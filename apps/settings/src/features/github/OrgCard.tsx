import { useState } from "react";
import { formatDate } from "~/app/format";
import { repoAccessSummary } from "~/domain/github-rules";
import type { GithubInstallation } from "~/domain/types";
import { Badge } from "~/ui/Badge";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { RepoAccessDialog } from "~/features/github/RepoAccessDialog";

export function OrgCard({ installation }: { installation: GithubInstallation }) {
  const [editing, setEditing] = useState(false);
  const connected = installation.status === "connected";

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="break-all">{installation.org}</span>
          {connected ? <Badge tone="success">Connected</Badge> : <Badge tone="warn">Suspended</Badge>}
        </span>
      }
      description="GitHub organisation"
      actions={
        connected && (
          <Button onClick={() => setEditing(true)} aria-label="Change repository access">
            Change
          </Button>
        )
      }
    >
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="type-small text-fg-muted">Installation ID</dt>
          <dd className="type-code">{installation.installationId}</dd>
        </div>
        <div className="min-w-0">
          <dt className="type-small text-fg-muted">Installed</dt>
          <dd className="type-body">{installation.installedAt ? formatDate(installation.installedAt) : "Unknown"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="type-small text-fg-muted">Repository access</dt>
          <dd className="type-body">{repoAccessSummary(installation)}</dd>
        </div>
      </dl>
      {installation.repoSelection.kind === "selected" && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Selected repositories">
          {installation.repoSelection.repos.map((repo) => (
            <li key={repo} className="type-code rounded-item border border-line bg-sunken px-2 py-0.5 break-all">
              {repo}
            </li>
          ))}
        </ul>
      )}
      {editing && <RepoAccessDialog installation={installation} onClose={() => setEditing(false)} />}
    </Card>
  );
}
