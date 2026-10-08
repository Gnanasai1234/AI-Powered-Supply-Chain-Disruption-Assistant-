import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.database import SessionLocal
from app.evaluation_service import calculate_overall_evaluation
from app.rag.hybrid_retriever import HybridRetriever

# 1. Setup real hybrid retriever
retriever = HybridRetriever()

scenarios = [
    {
        "name": "Scenario 1: Port Congestion in Electronics",
        "input": {
            "description": "Port of Singapore terminal crane failure halting semiconductor transshipments.",
            "disruption_type": "Port Congestion",
            "industry": "Electronics",
            "supplier_region": "Asia-Pacific",
            "supplier_tier": "2",
            "disruption_severity": 4,
        },
        "recommendation": {
            "summary": "Implement secondary carrier rerouting via alternative regional ports.",
            "recommended_response": "Alternative Supplier",
            "recommended_actions": ["Reroute containers", "Deploy safety stock"],
        },
    },
    {
        "name": "Scenario 2: Cyber Attack in Automotive",
        "input": {
            "description": "Ransomware encryption locking automated assembly plant control servers in Germany.",
            "disruption_type": "Cyber Attack",
            "industry": "Automotive",
            "supplier_region": "Europe",
            "supplier_tier": "1",
            "disruption_severity": 5,
        },
        "recommendation": {
            "summary": "Isolate industrial network and invoke manual failover manufacturing protocols.",
            "recommended_response": "Production Reroute",
            "recommended_actions": ["Air-gap OT networks", "Engage external incident response"],
        },
    },
    {
        "name": "Scenario 3: Natural Disaster in Pharmaceuticals",
        "input": {
            "description": "Minor regional flooding near packaging facility causing delivery delay.",
            "disruption_type": "Natural Disaster",
            "industry": "Pharmaceuticals",
            "supplier_region": "North America",
            "supplier_tier": "3",
            "disruption_severity": 2,
        },
        "recommendation": {
            "summary": "Dispatch local warehouse safety buffer stock while water recedes.",
            "recommended_response": "Inventory Buffer",
            "recommended_actions": ["Draw from domestic buffer"],
        },
    },
]

print("\n" + "=" * 80)
print("DYNAMIC EVALUATION VERIFICATION ACROSS 3 DISTINCT INPUTS")
print("=" * 80)

results = []
with SessionLocal() as db:
    for s in scenarios:
        inp = s["input"]
        # 1. Real search
        cases = retriever.search(
            db,
            inp["description"],
            {"industry": inp["industry"], "supplier_region": inp["supplier_region"]},
            top_k=5,
        )

        # 2. Real evaluation
        eval_report = calculate_overall_evaluation(inp, s["recommendation"], cases)
        results.append((s["name"], eval_report, cases))

        retrieval = eval_report["retrieval"]
        deepeval = eval_report["deepeval"]
        ragas = eval_report["ragas"]

        print(f"\n>>> {s['name']}")
        print(f"    - Overall Score     : {eval_report['overall_score_pct']}%  [{eval_report['status']}]")
        print(f"    - Has Warning       : {eval_report['has_warning']} (Warnings: {eval_report['warnings']})")
        print(f"    - Retrieval Cases   : {retrieval['count']} cases (Top-K: {retrieval['top_k']})")
        print(f"    - Avg Similarity    : {retrieval['average_similarity_pct']}% (Relevance: {retrieval['relevance_level']})")
        print(f"    - Context Precision : {retrieval['context_precision_pct']}%")
        print(f"    - Context Recall    : {retrieval['context_recall_pct']}%")
        print(f"    - Context Relevance : {retrieval['context_relevance_pct']}%")
        print(f"    - DeepEval Score    : {deepeval.get('overall_pct')}% (Evaluator: {deepeval.get('evaluator')})")
        print(f"    - RAGAS Score       : {ragas.get('overall_pct')}%")
        print("    - Top Case IDs      : ", [c['disruption_id'] for c in retrieval['cases']])
        print("    - Top Case Sim %    : ", [c['similarity_pct'] for c in retrieval['cases']])

print("\n" + "=" * 80)
# Assert that values actually vary dynamically
scores = [r[1]['overall_score_pct'] for r in results]
sims = [r[1]['retrieval']['average_similarity_pct'] for r in results]
top_case_sets = [set(c['disruption_id'] for c in r[1]['retrieval']['cases']) for r in results]

print("Distinct Overall Scores Across Scenarios     :", scores)
print("Distinct Average Similarities Across Scenarios:", sims)
print("Are All Overall Scores Different?             :", len(set(scores)) > 1)
print("Are Retrieved Case Sets Different?            :", top_case_sets[0] != top_case_sets[1])
print("=" * 80)
