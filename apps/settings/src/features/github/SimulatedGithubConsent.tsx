import { useState } from "react";
import { GITHUB_PERMISSIONS } from "~/domain/github-rules";
import type { GithubInstallBegin, RepoSelection } from "~/domain/types";
import { Button } from "~/ui/Button";
import { Dialog } from "~/ui/Dialog";
import { Notice } from "~/ui/Notice";
import { PermissionList } from "~/features/github/PermissionList";
import { isDraftValid, RepoPicker, selectionFrom, type RepoDraft } from "~/features/github/RepoPicker";

export interface SimulatedGithubConsentProps {
  begin: GithubInstallBegin;
  pending: boolean;
  error: string | null;
  onInstall(selection: RepoSelection): void;
  onCancel(): void;
}

export function SimulatedGithubConsent({ begin, pending, error, onInstall, onCancel }: SimulatedGithubConsentProps) {
  const [draft, setDraft] = useState<RepoDraft>({ kind: "all", repos: [] });

  return (
    <Dialog
      open
      title="Simulated GitHub authorization"
      description="A stand-in for the GitHub App install screen. Nothing is sent to GitHub."
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" pending={pending} disabled={!isDraftValid(draft)} onClick={() => onInstall(selectionFrom(draft))}>
            Install &amp; authorize
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="type-eyebrow text-fg-muted">Install Infrared on</span>
          <span className="type-heading break-all">{begin.org}</span>
          <code className="type-code break-all text-fg-muted">{begin.installUrl}</code>
        </div>
        <RepoPicker repos={begin.repos} value={draft} onChange={setDraft} />
        <div className="flex flex-col gap-2">
          <h3 className="type-label">Infrared will be able to</h3>
          <PermissionList permissions={GITHUB_PERMISSIONS} />
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Dialog>
  );
}
