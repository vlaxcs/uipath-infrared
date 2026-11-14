import { describe, expect, it } from "vitest";
import { SettingsError, type CloudConnection, type SettingsErrorCode } from "~/domain/types";
import {
  AWS_REGIONS,
  READ_ONLY_ACTIONS,
  READ_ONLY_PERMISSIONS_POLICY,
  awsSetupFor,
  cfnQuickCreateUrl,
  checkRemovable,
  checkVerifiable,
  externalIdFrom,
  findConnection,
  formatAccountId,
  isAwsRegion,
  markFailed,
  markVerified,
  newAwsConnection,
  parseRoleArn,
  revoked,
  trustPolicyFor,
  withRegions,
  withRotatedExternalId,
} from "~/domain/cloud-rules";

const ARN = "arn:aws:iam::123456789012:role/InfraredReadOnly";

function connection(patch: Partial<CloudConnection> = {}): CloudConnection {
  return { ...newAwsConnection("cc_0001", "2026-11-14T12:00:00Z"), ...patch };
}

function codeOf(action: () => unknown): SettingsErrorCode | null {
  try {
    action();
    return null;
  } catch (error) {
    if (error instanceof SettingsError) return error.code;
    throw error;
  }
}

describe("parseRoleArn", () => {
  it("reads the account and role name", () => {
    expect(parseRoleArn(ARN)).toEqual({ accountId: "123456789012", roleName: "InfraredReadOnly" });
  });

  it("uses the last segment of a role path as the name", () => {
    expect(parseRoleArn("arn:aws:iam::123456789012:role/infra/Infrared")?.roleName).toBe("Infrared");
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseRoleArn(`  ${ARN} `)?.accountId).toBe("123456789012");
  });

  it.each([
    "",
    "InfraredReadOnly",
    "arn:aws:iam::12345678901:role/Infrared",
    "arn:aws:iam::123456789012:user/Infrared",
    "arn:aws:iam::123456789012:role/",
    "arn:aws:s3:::bucket",
    `arn:aws:iam::123456789012:role/${"a".repeat(65)}`,
  ])("rejects %j", (value) => {
    expect(parseRoleArn(value)).toBeNull();
  });
});

describe("regions", () => {
  it("accepts real region ids and rejects others", () => {
    expect(isAwsRegion("eu-central-1")).toBe(true);
    expect(isAwsRegion("us-gov-west-1")).toBe(true);
    expect(isAwsRegion("ap-southeast-2")).toBe(true);
    expect(isAwsRegion("Frankfurt")).toBe(false);
    expect(isAwsRegion("eu-central")).toBe(false);
    expect(isAwsRegion("")).toBe(false);
  });

  it("lists common EU and US regions that are all valid", () => {
    expect(AWS_REGIONS.length).toBeGreaterThanOrEqual(8);
    expect(AWS_REGIONS.every((region) => isAwsRegion(region.id) && region.label.length > 0)).toBe(true);
    expect(AWS_REGIONS.every((region) => /^(eu|us)-/.test(region.id))).toBe(true);
  });
});

describe("policies", () => {
  it("trusts only the Infrared account with the external ID", () => {
    const policy = JSON.parse(trustPolicyFor("ir-abc123abc123"));
    const statement = policy.Statement[0];
    expect(statement.Principal.AWS).toBe("arn:aws:iam::999988887777:root");
    expect(statement.Action).toBe("sts:AssumeRole");
    expect(statement.Condition.StringEquals["sts:ExternalId"]).toBe("ir-abc123abc123");
  });

  it("grants only read actions", () => {
    const policy = JSON.parse(READ_ONLY_PERMISSIONS_POLICY);
    const actions: string[] = policy.Statement.flatMap((statement: { Action: string[] }) => statement.Action);
    expect(actions).toEqual(READ_ONLY_ACTIONS);
    expect(actions.every((action) => /^[a-z0-9]+:(Describe|List|Get)/.test(action))).toBe(true);
    expect(READ_ONLY_PERMISSIONS_POLICY).not.toMatch(/Create|Delete|Put|Update|Modify|Terminate|Start|Stop|Invoke/);
    expect(actions.some((action) => action === "*" || action.endsWith(":*"))).toBe(false);
    expect(policy.Statement.every((statement: { Effect: string }) => statement.Effect === "Allow")).toBe(true);
  });

  it("covers inventory, metrics, cost and pricing", () => {
    for (const action of ["ec2:Describe*", "rds:Describe*", "elasticache:Describe*", "eks:Describe*", "lambda:List*", "s3:ListAllMyBuckets", "s3:GetBucketLocation", "cloudwatch:GetMetricData", "ce:GetCostAndUsage", "pricing:GetProducts"]) {
      expect(READ_ONLY_ACTIONS).toContain(action);
    }
  });

  it("builds a CloudFormation quick-create link carrying the external ID", () => {
    const url = cfnQuickCreateUrl("ir-abc123abc123");
    expect(url.startsWith("https://console.aws.amazon.com/cloudformation/home#/stacks/quickcreate?templateURL=")).toBe(true);
    expect(url).toContain("stackName=InfraredReadOnly");
    expect(url).toContain("param_ExternalId=ir-abc123abc123");
  });

  it("derives the full setup from a connection", () => {
    const setup = awsSetupFor({ id: "cc_1", externalId: "ir-000000000001" });
    expect(setup.connectionId).toBe("cc_1");
    expect(setup.trustPolicyJson).toContain("ir-000000000001");
    expect(setup.permissionsPolicyJson).toBe(READ_ONLY_PERMISSIONS_POLICY);
    expect(setup.cfnTemplateUrl).toContain("param_ExternalId=ir-000000000001");
  });
});

describe("externalIdFrom", () => {
  it("is ir- plus 12 lowercase hex", () => {
    expect(externalIdFrom("cc_0001")).toMatch(/^ir-[0-9a-f]{12}$/);
    expect(externalIdFrom("")).toMatch(/^ir-[0-9a-f]{12}$/);
  });

  it("is deterministic and varies with the seed", () => {
    expect(externalIdFrom("cc_0001")).toBe(externalIdFrom("cc_0001"));
    expect(externalIdFrom("cc_0001")).not.toBe(externalIdFrom("cc_0002"));
  });
});

describe("formatAccountId", () => {
  it("groups digits in fours", () => {
    expect(formatAccountId("412345678901")).toBe("4123 4567 8901");
  });
});

describe("transitions", () => {
  it("starts a pending read-only connection in eu-central-1", () => {
    const fresh = newAwsConnection("cc_0001", "2026-11-14T12:00:00Z");
    expect(fresh).toMatchObject({ status: "pending", accountId: null, roleArn: null, regions: ["eu-central-1"], access: "read-only" });
    expect(fresh.externalId).toBe(externalIdFrom("cc_0001"));
  });

  it("finds a connection or throws not_found", () => {
    const one = connection();
    expect(findConnection([one], "cc_0001")).toBe(one);
    expect(codeOf(() => findConnection([one], "cc_nope"))).toBe("not_found");
  });

  it("checks a role ARN before verifying", () => {
    const one = connection();
    expect(checkVerifiable([one], one, ARN)).toEqual({ accountId: "123456789012", roleName: "InfraredReadOnly" });
    expect(codeOf(() => checkVerifiable([one], one, "nope"))).toBe("invalid_input");
    expect(codeOf(() => checkVerifiable([], connection({ status: "revoked" }), ARN))).toBe("conflict");
  });

  it("refuses an account that another connection already has connected", () => {
    const one = connection();
    const other = connection({ id: "cc_other", status: "connected", accountId: "123456789012" });
    expect(codeOf(() => checkVerifiable([one, other], one, ARN))).toBe("conflict");
    expect(codeOf(() => checkVerifiable([one, { ...other, status: "revoked" }], one, ARN))).toBeNull();
    expect(codeOf(() => checkVerifiable([one, { ...other, status: "failed" }], one, ARN))).toBeNull();
  });

  it("marks a connection verified or failed", () => {
    const one = connection({ error: "old" });
    const verified = markVerified(one, ARN, { accountId: "123456789012", roleName: "InfraredReadOnly" }, "2026-11-14T12:00:00Z");
    expect(verified).toMatchObject({ status: "connected", accountId: "123456789012", roleArn: ARN, lastVerifiedAt: "2026-11-14T12:00:00Z", error: null });
    expect(markFailed(one, ARN, "boom")).toMatchObject({ status: "failed", roleArn: ARN, error: "boom" });
  });

  it("updates regions only on connected accounts, deduped and validated", () => {
    const one = connection({ status: "connected" });
    expect(withRegions(one, ["eu-west-1", "eu-west-1", "us-east-1"]).regions).toEqual(["eu-west-1", "us-east-1"]);
    expect(codeOf(() => withRegions(one, []))).toBe("invalid_input");
    expect(codeOf(() => withRegions(one, ["eu-west-1", "mars-1"]))).toBe("invalid_input");
    expect(codeOf(() => withRegions(connection(), ["eu-west-1"]))).toBe("conflict");
  });

  it("rotates the external ID on connected or failed accounts and asks for re-verification", () => {
    for (const status of ["connected", "failed"] as const) {
      const next = withRotatedExternalId(connection({ status, error: "x" }), "ir-111111111111");
      expect(next).toMatchObject({ externalId: "ir-111111111111", status: "pending", error: null });
    }
    for (const status of ["pending", "verifying", "revoked"] as const) {
      expect(codeOf(() => withRotatedExternalId(connection({ status }), "ir-111111111111"))).toBe("conflict");
    }
  });

  it("revokes once", () => {
    expect(revoked(connection({ status: "failed", error: "x" }))).toMatchObject({ status: "revoked", error: null });
    expect(codeOf(() => revoked(connection({ status: "revoked" })))).toBe("conflict");
  });

  it("removes only pending, failed or revoked connections", () => {
    for (const status of ["pending", "failed", "revoked"] as const) {
      expect(codeOf(() => checkRemovable(connection({ status })))).toBeNull();
    }
    expect(codeOf(() => checkRemovable(connection({ status: "connected" })))).toBe("conflict");
    expect(codeOf(() => checkRemovable(connection({ status: "verifying" })))).toBe("conflict");
  });
});
