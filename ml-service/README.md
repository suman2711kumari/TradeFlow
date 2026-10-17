# TradeFlow ML service

FastAPI service. It never downloads data itself: the Node backend fetches candles and sends them in.

| Endpoint | Purpose |
|---|---|
| `GET /health` | Status and whether TensorFlow (CNN) is available |
| `POST /analyze` | Features, expanding-window walk-forward validation (Logistic Regression, Random Forest, naive baselines), edge assessment, cost-aware signal backtest |
| `POST /portfolio-risk` | Volatility, drawdown, VaR/ES, correlation, beta, risk contribution, concentration, 3 stress tests |
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
