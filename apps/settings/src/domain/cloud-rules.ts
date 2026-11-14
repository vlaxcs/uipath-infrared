import { SettingsError, type AwsConnectionStart, type CloudConnection } from "~/domain/types";

export const INFRARED_AWS_ACCOUNT_ID = "999988887777";
export const ROLE_NAME = "InfraredReadOnly";
export const DEFAULT_REGIONS = ["eu-central-1"];
export const CFN_TEMPLATE_URL = "https://infrared-public.s3.amazonaws.com/cfn/read-only-role.yaml";

export interface AwsRegion {
  id: string;
  label: string;
}

export const AWS_REGIONS: AwsRegion[] = [
  { id: "eu-central-1", label: "Europe (Frankfurt)" },
  { id: "eu-west-1", label: "Europe (Ireland)" },
  { id: "eu-west-2", label: "Europe (London)" },
  { id: "eu-west-3", label: "Europe (Paris)" },
  { id: "eu-north-1", label: "Europe (Stockholm)" },
  { id: "eu-south-1", label: "Europe (Milan)" },
  { id: "us-east-1", label: "US East (N. Virginia)" },
  { id: "us-east-2", label: "US East (Ohio)" },
  { id: "us-west-1", label: "US West (N. California)" },
  { id: "us-west-2", label: "US West (Oregon)" },
];

const ROLE_ARN = /^arn:aws:iam::(\d{12}):role\/([\w+=,.@\/-]{1,64})$/;
const REGION = /^[a-z]{2}(-gov)?-[a-z]+-\d$/;

export interface ParsedRoleArn {
  accountId: string;
  roleName: string;
}

export function parseRoleArn(arn: string): ParsedRoleArn | null {
  const match = ROLE_ARN.exec(arn.trim());
  if (!match) return null;
  const path = match[2].split("/");
  return { accountId: match[1], roleName: path[path.length - 1] };
}

export function isAwsRegion(region: string): boolean {
  return REGION.test(region);
}

export function regionLabel(region: string): string {
  return AWS_REGIONS.find((candidate) => candidate.id === region)?.label ?? region;
}

export function formatAccountId(accountId: string): string {
  return accountId.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function trustPolicyFor(externalId: string): string {
  return JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: `arn:aws:iam::${INFRARED_AWS_ACCOUNT_ID}:root` },
          Action: "sts:AssumeRole",
          Condition: { StringEquals: { "sts:ExternalId": externalId } },
        },
      ],
    },
    null,
    2,
  );
}

export const READ_ONLY_ACTIONS = [
  "ec2:Describe*",
  "rds:Describe*",
  "rds:ListTagsForResource",
  "elasticache:Describe*",
  "elasticache:ListTagsForResource",
  "eks:Describe*",
  "eks:List*",
  "lambda:Get*",
  "lambda:List*",
  "s3:ListAllMyBuckets",
  "s3:GetBucketLocation",
  "cloudwatch:GetMetricData",
  "ce:GetCostAndUsage",
  "pricing:GetProducts",
];

export const READ_ONLY_PERMISSIONS_POLICY = JSON.stringify(
  {
    Version: "2012-10-17",
    Statement: [{ Sid: "InfraredReadOnly", Effect: "Allow", Action: READ_ONLY_ACTIONS, Resource: "*" }],
  },
  null,
  2,
);

export function externalIdFrom(seed: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let index = 0; index < seed.length; index += 1) {
    const code = seed.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
    b = (b ^ (b >>> 13)) >>> 0;
  }
  const hex = a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
  return `ir-${hex.slice(0, 12)}`;
}

export function cfnQuickCreateUrl(externalId: string): string {
  const params = [
    `templateURL=${encodeURIComponent(CFN_TEMPLATE_URL)}`,
    `stackName=${ROLE_NAME}`,
    `param_ExternalId=${encodeURIComponent(externalId)}`,
  ].join("&");
  return `https://console.aws.amazon.com/cloudformation/home#/stacks/quickcreate?${params}`;
}

export function awsSetupFor(connection: Pick<CloudConnection, "id" | "externalId">): AwsConnectionStart {
  return {
    connectionId: connection.id,
    externalId: connection.externalId,
    trustPolicyJson: trustPolicyFor(connection.externalId),
    permissionsPolicyJson: READ_ONLY_PERMISSIONS_POLICY,
    cfnTemplateUrl: cfnQuickCreateUrl(connection.externalId),
  };
}

export function newAwsConnection(id: string, createdAt: string): CloudConnection {
  return {
    id,
    provider: "aws",
    accountId: null,
    roleArn: null,
    externalId: externalIdFrom(id),
    regions: [...DEFAULT_REGIONS],
    access: "read-only",
    status: "pending",
    createdAt,
    lastVerifiedAt: null,
    error: null,
  };
}

export function findConnection(connections: CloudConnection[], id: string): CloudConnection {
  const connection = connections.find((candidate) => candidate.id === id);
  if (!connection) throw new SettingsError("not_found", "That cloud connection no longer exists.");
  return connection;
}

export function checkVerifiable(connections: CloudConnection[], connection: CloudConnection, roleArn: string): ParsedRoleArn {
  if (connection.status === "revoked") throw new SettingsError("conflict", "This connection was revoked. Connect the account again instead.");
  const parsed = parseRoleArn(roleArn);
  if (!parsed) throw new SettingsError("invalid_input", "Enter a role ARN like arn:aws:iam::123456789012:role/InfraredReadOnly.");
  const duplicate = connections.some(
    (other) => other.id !== connection.id && other.status === "connected" && other.accountId === parsed.accountId,
  );
  if (duplicate) throw new SettingsError("conflict", `AWS account ${formatAccountId(parsed.accountId)} is already connected.`);
  return parsed;
}

export function markVerified(connection: CloudConnection, roleArn: string, parsed: ParsedRoleArn, now: string): CloudConnection {
  return {
    ...connection,
    roleArn: roleArn.trim(),
    accountId: parsed.accountId,
    status: "connected",
    lastVerifiedAt: now,
    error: null,
  };
}

export function markFailed(connection: CloudConnection, roleArn: string, error: string): CloudConnection {
  return { ...connection, roleArn: roleArn.trim(), status: "failed", error };
}

export function withRegions(connection: CloudConnection, regions: string[]): CloudConnection {
  if (connection.status !== "connected") throw new SettingsError("conflict", "Regions can only be changed on a connected account.");
  const unique = [...new Set(regions.map((region) => region.trim()))];
  if (unique.length === 0) throw new SettingsError("invalid_input", "Pick at least one region.");
  const invalid = unique.find((region) => !isAwsRegion(region));
  if (invalid !== undefined) throw new SettingsError("invalid_input", `"${invalid}" is not an AWS region.`);
  return { ...connection, regions: unique };
}

export function withRotatedExternalId(connection: CloudConnection, externalId: string): CloudConnection {
  if (connection.status !== "connected" && connection.status !== "failed") {
    throw new SettingsError("conflict", "The external ID can only be rotated on a connected or failed account.");
  }
  return { ...connection, externalId, status: "pending", error: null };
}

export function revoked(connection: CloudConnection): CloudConnection {
  if (connection.status === "revoked") throw new SettingsError("conflict", "This connection is already revoked.");
  return { ...connection, status: "revoked", error: null };
}

export function checkRemovable(connection: CloudConnection): void {
  if (connection.status !== "pending" && connection.status !== "failed" && connection.status !== "revoked") {
    throw new SettingsError("conflict", "Revoke the connection before removing it.");
  }
}
