import { useState } from "react";
import { useAction } from "~/app/settings-context";
import type { GithubInstallation, RepoSelection } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import { Button } from "~/ui/Button";
import { Dialog } from "~/ui/Dialog";
import { Notice } from "~/ui/Notice";
import { draftFrom, isDraftValid, RepoPicker, selectionFrom, type RepoDraft } from "~/features/github/RepoPicker";

const updateSelection = (api: SettingsApi, selection: RepoSelection) => api.updateRepoSelection(selection);

export function RepoAccessDialog({ installation, onClose }: { installation: GithubInstallation; onClose(): void }) {
  const [draft, setDraft] = useState<RepoDraft>(() => draftFrom(installation.repoSelection));
  const save = useAction(updateSelection);

  async function submit() {
    if (await save.run(selectionFrom(draft))) onClose();
  }

  return (
    <Dialog
      open
      title="Repository access"
      description={`Choose which ${installation.org ?? ""} repositories Infrared can see.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" pending={save.pending} disabled={!isDraftValid(draft)} onClick={submit}>
            Save access
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <RepoPicker repos={installation.availableRepos} value={draft} onChange={setDraft} />
        {save.error && <Notice tone="danger">{save.error}</Notice>}
      </div>
    </Dialog>
  );
}
