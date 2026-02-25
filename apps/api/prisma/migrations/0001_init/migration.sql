-- Initial schema for SentinelOne MVP
CREATE TYPE "UserRole" AS ENUM ('OWNER','ADMIN','SECURITY','DEVOPS','AUDITOR','REQUESTER');
CREATE TYPE "TargetType" AS ENUM ('SSH','CLOUD');
CREATE TYPE "RequestStatus" AS ENUM ('PENDING','APPROVED','REJECTED','ACTIVE','EXPIRED','REVOKED');
CREATE TYPE "AlertSeverity" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE "AlertStatus" AS ENUM ('OPEN','TRIAGED','RESOLVED');
CREATE TYPE "FindingSource" AS ENUM ('CSPM','RUNTIME');

CREATE TABLE "Org" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "rootSecretSalt" text NOT NULL,
  "rootSecretVerifier" text NOT NULL,
  "awsRoleArn" text,
  "awsExternalId" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "User" (
  "id" text PRIMARY KEY,
  "orgId" text NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "passwordHash" text NOT NULL,
  "role" "UserRole" NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "mfaEnabled" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("orgId","email")
);

CREATE TABLE "Mfa" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "totpSecret" text NOT NULL,
  "backupCodes" text[] NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "Device" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "fingerprint" text NOT NULL,
  "label" text NOT NULL,
  "lastSeenAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "RefreshToken" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "revokedAt" timestamptz
);

CREATE TABLE "Project" (
  "id" text PRIMARY KEY,
  "orgId" text NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "Environment" (
  "id" text PRIMARY KEY,
  "projectId" text NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "PamTarget" (
  "id" text PRIMARY KEY,
  "orgId" text NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" "TargetType" NOT NULL,
  "host" text NOT NULL,
  "port" integer NOT NULL,
  "username" text NOT NULL,
  "metadata" jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "PamRequest" (
  "id" text PRIMARY KEY,
  "orgId" text NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "requesterId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "targetId" text NOT NULL REFERENCES "PamTarget"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "requestedUntil" timestamptz NOT NULL,
  "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
  "ephemeralCred" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "PamApproval" (
  "id" text PRIMARY KEY,
  "requestId" text NOT NULL REFERENCES "PamRequest"("id") ON DELETE CASCADE,
  "approverId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "approved" boolean NOT NULL,
  "reason" text NOT NULL,
  "windowStart" timestamptz NOT NULL,
  "windowEnd" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "PamSession" (
  "id" text PRIMARY KEY,
  "orgId" text NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "requestId" text NOT NULL REFERENCES "PamRequest"("id") ON DELETE CASCADE,
  "startedAt" timestamptz NOT NULL DEFAULT now(),
  "endedAt" timestamptz,
  "commandLog" jsonb NOT NULL,
  "metadata" jsonb NOT NULL
);

CREATE TABLE "Secret" (
  "id" text PRIMARY KEY,
  "orgId" text NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "projectId" text,
  "environmentId" text,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "encryptedDek" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("orgId","name")
);

CREATE TABLE "SecretVersion" (
  "id" text PRIMARY KEY,
  "secretId" text NOT NULL REFERENCES "Secret"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "ciphertext" text NOT NULL,
  "nonce" text NOT NULL,
  "tag" text NOT NULL,
  "createdBy" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("secretId","version")
);

CREATE TABLE "RotationPolicy" (
  "id" text PRIMARY KEY,
  "secretId" text NOT NULL UNIQUE REFERENCES "Secret"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "scheduleCron" text NOT NULL,
  "config" jsonb NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "lastRunAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "RotationRun" (
  "id" text PRIMARY KEY,
  "policyId" text NOT NULL REFERENCES "RotationPolicy"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "output" jsonb NOT NULL,
  "ranAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "Finding" (
  "id" text PRIMARY KEY,
  "orgId" text NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "source" "FindingSource" NOT NULL,
  "checkId" text NOT NULL,
  "title" text NOT NULL,
  "severity" "AlertSeverity" NOT NULL,
  "resource" text NOT NULL,
  "status" text NOT NULL,
  "remediation" text NOT NULL,
  "metadata" jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "PostureRun" (
  "id" text PRIMARY KEY,
  "orgId" text NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "score" integer NOT NULL,
  "summary" jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "Alert" (
  "id" text PRIMARY KEY,
  "orgId" text NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "severity" "AlertSeverity" NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
  "timeline" jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "AlertEvent" (
  "id" text PRIMARY KEY,
  "alertId" text NOT NULL REFERENCES "Alert"("id") ON DELETE CASCADE,
  "actorId" text REFERENCES "User"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "message" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "ResponseAction" (
  "id" text PRIMARY KEY,
  "alertId" text NOT NULL REFERENCES "Alert"("id") ON DELETE CASCADE,
  "actionType" text NOT NULL,
  "status" text NOT NULL,
  "output" jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "AuditLog" (
  "id" text PRIMARY KEY,
  "orgId" text NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "actorId" text,
  "action" text NOT NULL,
  "resource" text NOT NULL,
  "metadata" jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "Webhook" (
  "id" text PRIMARY KEY,
  "orgId" text NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "secret" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "events" text[] NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "ApiToken" (
  "id" text PRIMARY KEY,
  "orgId" text NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "tokenHash" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "lastUsedAt" timestamptz
);
