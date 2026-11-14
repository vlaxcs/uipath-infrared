import { formatDate, formatDateTime } from "~/app/format";
import { useAction } from "~/app/settings-context";
import { formatAccountId, parseRoleArn } from "~/domain/cloud-rules";
import type { CloudConnection, CloudConnectionStatus } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import { Badge, type Tone } from "~/ui/Badge";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { Notice } from "~/ui/Notice";
import { RegionChips } from "~/features/cloud/RegionChips";
import { useVerifyConnection } from "~/features/cloud/use-cloud-actions";

const STATUS: Record<CloudConnectionStatus, { label: string; tone: Tone }> = {
  connected: { label: "Connected", tone: "success" },
  pending: { label: "Pending", tone: "info" },
  verifying: { label: "Verifying", tone: "accent" },
  failed: { label: "Failed", tone: "danger" },
  revoked: { label: "Revoked", tone: "neutral" },
};

const removeFn = (api: SettingsApi, id: string) => api.removeCloudConnection(id);

export function connectionTitle(connection: CloudConnection): string {
  const accountId = connection.accountId ?? (connection.roleArn ? parseRoleArn(connection.roleArn)?.accountId : null);
  return accountId ? `AWS account ${formatAccountId(accountId)}` : "New AWS connection";
}

export interface ConnectionCardProps {
  connection: CloudConnection;
  onContinue(): void;
  onEditRegions(): void;
  onRotate(): void;
  onRevoke(): void;
}

export function ConnectionCard({ connection, onContinue, onEditRegions, onRotate, onRevoke }: ConnectionCardProps) {
  const verify = useVerifyConnection();
  const remove = useAction(removeFn);
  const status = STATUS[connection.status];
  const title = connectionTitle(connection);
  const error = verify.error ?? remove.error;

  return (
    <article aria-label={title}>
      <Card title={title} actions={<Badge tone={status.tone}>{status.label}</Badge>}>
        <dl className="type-small grid gap-x-6 gap-y-3 sm:grid-cols-[8rem_1fr]">
          <dt className="text-fg-muted">Role ARN</dt>
          <dd className="min-w-0">
            {connection.roleArn ? (
              <code className="type-code break-all text-fg">{connection.roleArn}</code>
            ) : (
              <span className="text-fg-muted">Not added yet</span>
            )}
          </dd>
          <dt className="text-fg-muted">External ID</dt>
          <dd>
            <code className="type-code text-fg">{connection.externalId}</code>
          </dd>
          <dt className="text-fg-muted">Regions</dt>
          <dd>
            <RegionChips regions={connection.regions} />
          </dd>
          <dt className="text-fg-muted">Last verified</dt>
          <dd>
            {connection.lastVerifiedAt ? formatDateTime(connection.lastVerifiedAt) : "Never"}
            <span className="text-fg-muted"> · added {formatDate(connection.createdAt)}</span>
          </dd>
        </dl>

        <div className="mt-4 flex flex-col gap-3">
          {connection.status === "failed" && connection.error && <Notice tone="danger">{connection.error}</Notice>}
          {connection.status === "pending" && (
            <Notice tone="info">Waiting for the role. Finish the setup in AWS, then verify the role ARN.</Notice>
          )}
          {connection.status === "revoked" && (
            <p className="type-small text-fg-muted">Infrared no longer reads this account. Remove it to clear it from the list.</p>
          )}
          {error && connection.status !== "failed" && <Notice tone="danger">{error}</Notice>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {connection.status === "connected" && (
            <>
              <Button pending={verify.pending} onClick={() => verify.run(connection.id, connection.roleArn ?? "")}>
                Re-verify
              </Button>
              <Button onClick={onEditRegions}>Edit regions</Button>
              <Button onClick={onRotate}>Rotate external ID</Button>
              <Button variant="ghost" onClick={onRevoke}>
                Revoke
              </Button>
            </>
          )}
          {(connection.status === "pending" || connection.status === "failed") && (
            <>
              <Button variant="primary" onClick={onContinue}>
                Continue setup
              </Button>
              <Button variant="ghost" pending={remove.pending} onClick={() => remove.run(connection.id)}>
                Remove
              </Button>
            </>
          )}
          {connection.status === "revoked" && (
            <Button pending={remove.pending} onClick={() => remove.run(connection.id)}>
              Remove
            </Button>
          )}
        </div>
      </Card>
    </article>
  );
}
