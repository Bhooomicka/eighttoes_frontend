# Sentinel Dashboard (Frontend + Backend)

Sentinel is a security operations dashboard with role-based views, alert monitoring, access hygiene workflows, offboarding tracking, credential rotation, and compliance visibility.

## Current Project State

- Frontend is fully usable in frontend-only mode (no backend required).
- Sidebar navigation is split into dedicated pages:
  - Dashboard
  - Users & Accounts
  - Threats
  - Credentials
  - Compliance
  - Settings
- Users & Accounts shows access and assigned tasks (no plaintext passwords displayed in UI).

## Repository Layout

- frontend: React app (CRA + CRACO + Tailwind + Radix UI)
- backend: FastAPI service
- tests, test_reports: backend testing assets
- docs: cloud/deployment documentation

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.10+

## Quick Start (Frontend Only)

This is the recommended mode for local UI development.

1) Install frontend dependencies

	cd frontend
	npm install --legacy-peer-deps

2) Create frontend env file

	Create frontend/.env with:

	REACT_APP_BACKEND_URL=http://localhost:8000

3) Start frontend

	npm start

4) Open app

	http://localhost:3000

## Mock Login (When Backend Is Not Running)

The app automatically falls back to mock authentication if backend login is unavailable.

Mock users:

- Admin: bhooomickadg@gmail.com / 12345
- Team Lead: sarah.lead@company.com / lead123
- Team Member: john.doe@company.com / member123

After login, user identity is persisted locally for greeting/profile display.

## Available Frontend Routes

- /login
- /dashboard
- /users-accounts
- /threats
- /credentials
- /compliance
- /settings

## Backend Setup (Optional)

If you want live API data instead of mock fallback:

1) Create and activate virtual environment

	cd backend
	python3 -m venv venv
	source venv/bin/activate

2) Install requirements

	pip install -r requirements.txt

3) Run API

	uvicorn server:app --reload --port 8000

Note: backend requires environment variables and MongoDB configuration to function end-to-end.

## Key Frontend Behavior

- If backend calls fail, dashboard and auth use local fallback data so the UI stays interactive.
- Theme preference and notification preferences are persisted in localStorage.
- Access Hygiene "Overprivileged Accounts" click works in fallback mode and opens the permission flow modal.

## Troubleshooting

1) Dependency resolution errors during npm install

- Use npm install --legacy-peer-deps

2) Missing module error for ajv/dist/compile/codegen

- Run npm install ajv --legacy-peer-deps

3) Login says success but immediately logs out

- Ensure frontend is using the latest code where mock token/user persistence is enabled.
- Log out and log back in once.

4) Page/component appears blank

- Confirm you are on the correct dedicated route from sidebar.
- Hard refresh browser after route/page updates.

## Development Notes

- Main router/auth providers: frontend/src/App.js
- Dashboard: frontend/src/pages/Dashboard.jsx
- Dedicated pages:
  - frontend/src/pages/UsersAccountsPage.jsx
  - frontend/src/pages/ThreatsPage.jsx
  - frontend/src/pages/CredentialsPage.jsx
  - frontend/src/pages/CompliancePage.jsx
  - frontend/src/pages/SettingsPage.jsx
