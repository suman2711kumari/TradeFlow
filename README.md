# TradeFlow

**A Zerodha-inspired paper-trading platform with a plain-language research and risk layer.**
Users trade with *simulated money* at live market prices, then check how risky their portfolio is, test a simple trading idea on past prices, and ask an AI assistant questions in English or Hindi.

> Educational project. No real money, no real orders, and nothing here is investment advice.

---

## Contents
1. [Features](#features)
2. [Tech stack and where each library is used](#tech-stack-and-where-each-library-is-used)
3. [Architecture](#architecture)
4. [Project structure](#project-structure)
5. [Setup and run (VS Code)](#setup-and-run-vs-code)
6. [Environment variables](#environment-variables)
7. [API overview](#api-overview)
8. [Maths used](#maths-used)
9. [How the ML is evaluated (honestly)](#how-the-ml-is-evaluated-honestly)
10. [Testing](#testing)
11. [Limitations](#limitations)
12. [Future improvements](#future-improvements)
13. [Troubleshooting](#troubleshooting)

---

## Features

**Trading core (MERN)**
- Sign up and log in (OTP step plus JWT cookie), watchlist with live prices, buy and sell, holdings, positions, orders and funds.
- **Server-side prices:** the backend fetches the live quote and executes at that price. A price sent by the browser is ignored.
- **Safe orders:** cash is debited with an atomic conditional update, so two simultaneous clicks cannot spend the same money. With a MongoDB replica set (Atlas) every order runs inside a transaction. On a standalone local MongoDB, each step has a rollback.
- Holdings are priced from live quotes. P&L, day change and averages are computed from real data, not hardcoded.

**Insights page** (written for beginners; technical detail is tucked away)
| Tab | What the user sees |
|---|---|
| My portfolio health | Risk level (Low / Medium / High), "what if the market falls X%?" in rupees, which stock causes most of the risk, plain warnings |
| Check a stock | Price, 6-month chart, past-year change, ups and downs label, biggest recent fall |
| What-if tester | "If I had followed a simple rule": result in rupees versus just holding, growth chart, trades, charges |
| Advanced lab | Model scorecard (accuracy, precision, recall, confusion matrix), per-period results, 1D CNN experiment. Every technical term has a "?" explanation |

**AI Assistant** (English / हिन्दी switch)
- A tool-calling agent on the Gemini API. It picks from six **read-only** tools, the server runs them for the logged-in user, and the model explains the real results in simple words.
- The chat shows which checks were run and the data they returned. The assistant cannot place orders.

---

## Tech stack and where each library is used

| Layer | Technology | Used for |
|---|---|---|
| Frontend | React, Chart.js, MUI icons | Dashboard, Insights, chat |
| Backend | Node.js, Express, Mongoose | Auth, orders, holdings, funds, price fetching, agent orchestration |
| Database | MongoDB | Users, holdings, orders, funds |
| Market data | `yahoo-finance2` (npm) | Daily candles and live quotes |
| ML service | Python, FastAPI, Uvicorn | REST endpoints called by the Node backend |
| **pandas / NumPy** | `ml-service/app/*.py` | Cleaning candles, rolling windows, returns, covariance matrix, drawdown, backtest maths |
| **scikit-learn** | `analysis.py`, `common.py`, `cnn.py` | Logistic Regression and Random Forest (`analysis.py`), `StandardScaler` in a Pipeline (`analysis.py`), accuracy / precision / recall / F1 (`common.py`); the same two models are reused as comparison baselines in `cnn.py` |
| **TensorFlow / Keras** | `cnn.py` only (optional install) | The 1D CNN: `Conv1D`, `MaxPooling1D`, `GlobalAveragePooling1D`, `Dropout`, `Dense`, Adam optimiser, early stopping |
| AI | Google Gemini API (plain `fetch`) | The assistant's reasoning and wording |

In short: **pandas/NumPy** prepare data and do the maths, **scikit-learn** provides the classical ML models and scoring, and **TensorFlow** is used only for the deep-learning experiment.

---

## Architecture

```
React dashboard (port 3000)  ──►  Express API (port 3002)  ──►  MongoDB
                                      │   │
                                      │   └──►  Yahoo Finance (prices, history)
                                      │
                                      ├──►  Python ML service (port 8000)
                                      │       pandas · scikit-learn · TensorFlow
                                      │
                                      └──►  Gemini API (assistant; calls the tools above)
```

- Node fetches market data and sends it to Python, which only does analysis and returns JSON.
- The assistant's tools call the same backend functions as the screens, so its numbers match what you see in the app.

---

## Project structure

```
TradeFlow/
├── frontend/          Landing and signup site (port 3001)
├── dashboard/         React app (port 3000)
│   └── src/components/
│       ├── Holdings.js, Orders.js, Positions.js, Funds.js, WatchList.js, ...
│       ├── ResearchLab.js          Insights page (4 tabs)
│       ├── AgentChat.js            AI assistant with English / Hindi switch
│       └── research/               PortfolioRisk, StockAnalysis, Backtest, AdvancedLab, ModelLab, shared (help tips)
├── backend/
│   ├── controllers/ routes/ model/ schemas/
│   ├── services/
│   │   ├── marketData.js           Yahoo Finance + caching
│   │   ├── orderService.js         Safe order execution
│   │   ├── portfolioService.js     Live-priced holdings, positions, risk
│   │   ├── analysisService.js      Stock analysis, backtest, CNN calls
│   │   ├── agent.js, agentTools.js Tool-calling assistant
│   │   └── mlClient.js, rateLimit.js, dbCapabilities.js
│   └── test/                       Node tests
└── ml-service/
    ├── app/
    │   ├── common.py               Features and metrics
    │   ├── analysis.py             Walk-forward ML (Logistic Regression, Random Forest)
    │   ├── portfolio.py            Portfolio risk and stress tests
    │   ├── backtest.py             Moving-average crossover backtester
    │   └── cnn.py                  1D CNN experiment
    └── tests/                      Python tests
```

---

## Setup and run (VS Code)

**Install first:** Node.js 18+, Python 3.10 to 3.13, and MongoDB (a free MongoDB Atlas cluster is easiest and enables order transactions; add your IP under Network Access).

Open the project folder in VS Code and use four terminals (Terminal → New Terminal).

**1. Backend**
```bash
cd backend
copy .env.example .env        # macOS/Linux: cp .env.example .env
npm install
npm start                     # http://localhost:3002
```
Edit `.env` first (see the next section).

**2. ML service**
```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-cnn.txt   # optional: TensorFlow for the CNN tab (~250 MB)
uvicorn app.main:app --port 8000
```
Health check: http://127.0.0.1:8000/health. If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope Process Bypass` first.

**3. Dashboard**
```bash
cd dashboard
npm install
npm start                     # http://localhost:3000
```

**4. Landing site** (must use port 3001, because login redirects to the dashboard on 3000)
```bash
cd frontend
npm install
$env:PORT=3001; npm start     # cmd: set PORT=3001&&npm start   |   macOS/Linux: PORT=3001 npm start
```

Open http://localhost:3001 and sign up. The OTP is a development placeholder: it is printed in the backend terminal, not sent by SMS.

---

## Environment variables

`backend/.env`

| Variable | Purpose |
|---|---|
| `MONGO_URL` | MongoDB connection string |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `ML_SERVICE_URL` | Default `http://127.0.0.1:8000` |
| `GEMINI_API_KEY` | Key from Google AI Studio. Without it only the AI Assistant page is disabled |
| `GEMINI_MODEL` | Optional. Default `gemini-3.5-flash`. Use a model your key can access |
| `AGENT_REQUESTS_PER_HOUR` | Optional per-user limit, default 20 |
| `MONGO_USE_TRANSACTIONS` | Optional. Set `false` to skip transactions |

Never commit `.env` or share your API key.

---

## API overview

| Route | Method | Description |
|---|---|---|
| `/api/allOrders/newOrder` | POST | Place a paper trade: `{ name, qty, mode }` (price is set by the server) |
| `/api/allOrders` | GET | Order history |
| `/api/allHoldings` | GET | Holdings priced at live quotes |
| `/api/allPositions` | GET | Today's trading activity |
| `/api/funds` | GET | Available cash |
| `/api/market/quotes`, `/api/market/indices` | GET | Watchlist quotes and indices |
| `/api/research/portfolio-risk?shockPct=-5` | GET | Portfolio risk report and stress test |
| `/api/research/analyze?symbol=TCS` | GET | Walk-forward model comparison |
| `/api/research/backtest?symbol=TCS&fast=20&slow=50&years=3&costBps=10` | GET | Strategy backtest |
| `/api/research/cnn?symbol=TCS` | GET | CNN vs classical models |
| `/api/agent/chat` | POST | `{ messages, language: "en" \| "hi" }` |

Python service: `/health`, `/analyze`, `/portfolio-risk`, `/backtest`, `/cnn-compare` (interactive docs at `/docs`).

---

## Maths used

| Quantity | Formula |
|---|---|
| Daily return | `r = (P_t − P_(t−1)) / P_(t−1)` |
| Day change % | `(price − previous close) / previous close × 100` |
| Average price after buying more | `(q1·p1 + q2·p2) / (q1 + q2)` |
| Unrealised P&L | `(current price − average price) × quantity` |
| Annualised volatility | `std(daily returns) × √252` |
| Portfolio volatility | `σp = √(wᵀ Σ w)`, Σ is the covariance matrix × 252 |
| Risk contribution of stock i | `w_i · (Σw)_i / σp²` (sums to 100%) |
| Beta | `Cov(stock, market) / Var(market)` (market = NIFTY 50) |
| Max drawdown | worst `(trough − peak) / peak` of the equity curve |
| Historical VaR (95%) | 5th percentile of daily portfolio returns |
| Expected shortfall | average return on days at or below that percentile |
| Concentration (HHI) | `Σ w²`; effective number of stocks `= 1 / HHI` |
| Sharpe ratio (risk-free = 0) | `mean(r) / std(r) × √252` |
| CAGR | `(final / initial)^(1/years) − 1` |
| SMA crossover | long when SMA(fast) > SMA(slow), using the previous day's signal |
| RSI (14) | `100 − 100 / (1 + average gain / average loss)` |
| Precision / Recall / F1 | `TP/(TP+FP)`, `TP/(TP+FN)`, `2PR/(P+R)` |
| Noise margin on accuracy | `2 · √(0.25 / n)` |

Stress tests: *uniform* shock `value × shock`; *beta-adjusted* each stock moves `β × market shock`; *historical* replay of the worst day and worst five days of the current portfolio.

---

## How the ML is evaluated (honestly)

- **Question:** will tomorrow's close be higher than today's? Features use only data up to the current day.
- **Walk-forward validation:** 5 expanding folds, always training on the past and testing on the next unseen block, with a one-day gap. The scaler is fitted on training data only.
- **Baselines:** "always up" and "majority class of the training data". A model must beat them by more than the noise margin before the app says it has an edge.
- **1D CNN:** 30-day windows of 6 features, `Conv1D → MaxPool → Conv1D → MaxPool → GlobalAvgPool → Dropout → Dense`, trained with early stopping and judged on the same unseen test rows as the other models.
- **Typical result:** on most stocks the models do not clearly beat the baselines. Daily price moves are mostly noise, and the app reports this instead of hiding it.

The only forward-looking output is the next-day probability. The app does not predict future prices.

---

## Testing

```bash
cd backend && npm test                                   # order engine, rollback, double-spend race, agent loop
cd ml-service && pip install -r requirements-dev.txt && python -m pytest
cd dashboard && npm test -- --watchAll=false             # renders every Insights screen with real API output
```

Not covered by automated tests: real Yahoo responses, a live MongoDB, and the live Gemini API (the agent is tested against a fake server).

---

## Limitations

- Cash-equity paper trading with **market orders only**, for 20 stocks.
- No limit, stop-loss or bracket orders, margin or leverage, futures and options, short selling, market depth, or trading-hours check.
- Free, delayed Yahoo data. Orders fill instantly at that price, with no slippage or partial fills.
- Backtest charges are a flat 0.1% per trade, not real brokerage and taxes.
- Adjustment of prices for splits, bonuses and dividends has not been verified.
- Risk figures describe about one year of the past and assume constant weights.
- On a standalone local MongoDB, order safety relies on rollback steps instead of true transactions.
- Backtests use today's 20 large companies, which introduces survivorship bias.

---

## Future improvements

- Limit, stop-loss and bracket orders with a background matching job and reserved cash; market-hours rules.
- A full instrument master (symbol, name, sector, ISIN) with search, and a licensed real-time data feed with WebSockets.
- Adjusted prices for corporate actions, fundamentals (P/E and others), real brokerage and tax calculation.
- Gradient-boosted models, probability calibration, scheduled retraining with drift monitoring.
- Monte Carlo simulation and portfolio optimisation.
- Redis for caching and rate limits, background workers for heavy training, Docker and CI.
- A confirm-before-action step if the assistant is ever allowed to place orders.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "The Python ML service is not reachable" | Start `uvicorn app.main:app --port 8000` in `ml-service` |
| "Live market price unavailable" | The backend could not reach Yahoo Finance. Check your internet connection and retry |
| MongoDB connection error | Check `MONGO_URL`; for Atlas, add your IP under Network Access |
| CNN tab says TensorFlow is not installed | `pip install -r requirements-cnn.txt`, then restart uvicorn |
| Assistant says the model was not found | Set `GEMINI_MODEL` to a model your key can use (list them in Google AI Studio) |
| Assistant says the key was rejected | Check `GEMINI_API_KEY` in `backend/.env` and restart the backend |
| Duplicate holdings in old data | The unique (user, symbol) index cannot build; merge the duplicate rows once |
| Landing page redirects to the wrong port | Run the landing site on port 3001 and the dashboard on 3000 |

---

*Built as a learning project. Paper trading only.*