import { useCallback } from "react";
import { useAction } from "~/app/settings-context";
import type { SettingsApi } from "~/ports/settings-api";

const verifyFn = (api: SettingsApi, id: string, roleArn: string) => api.verifyAwsConnection(id, roleArn);
const refreshFn = (api: SettingsApi) => api.getSettings();

export function useRefresh() {
  return useAction(refreshFn);
}

export function useVerifyConnection() {
  const verify = useAction(verifyFn);
  const refresh = useRefresh();
  const verifyRun = verify.run;
  const refreshRun = refresh.run;

  const run = useCallback(
    async (id: string, roleArn: string) => {
      const result = await verifyRun(id, roleArn);
      if (!result) await refreshRun();
      return result;
    },
    [verifyRun, refreshRun],
  );

  return { run, pending: verify.pending || refresh.pending, error: verify.error, clearError: verify.clearError };
}
