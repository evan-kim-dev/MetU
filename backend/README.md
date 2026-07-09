# BudgetTrip AI — FastAPI backend

## Setup
```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # then fill secrets
uvicorn app.main:app --reload --port 8000
```

## Env
- Secrets live only in `backend/.env`
- Next.js talks via `BACKEND_URL` (BFF proxy)

## Layout
- `app/core` — settings & constants
- `app/db` — Supabase singleton
- `app/repositories` — data access only
- `app/services` — OpenAI / business logic
- `app/routers` — HTTP endpoints
