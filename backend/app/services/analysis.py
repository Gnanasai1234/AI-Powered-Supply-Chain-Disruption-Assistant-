from collections import defaultdict
from statistics import median

from app.models import Disruption


def response_analysis(cases: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for case in cases:
        grouped[case["response_type"]].append(case)
    result = []
    for response, rows in grouped.items():
        result.append({
            "response_type": response,
            "case_count": len(rows),
            "median_production_impact_pct": round(median(row["production_impact_pct"] for row in rows), 2),
            "median_revenue_loss_usd": round(median(row["revenue_loss_usd"] for row in rows), 2),
            "median_response_time_days": round(median(row["response_time_days"] for row in rows), 2),
            "median_partial_recovery_days": round(median(row["partial_recovery_days"] for row in rows), 2),
            "median_full_recovery_days": round(median(row["full_recovery_days"] for row in rows), 2),
            "disruption_ids": [row["disruption_id"] for row in rows],
        })
    if len(result) == 1:
        result[0]["effectiveness_score"] = 0.0
    elif result:
        dimension_fields = ["median_full_recovery_days", "median_production_impact_pct", "median_revenue_loss_usd"]
        ranked = {}
        for field in dimension_fields:
            values = sorted({row[field] for row in result})
            ranked[field] = {value: index / max(1, len(values) - 1) for index, value in enumerate(values)}
        for row in result:
            row["effectiveness_score"] = round(100 * (
                0.50 * ranked["median_full_recovery_days"][row["median_full_recovery_days"]]
                + 0.30 * ranked["median_production_impact_pct"][row["median_production_impact_pct"]]
                + 0.20 * ranked["median_revenue_loss_usd"][row["median_revenue_loss_usd"]]
            ), 1)
    return sorted(result, key=lambda row: (row["effectiveness_score"], -row["case_count"]))


def priority_details(severity: int, production_impact_pct: float, revenue_loss_usd: float, reference: dict[str, list[float]], impact_source: str = "Predicted production impact", loss_source: str = "Predicted revenue loss") -> dict:
    import numpy as np

    def percentile(name: str, value: float) -> float:
        values = reference.get(name, [])
        if not values:
            return 0.0
        return float(np.searchsorted(values, value, side="right") / len(values) * 100)

    components = {
        "severity_percentile": percentile("disruption_severity", severity),
        "production_impact_percentile": percentile("production_impact_pct", production_impact_pct),
        "revenue_loss_percentile": percentile("revenue_loss_usd", revenue_loss_usd),
    }
    score = round(0.30 * components["severity_percentile"] + 0.40 * components["production_impact_percentile"] + 0.30 * components["revenue_loss_percentile"], 1)
    level = "CRITICAL" if score >= 90 else "HIGH" if score >= 70 else "MEDIUM" if score >= 40 else "LOW"
    reasons = [
        {"factor": "Disruption severity", "observed": severity, "dataset_percentile": round(components["severity_percentile"], 1), "weight": 0.3},
        {"factor": impact_source, "observed": round(production_impact_pct, 2), "dataset_percentile": round(components["production_impact_percentile"], 1), "weight": 0.4},
        {"factor": loss_source, "observed": round(revenue_loss_usd, 2), "dataset_percentile": round(components["revenue_loss_percentile"], 1), "weight": 0.3},
    ]
    return {"priority_score": score, "priority_level": level, "priority_reasons": reasons, "normalization": "Empirical percentiles from ingested MySQL dataset; weights: severity 30%, production impact 40%, revenue loss 30%."}


def resilience_details(values: dict, predictions: dict, cases: list[dict]) -> dict:
    predicted = predictions.get("predictions", {})
    impact = predicted.get("production_impact", {}).get("prediction")
    recovery = predicted.get("recovery_time", {}).get("prediction")
    if impact is None or recovery is None:
        return {"available": False, "message": "Model not trained", "resilience_score": None}
    recovery_values = [row["full_recovery_days"] for row in cases]
    observed_recovery = median(recovery_values) if recovery_values else recovery
    supplier_change_rate = (sum(bool(row["permanent_supplier_change"]) for row in cases) / len(cases)) if cases else None
    # A transparent, demo-specific heuristic. It is not an industry-standard score.
    impact_component = max(0.0, min(1.0, 1 - float(impact) / 100))
    recovery_component = max(0.0, min(1.0, 1 - float(recovery) / 798))
    backup_component = 1.0 if values["has_backup_supplier"] else 0.0
    change_component = 1.0 - supplier_change_rate if supplier_change_rate is not None else 0.5
    score = round(100 * (0.30 * impact_component + 0.25 * recovery_component + 0.25 * backup_component + 0.20 * change_component), 1)
    vulnerabilities = []
    if not values["has_backup_supplier"]:
        vulnerabilities.append("No backup supplier is reported for this event.")
    if float(impact) >= 42.9:
        vulnerabilities.append("Predicted production impact is at or above the dataset's 75th percentile.")
    if float(recovery) >= 100:
        vulnerabilities.append("Predicted full recovery time is at or above the dataset's 75th percentile.")
    if supplier_change_rate is not None and supplier_change_rate >= 0.5:
        vulnerabilities.append("At least half of retrieved similar cases involved a permanent supplier change.")
    actions = []
    if not values["has_backup_supplier"]:
        actions.append("Qualify a second source for the affected component or service.")
    if recovery > observed_recovery:
        actions.append("Set staged recovery checkpoints against the similar-case median.")
    if not actions:
        actions.append("Review inventory cover and recovery checkpoints against the retrieved cases.")
    return {
        "available": True, "resilience_score": score,
        "risk_level": "HIGH" if score < 40 else "MODERATE" if score < 70 else "LOW",
        "score_type": "Heuristic decision-support metric; not an industry-standard score.",
        "supplier_tier": values["supplier_tier"], "backup_supplier_available": values["has_backup_supplier"],
        "median_historical_recovery_days": observed_recovery if cases else None,
        "permanent_change_rate_in_retrieved_cases": supplier_change_rate,
        "vulnerabilities": vulnerabilities, "recommended_resilience_actions": actions,
    }


def recommendation_from_history(groups: list[dict], total_cases: int) -> dict:
    if total_cases < 3 or not groups:
        return {
            "recommended_response": "Insufficient historical evidence.", "alternative_responses": [],
            "reasoning": ["Fewer than three matching historical cases were retrieved; human review is recommended."],
            "confidence": 0.0, "confidence_basis": f"{total_cases} retrieved historical cases", "human_review_required": True,
        }
    best = groups[0]
    strategies = [group["response_type"] for group in groups]
    return {
        "recommended_response": best["response_type"],
        "alternative_responses": strategies[1:4],
        "reasoning": [
            f"This strategy has the lowest historical outcome score ({best['effectiveness_score']}/100) across the retrieved response groups.",
            f"Score weights are 50% median full-recovery time, 30% median production impact, and 20% median revenue loss; its group medians are {best['median_full_recovery_days']} days, {best['median_production_impact_pct']}%, and ${best['median_revenue_loss_usd']:,.2f}.",
        ],
        "confidence": round(min(1.0, best["case_count"] / total_cases), 3),
        "confidence_basis": f"Evidence share: {best['case_count']} of {total_cases} retrieved cases used this response; not a probability.",
        "human_review_required": total_cases < 5 or best["case_count"] < 2,
    }
