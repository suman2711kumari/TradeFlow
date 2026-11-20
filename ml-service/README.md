# TradeFlow ML service

FastAPI service. It never downloads data itself: the Node backend fetches candles and sends them in.

| Endpoint | Purpose |
|---|---|
| `GET /health` | Status and whether TensorFlow (CNN) is available |
| `POST /analyze` | Historical features, expanding-window walk-forward evaluation (Logistic Regression, Random Forest and naive baselines), plus an experimental next-session UP / NOT_UP classification |
| `POST /portfolio-risk` | Current-weight portfolio volatility, beta, maximum drawdown, historical VaR/ES, correlation, diversification, risk contribution, concentration and market-fall scenarios |
| `POST /backtest` | Moving-average crossover vs buy-and-hold with transaction costs |
| `POST /cnn-compare` | 1D CNN vs classical models on identical chronological test rows (needs `requirements-cnn.txt`) |

```bash
pip install -r requirements.txt            # core
pip install -r requirements-cnn.txt        # optional CNN
pip install -r requirements-dev.txt        # tests
uvicorn app.main:app --port 8000
python -m pytest
```

Interactive API docs: http://127.0.0.1:8000/docs
