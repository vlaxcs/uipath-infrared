import { useId, useState, type FormEvent } from "react";
import { useSettings } from "~/app/settings-context";
import { ROLE_NAME, formatAccountId, parseRoleArn } from "~/domain/cloud-rules";
import type { AwsConnectionStart } from "~/domain/types";
import { Button } from "~/ui/Button";
import { CopyField } from "~/ui/CopyField";
import { Dialog } from "~/ui/Dialog";
import { Field } from "~/ui/Field";
import { Notice } from "~/ui/Notice";
import { Spinner } from "~/ui/Spinner";
import { RegionChips } from "~/features/cloud/RegionChips";
import { useVerifyConnection } from "~/features/cloud/use-cloud-actions";

export type ConnectStep = 1 | 2 | 3;

const STEPS = ["Create the role", "Add the role ARN", "Verify"];

const ARN_HINT = "Enter a role ARN like arn:aws:iam::123456789012:role/InfraredReadOnly.";

function StepIndicator({ step }: { step: ConnectStep }) {
  return (
    <ol aria-label="Setup steps" className="mb-5 grid grid-cols-3 gap-2">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const state = number < step ? "done" : number === step ? "current" : "todo";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex min-w-0 flex-col gap-1.5">
            <span className={`h-1 rounded-full ${state === "todo" ? "bg-line" : "bg-accent"}`} />
            <span className={`type-small truncate ${state === "current" ? "font-semibold text-fg" : "text-fg-muted"}`}>
              {number}. {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export interface ConnectAwsDialogProps {
  setup: AwsConnectionStart;
  initialStep?: ConnectStep;
  initialRoleArn?: string | null;
  onClose(): void;
}

export function ConnectAwsDialog({ setup, initialStep = 1, initialRoleArn, onClose }: ConnectAwsDialogProps) {
  const formId = useId();
  const settings = useSettings();
  const verify = useVerifyConnection();
  const [step, setStep] = useState<ConnectStep>(initialStep);
  const [roleArn, setRoleArn] = useState(initialRoleArn ?? "");
  const [showArnError, setShowArnError] = useState(false);
  const [verified, setVerified] = useState(false);

  const parsed = parseRoleArn(roleArn);
  const arnError = showArnError && !parsed ? ARN_HINT : null;
  const connection = settings.cloud.find((candidate) => candidate.id === setup.connectionId);

  async function submitArn(event: FormEvent) {
    event.preventDefault();
    if (!parsed) {
      setShowArnError(true);
      return;
    }
    setVerified(false);
    setStep(3);
    const result = await verify.run(setup.connectionId, roleArn.trim());
    setVerified(Boolean(result));
  }

  function backToArn() {
    verify.clearError();
    setStep(2);
  }

  const footer =
    step === 1 ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => setStep(2)}>
          Next
        </Button>
      </>
    ) : step === 2 ? (
      <>
        <Button variant="ghost" onClick={() => setStep(1)}>
          Back
        </Button>
        <Button variant="primary" type="submit" form={formId}>
          Verify
        </Button>
      </>
    ) : verify.pending ? null : verified ? (
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    ) : (
      <>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" onClick={backToArn}>
          Back
        </Button>
      </>
    );

  return (
    <Dialog open title="Connect AWS account" description="Infrared gets read-only access by assuming a role in your account." onClose={onClose} size="lg" footer={footer}>
      <StepIndicator step={step} />

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="type-body text-fg-muted">
            Create an IAM role named <code className="type-code text-fg">{ROLE_NAME}</code> in the account you want re-planned. The CloudFormation
            stack creates it with both policies below; you can also create it by hand.
          </p>
          <a
            href={setup.cfnTemplateUrl}
            target="_blank"
            rel="noreferrer"
            className="type-label inline-flex min-h-9 w-fit items-center rounded-item bg-accent px-3.5 py-1.5 text-on-accent shadow-[0_2px_0_var(--accent-lip)] hover:brightness-110"
          >
            Launch CloudFormation stack
          </a>
          <CopyField label="External ID" value={setup.externalId} />
          <CopyField label="Trust policy" value={setup.trustPolicyJson} multiline />
          <CopyField label="Permissions policy" value={setup.permissionsPolicyJson} multiline />
        </div>
      )}

      {step === 2 && (
        <form id={formId} onSubmit={submitArn} noValidate className="flex flex-col gap-4">
          <Field
            label="Role ARN"
            placeholder="arn:aws:iam::123456789012:role/InfraredReadOnly"
            hint="Find it in the stack's Outputs tab, or on the role's page in IAM."
            value={roleArn}
            error={arnError}
            onChange={(event) => setRoleArn(event.target.value)}
            onBlur={() => roleArn.trim() && setShowArnError(true)}
            autoComplete="off"
            spellCheck={false}
          />
        </form>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          {verify.pending && (
            <div className="type-body flex items-center gap-3 text-fg-muted">
              <Spinner label="Verifying access" /> Assuming the role in your account…
            </div>
          )}
          {!verify.pending && verified && connection?.accountId && (
            <>
              <Notice tone="success">Connected AWS account {formatAccountId(connection.accountId)}. Infrared has read-only access.</Notice>
              <div className="flex flex-col gap-2">
                <span className="type-label">Regions Infrared reads</span>
                <RegionChips regions={connection.regions} />
                <span className="type-small text-fg-muted">You can change these from the account card.</span>
              </div>
            </>
          )}
          {!verify.pending && verify.error && <Notice tone="danger">{verify.error}</Notice>}
        </div>
      )}
    </Dialog>
  );
}
