# TradeFlow

A Zerodha-inspired **paper-trading platform** (simulated money, no real orders) with a research workspace:
portfolio risk from real market history, a cost-aware strategy backtester, honest ML evaluation, a 1D CNN experiment, and a tool-calling AI assistant.

| Layer | What it does |
|---|---|
| `dashboard/` (React) | Trading UI, Research Lab (4 tabs), AI Assistant page |
| `backend/` (Node, Express, MongoDB) | Auth, orders, holdings, funds, server-side market prices, agent orchestration |
| `ml-service/` (Python, FastAPI) | Walk-forward ML, portfolio risk, backtester, 1D CNN |
| `frontend/` | Landing / signup site |

## Run it

**1. Backend**
```bash
cd backend
cp .env.example .env        # then edit: MONGO_URL, JWT_SECRET, optionally ANTHROPIC_API_KEY
npm install
npm start                   # http://localhost:3002
```

**2. ML service** (Python 3.10 to 3.13)
```bash
cd ml-service
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-cnn.txt                    # optional: only for the CNN tab (~250 MB)
uvicorn app.main:app --port 8000
```

**3. Dashboard**
```bash
cd dashboard && npm install && npm start               # http://localhost:3000
```

**AI Assistant:** put `ANTHROPIC_API_KEY=...` in `backend/.env`. Without it everything else works and the assistant page explains what to add.

## Tests
```bash
cd backend && npm test                                  # 22 tests: order engine, rollback, agent loop, rate limit
cd ml-service && pip install -r requirements-dev.txt && python -m pytest   # 20 tests
```

## Key design decisions (good interview material)
- **Prices come from the server.** Orders execute at a live quote fetched by the backend; a price sent by the browser is ignored.
- **Orders are safe.** Cash is debited with an atomic conditional update; with a replica set (Atlas) everything runs in a MongoDB transaction, on a standalone local MongoDB each step has a rollback.
- **Risk uses market history, not user history.** Today's holdings are replayed through one year of actual prices of those stocks, so it works from the first trade.
- **Walk-forward validation, baselines and a noise margin.** A model is only said to have an edge if it beats naive baselines by more than statistical noise.
- **The agent never invents numbers.** The LLM picks read-only tools, the server runs them for the authenticated user, and the UI shows every tool call and its data.

See `PHASE5_CHANGES.md` for exactly what changed and what is still limited.
