# TradeFlow Insights: what users actually see

These pages are intentionally written for people who do not know stock-market jargon.

## 1. My portfolio
Show the value of the user's **current shares**, their historical risk (volatility, beta and drawdown), a hypothetical 5/10/20% market-fall scenario, and a **5- or 20-trading-session value illustration** based on recent historical average returns and volatility. This illustration is **not** an ML prediction, guaranteed outcome, statistical confidence interval or forecast of total account equity. It covers stock holdings only, not uninvested cash.

## 2. Explore a stock
Select one of the supported companies. The chart displays **past historical closing prices**, not ML predictions.

A **Prediction model** selector displays next-session UP estimates from two *separately trained* classifiers:
- Logistic Regression (the original direction model)
- Random Forest (new next-session probability from a model fit on labelled history)

Alongside each estimate, display its own five-fold chronological walk-forward historical accuracy versus the best simple-guess baseline. If its historical advantage does not exceed the rough sampling-noise screen, show an explicit "No convincing advantage" message. Passing the screen **does not** mean probabilities are calibrated, a reliable live forecasting edge is proved, or trading on its signals would be profitable. Both model choices use the same historical stock data; changing the choice switches the actual displayed estimate without executing a trade.

**No exact next-session price is shown.** The previous probability-weighted price illustration was a custom, unvalidated calculation and was removed from the beginner UI. The backend still returns legacy `priceOutlook` fields for compatibility; they should not be presented as independently validated price predictions.

CNN remains a **separate historical comparison experiment**, not a selectable live model, because it has not been fitted for a comparable latest-session forecast.

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
