# Evaluation Report

## Scope and evidence

This report summarizes measured results already present in `evaluation/model_metrics.json`. The file identifies a 100,000-row dataset, 70,000 training rows, 15,000 validation rows, and 15,000 held-out test rows. The saved report timestamp is 2026-10-05T20:28:32Z. These are recorded training-run metrics, not a fresh run performed during this repository audit.

## Held-out model results

| Target | Model | Test metrics |
|---|---|---|
| Production impact (%) | Random Forest regressor | MAE 7.99 percentage points; RMSE 9.92; R² 0.684 |
| Revenue loss (USD) | Random Forest regressor | MAE $1,774,595; RMSE $4,419,908; R² 0.374 |
| Full recovery time (days) | Random Forest regressor | MAE 31.74 days; RMSE 45.21; R² 0.369 |
| Permanent supplier change | Random Forest classifier | Accuracy 0.640; precision 0.332; recall 0.507; F1 0.401; ROC-AUC 0.635 |

The training script selects between Random Forest and Extra Trees by validation MAE for regression or F1 for classification. It excludes outcome and post-response fields from initial-event features to limit target/future leakage. These metrics alone do not establish operational utility. In particular, revenue and recovery errors are large relative to many likely use cases, and the supplier-change classifier has modest precision and F1.

## RAG and answer quality

Faithfulness, answer relevancy, contextual relevancy, contextual precision, recommendation quality, and explanation quality are **Not evaluated** in the checked-in run evidence. `evaluation/run_evaluation.py` implements DeepEval metrics over saved analyses, but requires an LLM provider/judge and database records with retrieval evidence. This environment has no MySQL service, DeepEval install, configured judge, or saved eligible analysis examples. No RAGAS or DeepEval score is claimed.

## Other validation dimensions

| Dimension | Result |
|---|---|
| Retrieval relevance | Not evaluated against a labeled query/case set. Runtime hybrid scores are ranking signals, not relevance judgments. |
| Completeness | Not evaluated with human ratings or a reference answer set. |
| Factual consistency / groundedness | Not evaluated by an independent judge. Workflow validation only checks strategy support and evidence count. |
| Response quality | Not evaluated by human reviewers or an LLM judge. |
| Validation accuracy | Model classification accuracy is 0.640 for permanent supplier change; this does not represent general API or recommendation validation accuracy. |

## Sample test cases

Automated API and retriever helper test cases live in `tests/`. Their status is the result of the repository test run, not an LLM quality evaluation. Expected edge behavior includes HTTP 422 on malformed/empty search queries, HTTP 404 for unknown records, HTTP 503 when retrieval artifacts are missing, top-K truncation, and an empty result list when there are no matches.

## Reproduction

Install the root requirements, configure MySQL, then run `python scripts/train_models.py` to produce a new timestamped model report. For answer quality, configure `LLM_PROVIDER` and `LLM_MODEL`, save analyses with retrieved cases, then run `python evaluation/run_evaluation.py`. Record the judge model and output report; do not treat absent scores as zero.

## Offline RAG benchmark

`python evaluation/evaluate.py` runs a small checked-in benchmark in `evaluation/cases.json` against the source CSV and the application's Chroma/BM25 artifacts. It loads a private SQLite copy of the dataset, so this benchmark does not require MySQL or an LLM API key. It reports context precision@10 against the case filters, recall@10 and reciprocal rank for labeled reference cases, recommendation support, evidence consistency, and empty-result handling. The detailed run is written to `evaluation/reports/latest_offline_evaluation.json`.

This offline benchmark measures retrieval behavior and deterministic recommendation contracts. It does not claim to measure natural-language LLM faithfulness or answer relevance. Those DeepEval judge metrics remain available through `evaluation/run_evaluation.py` when a judge provider is configured and saved analyses with evidence exist; otherwise they should be reported as **Not evaluated**, never as zero.
