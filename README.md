# nexus-test-dashboard

Test runner visual dashboard. Puerto 8003.

## Levantar

```bash
# Backend
pip install -r requirements.txt
python server.py

# Frontend (dev con hot reload)
cd frontend && pnpm install && pnpm dev
# → http://localhost:5174 (proxy a backend 8003)

# O build + servir desde FastAPI
cd frontend && pnpm build
python server.py
# → http://localhost:8003
```

## Stack

- Backend: FastAPI + uvicorn (Python)
- Frontend: Vite + React + TypeScript
- Puerto backend: 8003
- Puerto frontend dev: 5174
