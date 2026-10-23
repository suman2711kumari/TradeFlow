from app.analysis import AnalysisRequest, analyze
from app.common import Candle
from tests.conftest import make_quotes


def test_two_selected_classifiers_have_real_probabilities_and_history_scores():
    history = [Candle(**q) for q in make_quotes(n=760, seed=19)]
    result = analyze(AnalysisRequest(symbol="TCS.NS", quotes=history))

    choices = result["modelOutlooks"]
    assert set(choices) == {"logisticRegression", "randomForest"}
    by_name = {m["model"]: m for m in result["walkForward"]["summary"]}
    for choice in choices.values():
        assert 0 <= choice["probabilityUpPct"] <= 100
        assert choice["walkForwardAccuracyPct"] == by_name[choice["model"]]["accuracyPct"]
        assert choice["baselineAccuracyPct"] >= 0
        assert isinstance(choice["hasDemonstratedEdge"], bool)
        expected = (
            choice["accuracyAdvantagePctPoints"] > choice["screeningMarginPctPoints"] + 0.01
        )
        # Rounding at two decimal places can obscure the exact threshold.
        if abs(choice["accuracyAdvantagePctPoints"] - choice["screeningMarginPctPoints"]) > 0.02:
            assert choice["hasDemonstratedEdge"] == expected
    assert choices["logisticRegression"]["probabilityUpPct"] == result["prediction"]["probabilityUpPct"]
