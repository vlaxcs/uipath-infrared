import type { CloudApi } from "~/ports/settings-api";
import type { FakeStore } from "~/adapters/fake/store";
import { SettingsError, type CloudConnection } from "~/domain/types";
import {
  INFRARED_AWS_ACCOUNT_ID,
  awsSetupFor,
  checkRemovable,
  checkVerifiable,
  externalIdFrom,
  findConnection,
  markFailed,
  markVerified,
  newAwsConnection,
  revoked,
  withRegions,
  withRotatedExternalId,
} from "~/domain/cloud-rules";

export const ACCESS_DENIED_MESSAGE = `Infrared could not assume the role. Check the trust policy allows account ${INFRARED_AWS_ACCOUNT_ID}.`;
export const EXTERNAL_ID_MISMATCH_MESSAGE =
  "The role exists but its trust policy expects a different external ID. Copy the current external ID into the sts:ExternalId condition and verify again.";

export function createFakeCloudApi(store: FakeStore): CloudApi {
  function replace(next: CloudConnection) {
    store.state.cloud = store.state.cloud.map((connection) => (connection.id === next.id ? next : connection));
  }

  return {
    startAwsConnection: () =>
      store.settle(() => {
        const connection = newAwsConnection(store.nextId("cc"), store.now().toISOString());
        store.state.cloud = [...store.state.cloud, connection];
        return awsSetupFor(connection);
      }),

    verifyAwsConnection: (id, roleArn) =>
      store.settle(() => {
        const connection = findConnection(store.state.cloud, id);
        const parsed = checkVerifiable(store.state.cloud, connection, roleArn);
        const roleName = parsed.roleName.toLowerCase();
        if (roleName.includes("denied")) {
          replace(markFailed(connection, roleArn, ACCESS_DENIED_MESSAGE));
          throw new SettingsError("access_denied", ACCESS_DENIED_MESSAGE);
        }
        if (roleName.includes("wrong-external-id")) {
          replace(markFailed(connection, roleArn, EXTERNAL_ID_MISMATCH_MESSAGE));
          throw new SettingsError("external_id_mismatch", EXTERNAL_ID_MISMATCH_MESSAGE);
        }
        replace(markVerified(connection, roleArn, parsed, store.now().toISOString()));
        return store.snapshot();
      }),

    updateRegions: (id, regions) =>
      store.settle(() => {
        replace(withRegions(findConnection(store.state.cloud, id), regions));
        return store.snapshot();
      }),

    rotateExternalId: (id) =>
      store.settle(() => {
        const connection = findConnection(store.state.cloud, id);
        replace(withRotatedExternalId(connection, externalIdFrom(`${id}:${store.nextId("rot")}`)));
        return store.snapshot();
      }),

    revokeCloudConnection: (id) =>
      store.settle(() => {
        replace(revoked(findConnection(store.state.cloud, id)));
        return store.snapshot();
      }),

    removeCloudConnection: (id) =>
      store.settle(() => {
        checkRemovable(findConnection(store.state.cloud, id));
        store.state.cloud = store.state.cloud.filter((connection) => connection.id !== id);
        return store.snapshot();
      }),
  };
}
