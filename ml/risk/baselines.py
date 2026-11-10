"""Future-pressure baselines, distinct from operational variance rules."""
import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (precision_recall_fscore_support, confusion_matrix,
                             roc_auc_score, average_precision_score, brier_score_loss)


def heuristic(x):
    # Transparent fixed demand proxy: 30-day pace from already paid+pending exposure.
    elapsed = np.maximum(x[:, 12], 1)
    horizon = np.minimum(x[:, 13], 30)
    pressure = (x[:, 7] + x[:, 8] + x[:, 9]) * horizon / elapsed
    return np.clip(.1 + .8 * pressure / np.maximum(x[:, 2], .01), 0, 1)


def fit_baselines(x, y):
    logistic = make_pipeline(StandardScaler(), LogisticRegression(C=.3, max_iter=1000, random_state=2026))
    logistic.fit(x, y)
    prior = float(np.mean(y))
    return logistic, prior


def metrics(y, score):
    predicted = np.asarray(score) >= .5
    p, r, f, _ = precision_recall_fscore_support(y, predicted, average='binary', zero_division=0)
    macro = precision_recall_fscore_support(y, predicted, average='macro', zero_division=0)[2]
    calibration = []
    for low in np.arange(0, 1, .1):
        mask = (score >= low) & (score < low + .1 + (1e-12 if low > .89 else 0))
        if mask.any():
            calibration.append(dict(low=float(low), count=int(mask.sum()),
                                    mean_score=float(score[mask].mean()), event_rate=float(y[mask].mean())))
    return dict(precision=float(p), recall=float(r), f1=float(f), macro_f1=float(macro),
                confusion=confusion_matrix(y, predicted, labels=[0, 1]).tolist(),
                roc_auc=float(roc_auc_score(y, score)) if len(set(y)) == 2 else None,
                pr_auc=float(average_precision_score(y, score)),
                brier=float(brier_score_loss(y, score)), calibration=calibration)
