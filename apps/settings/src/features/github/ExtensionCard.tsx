import { Card } from "~/ui/Card";
import { Notice } from "~/ui/Notice";
import { CHROME_EXTENSION_URL } from "~/features/github/constants";

export function ExtensionCard({ org }: { org: string }) {
  return (
    <Card title="Chrome extension" description="Infrared inside GitHub, for everyone in your organisation.">
      <div className="flex flex-col gap-4">
        <Notice tone="success">
          <span className="type-label">Extension ready.</span> The app is installed, so the extension can show Infrared data in {org}.
        </Notice>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5" aria-label="How to use the extension">
          <li className="type-body">Install the Infrared extension in Chrome.</li>
          <li className="type-body">Open any repository in the {org} organisation on GitHub.</li>
          <li className="type-body">Open the Infrared panel to see the latest run, its status and CI runner suggestions.</li>
        </ol>
        <div>
          <a
            href={CHROME_EXTENSION_URL}
            target="_blank"
            rel="noreferrer"
            className="type-label inline-flex min-h-9 items-center rounded-item border border-line-strong bg-surface px-3.5 py-1.5 text-accent shadow-lip hover:bg-sunken"
          >
            Get the Chrome extension
          </a>
        </div>
      </div>
    </Card>
  );
}
