# SentinelOne MVP SaaS (PAM + ITDR + Secrets + CNAPP-lite)

Production-minded, local-first MVP platform with multi-tenant isolation (`org_id` scoping), JIT privileged access, encrypted secrets + rotation, AWS posture checks, runtime signals, and identity threat detection/response.

## Monorepo Layout

- `apps/api` NestJS + Prisma + BullMQ + WebSocket + OPA integration
- `apps/web` Next.js 14 + Tailwind + TanStack Query + Recharts
- `apps/agent` Go runtime signal agent (Linux)
- `infra/docker` Docker Compose stack
- `infra/terraform/aws` AWS IAM role examples
- `policies` OPA Rego policies

## Prerequisites

- Docker + Docker Compose v2
- (Optional local dev outside Docker) Node.js 20+, npm 10+, Go 1.22+

## Quick Start

```bash
docker compose up --build
```

Services:
- Web UI: `http://localhost:3000`
- API: `http://localhost:4000`
- Swagger: `http://localhost:4000/docs`
- OPA: `http://localhost:8181`

## Demo Tenant Seed Data

Seed runs at API startup.

- Org: `DemoCorp`
- Admin: `admin@democorp.test` / `Password123!`
- Security: `sec@democorp.test` / `Password123!`
- Requester: `dev@democorp.test` / `Password123!`
- PAM target: `demo-ssh`
- Secret: `stripe_api_key`
- Agent token (seed default): `agent-demo-token`

## Local Demo Walkthrough

1. Login as admin at `http://localhost:3000`.
2. MFA enforcement: first admin login issues token + redirects to `Settings`; run TOTP setup + enable.
3. Secrets flow:
   - Go to `Secrets`
   - Rotate `stripe_api_key`
   - Check `Audit` for `SECRET_ROTATE`
4. PAM flow:
   - Login as requester (`dev@democorp.test`), create access request in `PAM`
   - Login as security user (`sec@democorp.test`), approve request
   - Start session and post command events via PAM page actions
   - Check `Audit` and active sessions
5. CNAPP flow:
   - Go to `CNAPP`
   - (Optional) Save AWS role ARN / external ID
   - Run scan and inspect findings
6. ITDR flow:
   - Trigger failed logins (wrong password repeatedly)
   - Open `Alerts` to see ITDR alerts
   - Execute response actions (revoke sessions / require re-auth)

## AWS Account Connection (Read-only)

### App-level connection

Use UI `CNAPP -> Connect AWS Account` or call:

```bash
curl -X POST http://localhost:4000/cnapp/connect \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"roleArn":"arn:aws:iam::<acct>:role/sentinel-cnapp-readonly","externalId":"sentinel-ext-id"}'
```

### Terraform role setup

```bash
cd infra/terraform/aws
terraform init
terraform apply \
  -var "trusted_principal_arn=arn:aws:iam::<backend-account-id>:role/<backend-role>" \
  -var "external_id=sentinel-ext-id"
```

Outputs include `cnapp_role_arn` and optional `rotation_role_arn`.

## Agent (Linux)

The agent collects process names + outbound port observations and posts runtime events.

```bash
cd apps/agent
go run ./cmd/agent
```

Env vars:
- `AGENT_BACKEND_URL` default `http://localhost:4000/cnapp/runtime/ingest`
- `AGENT_ORG_ID` default `demo-org`
- `AGENT_TOKEN` default `agent-demo-token`
- Optional mTLS: `AGENT_CLIENT_CERT`, `AGENT_CLIENT_KEY`, `AGENT_CA_CERT`

## OpenAPI + Postman

- OpenAPI artifact: `apps/api/openapi.json`
- Postman collection: `apps/api/postman_collection.json`
- Regenerate scripts:
  - `npm --workspace apps/api run openapi`
  - `npm --workspace apps/api run postman`

## Security Controls Implemented

- AuthN: email/password + TOTP + backup codes
- Mandatory MFA bootstrap for Admin/Owner
- JWT access + refresh rotation
- Rate limiting on auth endpoints
- AuthZ via OPA (`policies/authz.rego`) for RBAC actions
- Envelope encryption for secrets (AES-256-GCM DEK wrapped by Argon2id-derived org KEK)
- Audit logging for secret access and privileged operations
- Rotation policies + scheduled/background rotation job
- Structured logs with secret/token redaction
- Basic Prometheus metrics endpoint: `/metrics`
- Secure headers in web app

## Background Jobs (BullMQ)

- CSPM scan scheduler (`*/10 * * * *`)
- Secret rotation scheduler (`*/5 * * * *`)
- Alert correlation scheduler (`*/2 * * * *`)

## Threat Model Notes (MVP Scope)

Protected:
- Multi-tenant isolation at data access layer
- Credential theft impact reduction via MFA + JIT + token rotation
- Secret-at-rest confidentiality through envelope encryption
- Detection and response for common identity/runtime threat patterns

Out of scope / constrained in MVP:
- Full SSH keystroke recording (metadata + command audit implemented)
- Complete geo-IP impossible travel intelligence (basic heuristics/rules only)
- Enterprise-grade HA/DR and key custody hardware integration
- Full passkeys/WebAuthn support (TOTP implemented for MVP)

## Notes

- `demo-ssh` container is provided for local PAM target simulation.
- For AWS checks, absence of permissions may result in partial findings.
- All DB access uses Prisma.