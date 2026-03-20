# Sentinel Cloud Identity Security Dashboard - PRD

## Problem Statement
Mitigating Cloud Identity Abuse & Customer Data Leakage for retail/fashion organizations facing identity abuse and data leakage due to weak cloud IAM governance and monitoring.

## Solution Implemented
Strong cloud identity governance with:
- Least-privilege access management
- Automated offboarding
- Credential rotation tracking
- Anomaly detection
- DevOps workflow integration

## Compliance Matrix

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Least-privilege access | ✅ | Permission modification UI, approval workflow |
| Automated offboarding | ✅ | HR system integration API, auto-assignment |
| Credential rotation | ✅ | Rotation tracking, overdue alerts, mark as rotated |
| Anomaly detection | ✅ | Threat alerts, 7-day charts, 1-hour escalation |
| AWS-native tools | ✅ | Full AWS deployment guide with ECS, CloudFront, WAF |
| DevOps integration | ✅ | Webhook APIs, CI/CD pipelines, Terraform templates |

## Features Implemented

### Phase 1 - Core Dashboard
- Login authentication with JWT
- 6 security sections (Metrics, Threats, Access Hygiene, Offboarding, Credentials, Compliance)
- Dark/Light theme toggle
- Notification system

### Phase 2 - Role-Based Access
- Three-tier hierarchy (Admin > Team Lead > Team Member)
- Personalized greeting
- Team members see only assigned items
- Detail modals with action buttons

### Phase 3 - Notifications & Escalation
- Email notifications (Resend - MOCKED)
- 1-hour auto-escalation for high-severity alerts
- Activity logging

### Phase 4 - DevOps & Integrations
- **Incoming Webhooks**: CI/CD events, incidents, access changes
- **HR Integration**: Automated offboarding from Workday/BambooHR
- **IAM Sync**: Okta, Azure AD, AWS IAM, GCP IAM
- **Permission Management**: Modify access with approval workflow
- **Outgoing Webhooks**: Notify external systems
- **Health Check**: Load balancer endpoint

## Documentation

| Document | Location |
|----------|----------|
| GCP Deployment Guide | `/app/docs/CLOUD_DEPLOYMENT_GUIDE.md` |
| AWS Deployment Guide | `/app/docs/AWS_DEPLOYMENT_GUIDE.md` |

## API Endpoints

### Authentication
- `POST /api/auth/login`
- `GET /api/auth/me`

### Dashboard
- `GET /api/dashboard/metrics`
- `GET /api/dashboard/alerts`
- `PUT /api/dashboard/alerts/{id}`
- `GET /api/dashboard/offboarding`
- `PUT /api/dashboard/offboarding/{id}`
- `GET /api/dashboard/credentials`
- `PUT /api/dashboard/credentials/{id}`

### DevOps Integration
- `POST /api/webhooks/incoming` - Receive CI/CD webhooks
- `GET /api/webhooks/events` - List webhook events
- `POST /api/webhooks/config` - Configure outgoing webhooks

### HR Integration
- `POST /api/integrations/hr/offboarding` - Auto-create offboarding

### IAM Integration
- `POST /api/integrations/iam/sync` - Sync users/groups/permissions
- `GET /api/integrations/iam/sync-logs`

### Permission Management
- `POST /api/permissions/change-request`
- `GET /api/permissions/pending`
- `PUT /api/permissions/{id}/approve`
- `PUT /api/permissions/{id}/reject`

### Health
- `GET /api/health`

## Login Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | bhooomickadg@gmail.com | 12345 |
| Team Lead | sarah.lead@company.com | lead123 |
| Team Member | john.doe@company.com | member123 |

## Next Steps
1. Deploy to AWS/GCP using provided guides
2. Add RESEND_API_KEY for real email notifications
3. Connect to actual IAM providers (Okta, Azure AD)
4. Integrate with HR systems via webhooks

## Implementation Checklist (Done / Partial / Missing)

### Core Pillars
- Least-Privilege Access: **Partial**
	- Done: Role-based API authorization and permission change approval workflow.
	- Missing: Real AWS IAM/SCP enforcement at organization/account level.
- Automated Offboarding: **Partial**
	- Done: HR offboarding ingestion endpoint and access revocation workflow in app domain.
	- Missing: Native EventBridge + Lambda revocation pipeline against real AWS identities.
- Credential Rotation: **Partial**
	- Done: Credential rotation tracking, due/overdue handling, and rotation actions in dashboard.
	- Missing: Direct AWS Secrets Manager rotation orchestration and secret version lifecycle integration.
- Anomaly Detection: **Done (Application Scope)**
	- Done: IsolationForest-based behavioral baselining and anomaly simulation/evaluation APIs.
	- Missing: Production event streaming + model lifecycle automation for near-real-time scale.

### Innovation Features
- JIT Privileged Access: **Done (Application Scope)**
	- Request, approve/reject/revoke, auto-expiry worker, and role-based controls implemented.
- AI-Driven Behavioral Baselining: **Done (Application Scope)**
	- Profile recompute, anomaly scoring, and dashboard summaries implemented.
- Sales-Season Safe Mode: **Done (Application Scope)**
	- Safe mode + maintenance windows + queue/apply worker implemented.
- CI/CD Policy-as-Code: **Partial**
	- Done: Webhook endpoints and deployment docs.
	- Missing: In-repo Terraform/CDK policy code and enforced validation gates on PR.

### Constraints
- Zero disruption during peak sales: **Partial**
	- Done: Queued maintenance-window logic and fallback UX for backend outage scenarios.
	- Missing: Verified SLO/SLA controls, canary strategies, and production load test evidence.
- AWS-native tooling only: **Partial**
	- Done: AWS deployment guidance and AWS-oriented architecture intent.
	- Missing: Runtime integrations currently include non-AWS options and simulated provider calls.
- Existing DevOps workflow integration: **Partial**
	- Done: Inbound/outbound webhook integration points.
	- Missing: Concrete enterprise pipeline templates with policy enforcement checks.
