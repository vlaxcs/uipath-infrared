import { NoRunsError } from "~/domain/api";
import type { Notice } from "~/domain/types";

export function noticeFor(cause: unknown): Notice {
  if (cause instanceof NoRunsError) return { kind: "no-runs", message: "No runs yet" };
  return { kind: "unreachable", message: "Can't reach Infrared", detail: messageOf(cause) };
}

export function noAccessNotice(orchestratorUrl: string): Notice {
  return {
    kind: "no-access",
    message: "Not connected",
    detail: `No access to ${hostOf(orchestratorUrl)}. Open Settings to connect.`,
  };
}

export const NOTICE_SHORT_LABEL: Record<Notice["kind"], string> = {
  "no-runs": "No runs",
  unreachable: "Offline",
  "no-access": "Not connected",
};

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function hostOf(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return "the orchestrator";
  }
}
