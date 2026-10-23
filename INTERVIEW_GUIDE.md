# TradeFlow interview guide

## Explain it in 60-90 seconds

"TradeFlow is a paper-trading website built using React, Express, Node.js and MongoDB. Users sign in, view stock prices, and buy or sell using virtual money. My backend checks stock quantity and available balance and records orders and holdings in MongoDB. Prices are fetched by the backend from Yahoo Finance. I also added a separate FastAPI Python service to analyse historical risk, compare a 20-day and 50-day moving-average trading rule against buy-and-hold, and evaluate Logistic Regression and Random Forest using walk-forward validation. I compared these with an optional 1D CNN experiment and integrated Gemini to explain account information through read-only tools. It's a learning application, not a real broker or a guaranteed prediction system."

## 1. Buy order: tell the story in five steps

1. The React Buy button sends a symbol, quantity and BUY mode to Express.
2. Express confirms the user identity and validates the inputs.
3. The backend fetches the stock quote, rather than trusting a browser-supplied price.
4. MongoDB reduces available cash only if enough cash remains. Holdings quantity and average cost are updated and an order is recorded.
5. The dashboard reloads cash, holdings and order history.

**Concurrency:** If cash = Rs 1000 and two requests each need Rs 800, the atomic conditional cash update allows only one debit. On MongoDB Atlas/replica set, a multi-document transaction also groups order and holding changes. Standalone MongoDB uses compensation, not an equivalent transaction guarantee.

## 2. Risk: only three terms are essential

- **Volatility:** how widely prices have moved historically; calculated using daily returns.
- **Beta:** how much stock/portfolio returns tend to move with a market benchmark, here NIFTY 50. Beta is not a guarantee.
- **Drawdown:** the largest percentage fall from a past peak to a later trough.

The risk engine uses the **current holdings** and approximately one year of historical market returns. It does not model the user's actual past account history.

## 3. Moving-average backtest

The strategy compares a **20-day Simple Moving Average** with a **50-day Simple Moving Average**. When the shorter average exceeds the longer one, the simulation holds the stock; otherwise it stays in cash. The backtest is compared with **buy-and-hold** (purchase once, then keep the stock). The simulator includes an assumed per-side cost of **0.1%**, not actual brokerage and taxes. A previous-day signal is used to avoid looking ahead.

## 4. ML: what you should be able to answer

**Input:** Historical stock prices transformed into returns, momentum, moving-average gaps, RSI and recent volatility.

**Output:** A binary class: whether the next session's close goes UP or DOWN, not the exact future price.

**Logistic Regression:** A simple model for estimating the probability of one of two classes.

**Random Forest:** Multiple decision trees whose predictions are combined.

**Walk-forward evaluation:** Train on older sessions, test on later unseen sessions, expand the training period, and repeat. StandardScaler is inside the training pipeline, so test rows do not influence its fitted parameters.

**Baselines:** Simple references such as 'always predict UP'. A complex model must do better than this before we call it useful.

**CNN experiment:** A small 1D convolutional network reads rolling 30-session feature windows. This experiment uses a **chronological 60/20/20 split**, and the CNN is compared against simpler models on the **same CNN test interval**. Do not claim it uses the five-fold evaluation above.

**Likely result:** Stock-direction classification can be near chance; that is a valid finding. No reliable profit or accuracy should be claimed without evidence.

## 5. Gemini assistant

The React chat sends a question to Express. The backend can call a small set of **read-only functions** to retrieve the authenticated user's portfolio and analytical results. Gemini explains those returned values in human language. It has **no order-placement function**. You integrated an API; you did **not** train Gemini.

## Honest answers to tricky questions

**Is it a real Zerodha alternative?** No. It's simulated paper trading. It does not match exchange orders, perform settlement, or enforce all exchange rules.

**Why MongoDB?** It works naturally with the MERN stack through Mongoose. For financial ledgers at production scale, a transactional relational database may also be appropriate.

**Why two backends?** Node handles accounts and orders; Python uses mature data-science libraries to calculate risk and evaluate models. They communicate over REST.

**What if market data is delayed?** TradeFlow uses external quotes and may receive delayed or cached prices. The fills are simplified and are not executable exchange prices.

**Is the AI safe?** The tools are read-only and user-scoped, but LLM answers can still be incorrect. The user should cross-check the displayed figures.

**What would you improve next?** First fix live trading-hours validation, stronger transaction guarantees, price timestamp/freshness rules, proper accounting and more rigorous trading-cost simulation. I would not add another ML model before these changes.

## Before showing this in an interview

1. Be able to run the frontend, backend and Python service.
2. Sign up, buy one stock, see the balance decrease, then sell part of it.
3. Demonstrate the three Insights tabs: risk, backtest, model comparison.
4. If TensorFlow isn't installed, explain it as an optional experiment instead of faking a CNN result.
5. If Gemini isn't configured, show the architecture and explain that an API key is required.
6. Do not say any feature was manually developed by you unless you can explain and substantiate the work. Discuss your actual contributions accurately.
