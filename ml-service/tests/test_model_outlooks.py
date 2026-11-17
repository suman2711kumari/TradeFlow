from app.analysis import AnalysisRequest, analyze
from app.common import Candle
from tests.conftest import make_quotes


def test_analysis_returns_real_live_predictions_for_both_classical_models():
    history = [Candle(**q) for q in make_quotes(n=760, seed=19)]
    result = analyze(AnalysisRequest(symbol="TCS.NS", quotes=history))

    choices = result["modelOutlooks"]
    assert {"logisticRegression", "randomForest", "cnn"} <= set(choices)
    by_name = {m["model"]: m for m in result["walkForward"]["summary"]}
    for key, model_name in (("logisticRegression", "Logistic Regression"), ("randomForest", "Random Forest")):
        choice = choices[key]
        assert choice["available"] is True
        assert choice["model"] == model_name
        assert choice["direction"] in {"UP", "NOT_UP"}
        assert 0 <= choice["probabilityUpPct"] <= 100
        assert choice["evaluationAccuracyPct"] == by_name[model_name]["accuracyPct"]
        assert choice["baselineAccuracyPct"] >= 0
        assert "walk-forward" in choice["evaluationLabel"]

    assert choices["logisticRegression"]["probabilityUpPct"] == result["prediction"]["probabilityUpPct"]
    assert choices["cnn"]["model"] == "1D CNN"
    if choices["cnn"]["available"]:
        assert choices["cnn"]["direction"] in {"UP", "NOT_UP"}
        assert 0 <= choices["cnn"]["probabilityUpPct"] <= 100
        assert 0 <= choices["cnn"]["evaluationAccuracyPct"] <= 100
