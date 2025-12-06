---
description: Start both frontend dev server and backend converter service
---

# Start Dev Environment

This workflow starts both the frontend Vite dev server and the backend converter API.

// turbo-all

## Steps

1. Start the frontend dev server (if not already running):
```bash
cd /Users/aaryan/Documents/frontend_lawjurist/frontend_antigravity
lsof -ti:5173 | xargs kill -9 2>/dev/null; npm run dev
```

2. Start the backend converter server:
```bash
cd /Users/aaryan/Documents/frontend_lawjurist/frontend_antigravity/backend/backend/converter
source .venv/bin/activate && uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## Verify Services

- Frontend: http://localhost:5173
- Converter API: http://localhost:8000 (should return `{"ok":true,"service":"converter"}`)

## File Upload Flow

When using "Upload your Draft" feature:
1. Frontend sends file to `POST http://localhost:8000/convert`
2. Converter transforms PDF/DOCX/RTF to HTML
3. HTML is returned and displayed in Editor
