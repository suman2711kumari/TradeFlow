# TradeFlow (fresher-friendly branch)

**TradeFlow is a MERN paper-trading website with Python analysis and a read-only Gemini assistant.**
It uses simulated money and external market prices. It is **not** a real brokerage or investment-advice product.

This branch intentionally keeps the features named in the resume and simplifies the dashboard's **Insights** page to three sections.

## Features

1. **Paper trading (MERN):** register/log in, watchlist, virtual funds, buy/sell, orders, holdings and simulated profit/loss. The server obtains the price; it does not trust a price submitted by the browser. A conditional MongoDB update rejects a BUY when available cash is insufficient. A MongoDB replica set also enables multi-document transactions. Local standalone MongoDB uses best-effort compensating steps, which are not the same as true transactions.
2. **Python risk engine:** FastAPI + pandas/NumPy calculate historical **volatility**, **beta vs NIFTY 50**, and **maximum drawdown** for the stocks held now.
3. **Moving-average backtest:** one understandable rule, 20-day SMA vs 50-day SMA, using past prices and comparing the result with buy-and-hold. A simplified **0.1% per-side** cost is assumed, not actual taxes/brokerage.
4. **ML comparison:** Logistic Regression and Random Forest evaluated with expanding-window walk-forward validation against simple baselines. Optional TensorFlow 1D CNN is compared on a **separate chronological train/validation/test split**, not the five walk-forward folds.
5. **Gemini assistant:** explains results using server-side read-only tools; it cannot trade.

## Architecture

```
React dashboard + landing page
           |
           v
    Node.js + Express ---> MongoDB (users, cash, holdings, orders)
           |
           +---> Yahoo Finance price/history data (may be delayed)
           |
           +---> Python FastAPI ---> pandas, NumPy, scikit-learn, optional TensorFlow
           |
           +---> Gemini API (read-only assistant)
```

## Running locally (Windows / PowerShell)

Install Node.js, MongoDB and Python 3.10-3.13. Copy **backend/.env.example** to **backend/.env**, and set **MONGO_URL** and **JWT_SECRET**. Add **GEMINI_API_KEY** only if using the assistant. Use separate terminals in the project root:

```powershell
cd backend
npm install
npm start
```

```powershell
cd ml-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

```powershell
cd dashboard
npm install
npm start
```

```powershell
cd frontend
npm install
$env:PORT=3001; npm start
```

Open **http://localhost:3001** (landing) or **http://localhost:3000** (dashboard after login).
The development OTP appears in the backend terminal; SMS delivery is **not implemented**.
To run the optional CNN experiment, install `pip install -r requirements-cnn.txt` inside the Python environment and restart FastAPI.

## Three resume bullets this branch demonstrates

- Built a MERN paper-trading app with server-side market-price fetching and conditional balance updates for stock purchases.
- Developed a Python risk engine covering volatility, beta and drawdown, plus a moving-average backtester.
- Evaluated Logistic Regression and Random Forest using walk-forward validation, compared them with a 1D CNN, and integrated a read-only Gemini AI assistant.

## What the project does NOT claim

- It **does not** place real exchange orders, handle live matching or charge real brokerage fees.
- Yahoo prices are external and can be **delayed**. Instant simulated fill is an educational shortcut. No market-hours check or partial fills.
- No guaranteed profit, price forecasts, model superiority or personalized investment advice.
- Historical risk represents **today's holdings replayed on past prices**, not the user's historical account evolution.
- Without MongoDB replica-set transactions, multi-document order consistency is **not guaranteed**.
- The ML signal simulation is simplified and is not proof of a deployable trading strategy.

## Code map

| Where | Why |
| --- | --- |
| `dashboard/src/components/ResearchLab.js` | Three clearly named analysis tabs |
| `dashboard/src/components/research/` | Simple React pages for risk, backtesting and models |
| `backend/services/orderService.js` | Server-priced order and conditional cash check |
| `backend/services/marketData.js` | Yahoo Finance fetching and caching |
| `backend/services/portfolioService.js` | Connects user's holdings with Python risk calculation |
| `backend/services/agent.js` | Gemini assistant, limited to read-only data operations |
| `ml-service/app/portfolio.py` | Risk formulas |
| `ml-service/app/backtest.py` | Moving-average simulation |
| `ml-service/app/analysis.py` | Classical ML, evaluation and simplified signal test |
| `ml-service/app/cnn.py` | Optional 1D CNN comparison |

Read **INTERVIEW_GUIDE.md** before presenting the project. The main branch has not been edited.
