import json
from starlette.testclient import TestClient

from app.database import Base, engine
from app.evaluation_service import (
    calculate_overall_evaluation,
    evaluate_deepeval_metrics,
    evaluate_ragas_metrics,
    evaluate_retrieval,
    get_test_cases_summary,
    log_evaluation_console,
)
from app.main import app


def test_evaluate_retrieval_metrics():
    input_data = {
        "disruption_type": "Logistics Delay",
        "industry": "Automotive",
        "supplier_region": "Asia",
        "supplier_tier": "1",
        "disruption_severity": 4,
        "description": "Port congestion causing severe delay in Asia automotive parts",
    }
    retrieved_cases = [
        {
            "disruption_id": "DIS-0010",
            "disruption_type": "Logistics Delay",
            "industry": "Automotive",
            "supplier_region": "Asia",
            "supplier_tier": "1",
            "disruption_severity": 4,
            "response_type": "Dual Sourcing",
            "full_recovery_days": 25,
            "similarity_score": 0.92,
        },
        {
            "disruption_id": "DIS-0015",
            "disruption_type": "Port Congestion",
            "industry": "Automotive",
            "supplier_region": "Asia",
            "supplier_tier": "1",
            "disruption_severity": 3,
            "response_type": "Buffer Stock",
            "full_recovery_days": 20,
            "similarity_score": 0.81,
        },
    ]

    result = evaluate_retrieval(input_data, retrieved_cases, top_k=5)
    assert result["count"] == 2
    assert result["top_k"] == 5
    assert result["average_similarity_pct"] > 80.0
    assert result["context_precision"] >= 0.7
    assert result["context_recall"] >= 0.7
    assert result["relevance_level"] in {"HIGH", "MEDIUM"}
    assert result["is_useful"] is True
    assert len(result["cases"]) == 2
    assert result["cases"][0]["metadata_matches"]["type_match"] is True


def test_evaluate_retrieval_empty_cases():
    input_data = {"disruption_type": "Cyber Attack", "disruption_severity": 5}
    result = evaluate_retrieval(input_data, [], top_k=5)
    assert result["count"] == 0
    assert result["average_similarity_pct"] == 0.0
    assert result["is_useful"] is False
    assert result["status"] == "INSUFFICIENT"


def test_deepeval_and_ragas_metrics():
    input_data = {"disruption_type": "Factory Incident", "disruption_severity": 4}
    recommendation = {
        "summary": "Activate emergency backup supplier and escalate mitigation",
        "recommended_response": "Emergency Supplier Activation",
        "recommended_actions": [
            "Escalate immediately to operations committee",
            "Engage secondary supplier to prevent production halt",
        ],
    }
    retrieved_cases = [
        {
            "disruption_type": "Factory Incident",
            "response_type": "Emergency Supplier Activation",
            "disruption_severity": 4,
            "similarity_score": 0.88,
        }
    ]

    deepeval = evaluate_deepeval_metrics(input_data, recommendation, retrieved_cases, threshold=0.70)
    assert deepeval["status"] == "available"
    assert deepeval["overall_pct"] >= 70.0
    assert "faithfulness" in deepeval["metrics"]
    assert "answer_relevance" in deepeval["metrics"]
    assert "contextual_relevance" in deepeval["metrics"]

    retrieval_eval = evaluate_retrieval(input_data, retrieved_cases)
    ragas = evaluate_ragas_metrics(input_data, recommendation, retrieved_cases, retrieval_eval, threshold=0.70)
    assert ragas["status"] == "available"
    assert ragas["overall_pct"] >= 70.0
    assert "faithfulness" in ragas["metrics"]
    assert "answer_relevancy" in ragas["metrics"]
    assert "context_precision" in ragas["metrics"]
    assert "context_recall" in ragas["metrics"]


def test_overall_evaluation_warning_trigger():
    # Case with empty retrieval and low-grounding recommendation should trigger warnings
    input_data = {"disruption_type": "Unknown Event", "disruption_severity": 5}
    recommendation = {"summary": "", "recommended_response": "", "recommended_actions": []}
    retrieved_cases = []

    eval_report = calculate_overall_evaluation(input_data, recommendation, retrieved_cases, threshold=75.0)
    assert eval_report["has_warning"] is True
    assert len(eval_report["warnings"]) > 0
    assert eval_report["overall_score_pct"] < 75.0
    assert eval_report["status"] in {"NEEDS IMPROVEMENT", "POOR"}


def test_test_cases_summary():
    summary = get_test_cases_summary()
    assert summary["status"] == "PASSED"
    assert summary["total_tests"] == 10
    assert summary["passed_count"] >= 9
    assert summary["pass_rate_pct"] >= 90.0
    assert len(summary["scenarios"]) == 10


def test_api_evaluation_endpoints():
    Base.metadata.create_all(engine)
    client = TestClient(app)

    # Test /api/evaluation/test-cases
    resp = client.get("/api/evaluation/test-cases")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_tests"] == 10
    assert data["pass_rate_pct"] >= 75.0

    # Test /api/evaluation
    resp2 = client.get("/api/evaluation")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert "test_cases" in data2
    assert "status" in data2
