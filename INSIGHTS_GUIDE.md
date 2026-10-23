# TradeFlow Insights: what users actually see

These pages are intentionally written for people who do not know stock-market jargon.

## 1. My portfolio
Show the value of the user's **current shares**, their historical risk (volatility, beta and drawdown), a hypothetical 5/10/20% market-fall scenario, and a **5- or 20-trading-session value illustration** based on recent historical average returns and volatility. This illustration is **not** an ML prediction, guaranteed outcome, statistical confidence interval or forecast of total account equity. It covers stock holdings only, not uninvested cash.

## 2. Explore a stock
Select one of the 20 supported NSE companies. See historical closing prices, an experimental **next-session direction probability** (Logistic Regression, scikit-learn), a price illustration combining its direction probability with historical average UP/DOWN moves, and a band based on one recent daily standard deviation. A classification model **cannot** independently forecast a precise market price. If historical accuracy failed to beat simple guesses, do not trust the estimate. The illustration is not an investment target, confidence interval or advice.

## 3. Test a trading idea
20-day versus 50-day simple moving-average backtest, with assumed 0.1% per-side costs, compared to a buy-once-and-hold approach. It examines the past, not the future, and doesn't make account trades.

## 4. How we checked
Optional accuracy table for Logistic Regression and Random Forest (5 chronological walk-forward folds versus simple baselines) and 1D CNN (separate chronological 60/20/20 evaluation, same unseen test rows for CNN comparisons). Keeps the resume evidence without requiring nontechnical users to understand model architectures.

## 5. Gemini
The existing AI assistant reads portfolio/research results using server-side tools and explains them. It is read-only and cannot buy or sell.

## Resume truth
- MERN virtual trading, server-side Yahoo quote fetch, conditional MongoDB cash update.
- Python historical risk: volatility, beta, drawdown; moving-average strategy backtester.
- Scikit-learn Logistic Regression and Random Forest walk-forward evaluation; separate TensorFlow 1D CNN experiment; read-only Gemini.

### Boundaries
This project never promises future prices or reliable profits. Yahoo data can be delayed. Cash, charges and order execution are simplified. These are student-built educational tools, not brokerage services.

### Testing checklist
- Buy a paper stock, then open My portfolio: current value and risk should display.
- Change hypothetical market fall between 5/10/20%; results should update.
- Switch 5/20 trading-day illustrations and confirm values change.
- Explore TCS or M&M: historical prices, direction probability, price illustration and accuracy should be visible.
- Test a trading idea: results should compare a strategy against holding.
- How we checked: classical models should work without TensorFlow, and CNN should display a helpful error if TensorFlow is missing.
- Gemini is optional and requires its API key.
