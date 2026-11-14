import { Card } from "~/ui/Card";
import { Notice } from "~/ui/Notice";

const CODE = "rounded-item bg-sunken px-1.5 py-0.5 font-mono";

export function ExtensionCard({ org }: { org: string }) {
  return (
    <Card title="Chrome extension" description="Infrared inside GitHub, for everyone in your organisation.">
      <div className="flex flex-col gap-4">
        <Notice tone="success">
          <span className="type-label">Extension ready.</span> The app is installed, so the extension can show Infrared data in {org}.
        </Notice>
        <p className="type-body">It is not in the Chrome Web Store yet. Load it from the repository:</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5" aria-label="Install the extension from the repository">
          <li className="type-body">
            In the repository, run <code className={CODE}>cd apps/chrome-extension</code>, <code className={CODE}>npm install</code> and{" "}
            <code className={CODE}>npm run build</code>.
          </li>
          <li className="type-body">
            Open <code className={`${CODE} select-all`}>chrome://extensions</code> in a new tab and turn on <strong>Developer mode</strong>.
          </li>
          <li className="type-body">
            Choose <strong>Load unpacked</strong> and select <code className={CODE}>apps/chrome-extension/dist</code>.
          </li>
          <li className="type-body">Open any repository in the {org} organisation on GitHub and open the Infrared panel.</li>
        </ol>
      </div>
    </Card>
  );
}
