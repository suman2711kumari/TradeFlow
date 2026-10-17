import pytest

pytest.importorskip("tensorflow")

from app.cnn import WINDOW, CnnRequest, build_windows, run_cnn_comparison
from app.common import Candle, build_frame
from tests.conftest import make_quotes


def test_windows_do_not_see_the_future():
    frame = build_frame([Candle(**q) for q in make_quotes(400, seed=2)], min_rows=300)
    X, y, t = build_windows(frame)
    assert X.shape[1] == WINDOW
    assert t.max() <= len(frame) - 2          # last row has no label so is never a training/test sample
    # label for sample i is the direction of the move AFTER the window ends
    for i in (0, len(t) // 2, len(t) - 1):
        assert y[i] == int(frame["close"].iloc[t[i] + 1] > frame["close"].iloc[t[i]])


def test_cnn_comparison_runs_on_identical_test_rows():
    out = run_cnn_comparison(CnnRequest(symbol="TEST", quotes=[Candle(**q) for q in make_quotes(650, seed=9)], epochs=8))
    names = [m["model"] for m in out["models"]]
    assert names[0] == "1D CNN" and "Logistic Regression" in names and "Random Forest" in names
    n_test = out["split"]["testSamples"]
    for m in out["models"]:
        c = m["confusion"]
        assert c["tp"] + c["fp"] + c["tn"] + c["fn"] == n_test
    types = [a["type"] for a in out["architecture"]]
    assert "Conv1D" in types and "MaxPooling1D" in types
    assert out["verdict"]
