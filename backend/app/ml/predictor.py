from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np

from app.config import settings
from app.ml.features import MODEL_FEATURES, model_frame


class ModelRegistry:
    def __init__(self):
        self.models: dict[str, dict] = {}
        self.errors: dict[str, str] = {}
        self.reload()

    def reload(self) -> dict[str, bool]:
        directory = settings.path(settings.model_dir)
        self.models.clear()
        self.errors.clear()
        availability = {}
        for key, filename in {
            "production_impact": "production_impact_model.pkl",
            "financial_loss": "financial_loss_model.pkl",
            "recovery_time": "recovery_time_model.pkl",
            "permanent_supplier_change": "permanent_supplier_change_model.pkl",
        }.items():
            path = directory / filename
            if path.exists():
                try:
                    self.models[key] = joblib.load(path)
                except Exception as exc:
                    self.errors[key] = f"{type(exc).__name__}: {exc}"
            availability[key] = key in self.models
        return availability

    def predict(self, values: dict) -> dict:
        row = model_frame(values)
        if not self.models:
            return {"available": False, "message": "Model not trained", "predictions": {}, "explanations": {}}
        outputs: dict[str, dict] = {}
        explanations: dict[str, list[dict]] = {}
        versions = set()
        for key in ("production_impact", "financial_loss", "recovery_time", "permanent_supplier_change"):
            artifact = self.models.get(key)
            if artifact is None:
                outputs[key] = {"available": False, "message": "Model not trained"}
                continue
            pipeline = artifact["pipeline"]
            if artifact.get("version"):
                versions.add(artifact["version"])
            prediction = float(pipeline.predict(row)[0])
            if artifact["kind"] == "classification":
                classifier_probability = float(pipeline.predict_proba(row)[0][1])
                outputs[key] = {
                    "prediction": bool(prediction >= 0.5), "probability": round(classifier_probability, 4),
                    "probability_calibrated": False,
                    "probability_note": "Uncalibrated model score; not a calibrated real-world likelihood.",
                }
            else:
                value = max(0.0, prediction)
                unit = {"production_impact": "%", "financial_loss": "USD", "recovery_time": "days"}[key]
                outputs[key] = {"prediction": round(value, 2 if key != "recovery_time" else 1), "unit": unit}
            preprocessor = pipeline.named_steps["preprocess"]
            estimator = pipeline.named_steps["model"]
            if hasattr(estimator, "feature_importances_"):
                names = preprocessor.get_feature_names_out()
                importance = estimator.feature_importances_
                top = np.argsort(importance)[-8:][::-1]
                explanations[key] = [{"feature": str(names[i]).replace("cat__", "").replace("num__", ""), "importance": round(float(importance[i]), 5)} for i in top]
            else:
                explanations[key] = []
        complete = all(key in self.models for key in ("production_impact", "financial_loss", "recovery_time", "permanent_supplier_change"))
        missing = [key for key in ("production_impact", "financial_loss", "recovery_time", "permanent_supplier_change") if key not in self.models]
        return {"available": complete, "message": "" if complete else "Model not trained: " + ", ".join(missing), "predictions": outputs, "explanations": explanations, "features_used": MODEL_FEATURES, "model_version": sorted(versions)[-1] if versions else "version unavailable"}


registry: ModelRegistry | None = None


def initialize_models() -> dict[str, bool]:
    global registry
    registry = ModelRegistry()
    return {key: key in registry.models for key in ("production_impact", "financial_loss", "recovery_time", "permanent_supplier_change")}


def model_errors() -> dict[str, str]:
    return registry.errors.copy() if registry is not None else {}


def predictions(values: dict) -> dict:
    if registry is None:
        initialize_models()
    assert registry is not None
    return registry.predict(values)
