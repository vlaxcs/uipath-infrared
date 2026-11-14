import { describe, expect, it } from "vitest";
import { SEED_SETTINGS } from "~/adapters/seed";
import { createFakeStore } from "~/adapters/fake/store";
import { ACCESS_DENIED_MESSAGE, createFakeCloudApi } from "~/adapters/fake/cloud";
import { SettingsError, type AccountSettings, type SettingsErrorCode } from "~/domain/types";
import { externalIdFrom } from "~/domain/cloud-rules";

const NOW = new Date("2026-11-14T12:00:00Z");

function setup(patch: (seed: AccountSettings) => void = () => {}) {
  const seed = structuredClone(SEED_SETTINGS);
  patch(seed);
  const store = createFakeStore(seed, { now: () => NOW });
  return { store, api: createFakeCloudApi(store) };
}

async function codeOf(promise: Promise<unknown>): Promise<SettingsErrorCode | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    if (error instanceof SettingsError) return error.code;
    throw error;
  }
}

describe("the fake cloud api", () => {
  it("starts a pending connection and returns its setup", async () => {
    const { store, api } = setup();
    const start = await api.startAwsConnection();
    expect(start.connectionId).toBe("cc_0001");
    expect(start.externalId).toBe(externalIdFrom("cc_0001"));
    expect(start.trustPolicyJson).toContain(start.externalId);
    expect(start.permissionsPolicyJson).toContain("ec2:Describe*");
    expect(start.cfnTemplateUrl).toContain("stackName=InfraredReadOnly");
    expect(start.cfnTemplateUrl).toContain(`param_ExternalId=${start.externalId}`);
    const created = store.state.cloud.find((connection) => connection.id === "cc_0001");
    expect(created).toMatchObject({ status: "pending", regions: ["eu-central-1"], accountId: null, roleArn: null, createdAt: NOW.toISOString() });
  });

  it("verifies a role and connects the account", async () => {
    const { api } = setup();
    const { connectionId } = await api.startAwsConnection();
    const settings = await api.verifyAwsConnection(connectionId, "arn:aws:iam::555566667777:role/InfraredReadOnly");
    expect(settings.cloud.find((connection) => connection.id === connectionId)).toMatchObject({
      status: "connected",
      accountId: "555566667777",
      roleArn: "arn:aws:iam::555566667777:role/InfraredReadOnly",
      lastVerifiedAt: NOW.toISOString(),
      error: null,
    });
  });

  it("persists a failed state when the role cannot be assumed", async () => {
    const { store, api } = setup();
    const { connectionId } = await api.startAwsConnection();
    const failure = api.verifyAwsConnection(connectionId, "arn:aws:iam::555566667777:role/denied-role");
    await expect(failure).rejects.toThrow(ACCESS_DENIED_MESSAGE);
    expect(await codeOf(api.verifyAwsConnection(connectionId, "arn:aws:iam::555566667777:role/denied-role"))).toBe("access_denied");
    expect(store.state.cloud.find((connection) => connection.id === connectionId)).toMatchObject({ status: "failed", error: ACCESS_DENIED_MESSAGE });
  });

  it("persists a failed state on an external ID mismatch", async () => {
    const { store, api } = setup();
    const { connectionId } = await api.startAwsConnection();
    expect(await codeOf(api.verifyAwsConnection(connectionId, "arn:aws:iam::555566667777:role/wrong-external-id"))).toBe("external_id_mismatch");
    const failed = store.state.cloud.find((connection) => connection.id === connectionId)!;
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("external ID");
  });

  it("rejects bad verify requests", async () => {
    const { api } = setup((seed) => {
      seed.cloud.push({ ...seed.cloud[0], id: "cc_old", status: "revoked" });
    });
    const { connectionId } = await api.startAwsConnection();
    expect(await codeOf(api.verifyAwsConnection("cc_nope", "arn:aws:iam::555566667777:role/R"))).toBe("not_found");
    expect(await codeOf(api.verifyAwsConnection("cc_old", "arn:aws:iam::555566667777:role/R"))).toBe("conflict");
    expect(await codeOf(api.verifyAwsConnection(connectionId, "not-an-arn"))).toBe("invalid_input");
    expect(await codeOf(api.verifyAwsConnection(connectionId, "arn:aws:iam::412345678901:role/InfraredReadOnly"))).toBe("conflict");
  });

  it("updates regions with dedupe and validation", async () => {
    const { api } = setup();
    const settings = await api.updateRegions("cc_prod", ["us-east-1", "us-east-1", "eu-west-1"]);
    expect(settings.cloud[0].regions).toEqual(["us-east-1", "eu-west-1"]);
    expect(await codeOf(api.updateRegions("cc_prod", []))).toBe("invalid_input");
    expect(await codeOf(api.updateRegions("cc_prod", ["moon-1"]))).toBe("invalid_input");
    expect(await codeOf(api.updateRegions("cc_nope", ["eu-west-1"]))).toBe("not_found");
  });

  it("rotates the external ID to a new value and sets pending", async () => {
    const { api } = setup();
    const first = await api.rotateExternalId("cc_prod");
    const rotated = first.cloud[0];
    expect(rotated.status).toBe("pending");
    expect(rotated.externalId).toMatch(/^ir-[0-9a-f]{12}$/);
    expect(rotated.externalId).not.toBe("ir-7f3c9a2e5b14");
    expect(await codeOf(api.rotateExternalId("cc_prod"))).toBe("conflict");
    const reverified = await api.verifyAwsConnection("cc_prod", rotated.roleArn!);
    expect(reverified.cloud[0].status).toBe("connected");
    const second = await api.rotateExternalId("cc_prod");
    expect(second.cloud[0].externalId).not.toBe(rotated.externalId);
  });

  it("revokes, then removes", async () => {
    const { api } = setup();
    expect(await codeOf(api.removeCloudConnection("cc_prod"))).toBe("conflict");
    const revokedSettings = await api.revokeCloudConnection("cc_prod");
    expect(revokedSettings.cloud[0]).toMatchObject({ status: "revoked", error: null });
    expect(await codeOf(api.revokeCloudConnection("cc_prod"))).toBe("conflict");
    const removed = await api.removeCloudConnection("cc_prod");
    expect(removed.cloud).toEqual([]);
    expect(await codeOf(api.removeCloudConnection("cc_prod"))).toBe("not_found");
  });

  it("returns snapshots that do not alias the store", async () => {
    const { store, api } = setup();
    const settings = await api.updateRegions("cc_prod", ["eu-west-1"]);
    settings.cloud[0].regions.push("us-east-1");
    expect(store.state.cloud[0].regions).toEqual(["eu-west-1"]);
  });
});
