# Dataset Details

## Identity and purpose

The local dataset is `backend/data/supply_chain_disruption_recovery.csv`, a comma-separated file used as the source for MySQL ingestion, retrieval-index construction, offline model training, and historical analytics. No external publisher, citation, or dataset URL accompanies the file in this repository. The project therefore documents the repository copy as its source and does not infer whether its records are synthetic or operational.

Dataset file: [supply_chain_disruption_recovery.csv](../backend/data/supply_chain_disruption_recovery.csv). External source link: not recorded in the supplied repository.

The checked-in profile reports **100,000 records and 15 fields**. It records zero missing values, exact duplicate rows, or duplicate disruption IDs in the inspected file. `scripts/inspect_dataset.py` creates the profile. Ingestion validates schema and values, drops malformed or duplicate-ID rows if present, and avoids inserting IDs already stored in MySQL.

## Fields

| Field | CSV profile type | Meaning in the application |
|---|---|---|
| `disruption_id` | string | Source case identifier and retrieval document ID |
| `disruption_type` | string | Disruption category |
| `industry` | string | Affected industry |
| `supplier_tier` | integer in CSV; string in database | Supplier tier, normalized to string for storage and model features |
| `supplier_region` | string | Supplier region |
| `supplier_size` | string | Supplier size category |
| `has_backup_supplier` | boolean | Whether a backup supplier was available |
| `disruption_severity` | integer | Severity on a 1–5 scale |
| `production_impact_pct` | float | Production impact percentage |
| `revenue_loss_usd` | float | Revenue loss in USD |
| `response_type` | string | Historical response strategy |
| `response_time_days` | integer | Days until response |
| `partial_recovery_days` | integer | Days to partial recovery |
| `full_recovery_days` | integer | Days to full recovery |
| `permanent_supplier_change` | boolean | Whether the case records a permanent supplier change |

## Data types and observed ranges

`dataset_profile.json` records string/object categories, booleans, integer severity/timing fields, and floating point impact/loss fields. Observed ranges include severity 1–5, production impact 1–100%, revenue loss USD 10,000–373,130,977.48, response time 1–64 days, partial recovery 3–337 days, and full recovery 8–798 days. Ingestion enforces nonnegative loss and durations, and impact and severity bounds. The application reports IQR outliers but does not remove them automatically.

## Preprocessing

The ingestion script requires exactly the 15 expected columns. It selects the expected order, strips whitespace from text values, converts numeric fields and parses accepted boolean forms. Rows missing any required field are dropped with a count. Exact duplicate rows are removed, then duplicate `disruption_id` rows are reduced to the first occurrence. The ingestion validation rejects severity outside 1–5, impact outside 0–100, and negative revenue loss or recovery/response durations. It does not impute missing values, normalize category labels beyond trimming, or remove statistical outliers.

## Use in the application

Each stored case becomes a structured MySQL row. Index builders render one textual case description per disruption, including the event, supplier descriptors, impact, response, recovery, and supplier-change outcome. The vector index stores normalized Sentence Transformer embeddings and categorical metadata in ChromaDB. A separate BM25 index stores tokenized case text. The analysis and retrieval endpoints use these indexes and query MySQL for returned structured outcomes. Training uses initial-event fields to predict production impact, revenue loss, full recovery duration, and permanent supplier change.

## Limitations

The file has no timestamps, supplier names, supplier IDs, or linked external sources. Consequently, it cannot support temporal trend or supplier-entity analysis. The repository does not establish whether records are real, simulated, or otherwise derived. Historical outcome correlations do not show that a response caused an outcome. Data quality outside the profiled file cannot be inferred.
