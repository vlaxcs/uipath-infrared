import { useState } from "react";
import { useAction } from "~/app/settings-context";
import { AWS_REGIONS, regionLabel } from "~/domain/cloud-rules";
import type { CloudConnection } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import { Button } from "~/ui/Button";
import { Dialog } from "~/ui/Dialog";
import { Notice } from "~/ui/Notice";

const updateFn = (api: SettingsApi, id: string, regions: string[]) => api.updateRegions(id, regions);

export function RegionsDialog({ connection, onClose }: { connection: CloudConnection; onClose(): void }) {
  const update = useAction(updateFn);
  const [selected, setSelected] = useState<string[]>(connection.regions);
  const options = [...AWS_REGIONS.map((region) => region.id), ...connection.regions.filter((id) => !AWS_REGIONS.some((region) => region.id === id))];

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((region) => region !== id) : [...current, id]));
  }

  async function save() {
    const ordered = options.filter((id) => selected.includes(id));
    if (await update.run(connection.id, ordered)) onClose();
  }

  return (
    <Dialog
      open
      title="Edit regions"
      description="Infrared reads inventory and metrics only in the regions you pick."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={selected.length === 0} pending={update.pending} onClick={save}>
            Save regions
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Regions</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {options.map((id) => (
            <label key={id} className="flex cursor-pointer items-center gap-3 rounded-item px-2 py-1.5 hover:bg-sunken">
              <input type="checkbox" className="size-4 accent-accent" checked={selected.includes(id)} onChange={() => toggle(id)} />
              <span className="flex min-w-0 flex-col">
                <span className="type-label">{regionLabel(id)}</span>
                <span className="type-code text-fg-muted">{id}</span>
              </span>
            </label>
          ))}
        </div>
        {selected.length === 0 && <p className="type-small text-danger">Pick at least one region.</p>}
        {update.error && <Notice tone="danger">{update.error}</Notice>}
      </fieldset>
    </Dialog>
  );
}
