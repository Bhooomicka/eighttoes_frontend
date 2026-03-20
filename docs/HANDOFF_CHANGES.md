# Sentinel Handoff Notes

## What Was Changed

### 1. Environment and setup
- Installed frontend dependencies in `frontend/`.
- Created backend virtual environment at `backend/.venv` and installed Python requirements.
- Added local env files for local development:
  - `backend/.env`
  - `frontend/.env`
- Installed and started local MongoDB (`mongodb-community@7.0`) for backend startup.

### 2. Backend/frontend connectivity
- Verified backend health endpoint and MongoDB connectivity.
- Verified CORS from `http://localhost:3000` to backend.
- Verified login endpoint works and returns JWT.

### 3. Frontend hardening changes
- Removed plaintext mock passwords from frontend fallback user map.
- Preserved mock/fallback login behavior using email-based mapping.
- Added offline-safe fallback behavior for panels that previously failed loudly when backend was unavailable:
  - JIT Access panel
  - Operations panel
  - Behavioral Baselining panel
- Added localStorage-backed fallback state for those panels.
- Added explicit mock-session (`mock-token-12345`) handling so these panels do not attempt live API calls in mock mode and do not raise repeated red failure toasts.
- In mock mode, panel actions/load/save run locally and show success messages tagged as mock/offline behavior.

### 4. Documentation/status updates
- Added implementation status checklist (Done/Partial/Missing) to `memory/PRD.md`.

### 5. Ignore rules cleanup
- Cleaned and normalized `.gitignore`.
- Removed duplicate/corrupted entries.
- Added clear ignore patterns for Python venv/build/cache/env files and frontend artifacts.

## Files Updated
- `.gitignore`
- `frontend/src/App.js`
- `frontend/src/components/dashboard/JITAccessPanel.jsx`
- `frontend/src/components/dashboard/OperationsPanel.jsx`
- `frontend/src/components/dashboard/BehaviorBaseliningPanel.jsx`
- `memory/PRD.md`
- `docs/HANDOFF_CHANGES.md` (this file)

## Local Run Steps For Your Friend

### 1. Start MongoDB
```bash
brew services start mongodb-community@7.0
```

### 2. Start backend
```bash
cd /Users/bhooomickadg/Documents/GitHub/eighttoes_frontend/backend
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000
```

### 3. Start frontend
```bash
cd /Users/bhooomickadg/Documents/GitHub/eighttoes_frontend/frontend
npm start
```

## Quick Validation URLs
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/api/health`
- Backend docs: `http://localhost:8000/docs`

## Build Commands
- Frontend build:
```bash
cd /Users/bhooomickadg/Documents/GitHub/eighttoes_frontend/frontend
npm run build
```
- Backend does not use npm. It is Python/FastAPI.

## Notes
- If backend is down, dashboard still works in fallback mode and critical panels now use local offline behavior.
- If using yarn lock policy in your team, review `frontend/yarn.lock` before commit.
