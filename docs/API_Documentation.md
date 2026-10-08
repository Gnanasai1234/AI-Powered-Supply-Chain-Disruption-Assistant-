# API Documentation

Base URL: `http://127.0.0.1:8000`. Routes below include the `/api` prefix. FastAPI publishes the interactive OpenAPI schema at `/docs`.

Request validation uses Pydantic. Invalid bodies or query constraints return HTTP 422 with FastAPI's `detail` list. Database and artifact availability affect runtime-dependent responses. JSON examples below show response shapes; dynamic values depend on the local data and artifacts.

## `GET /api/health`

Checks database connectivity and reports artifact availability. No parameters or body. Returns HTTP 200 with `status`, `database`, `chroma`, `bm25`, `langgraph`, `models`, `llm`, and `artifact_errors`. `status` is `ok` or `unavailable`; the route itself returns 200 even when the database is unavailable.

Sample response shape:

```json
{"status":"ok","database":"available","chroma":"available","bm25":"available","langgraph":"available","models":{"production_impact":true},"llm":"LLM not configured","artifact_errors":{"retrieval":null,"workflow":null,"models":{}}}
```

## `GET /api/disruptions`

Lists structured cases. Optional query parameters: `disruption_type`, `industry`, `supplier_region`, `disruption_severity` (1–5), `limit` (default 50, 1–500), and `offset` (default 0, minimum 0). No body. Returns HTTP 200 with `total`, `limit`, `offset`, and `results`. Database errors are not translated to custom responses.

Example: `GET /api/disruptions?industry=Electronics&limit=2&offset=0`

Response shape: `{"total":123,"limit":2,"offset":0,"results":[{"id":1,"disruption_id":"DIS-000001","disruption_type":"Factory Incident","industry":"Electronics","supplier_tier":"1","supplier_region":"Asia-Pacific","supplier_size":"Large","has_backup_supplier":true,"disruption_severity":4,"production_impact_pct":54.3,"revenue_loss_usd":11376013.16,"response_type":"Customer Delay","response_time_days":14,"partial_recovery_days":3,"full_recovery_days":59,"permanent_supplier_change":false,"created_at":"<database timestamp>"}]}`. Result values are database-dependent.

## `GET /api/disruptions/{disruption_id}`

Fetches a row by the database integer primary key (despite the parameter label, this is not the CSV string `DIS-*` identifier). Path parameter `disruption_id`: integer. Returns 200 and one disruption object, or 404 `{"detail":"Disruption record not found"}`. No request body.

Example: `GET /api/disruptions/1`.

## `POST /api/retrieval/similar`

Searches the hybrid retriever. Body: `query` string (3–1200 characters), optional `filters` object, `top_k` (default 10, 1–50). Filters accept disruption type, industry, supplier tier, region, size, backup flag, severity (1–5 or `$eq`/`$gte`/`$lte`), and response type. Returns 200 with `results`, `count`, normalized `filters`, and configured `weights`. Empty matches return an empty results array. Returns 503 if retrieval artifacts are unavailable. Invalid input returns 422.

Sample request: `{"query":"severe electronics supplier disruption in Asia-Pacific","top_k":5,"filters":{"has_backup_supplier":false}}`.

Sample response shape: `{"results":[{"disruption_id":"DIS-...","semantic_score":0.81,"keyword_score":0.64,"hybrid_score":0.76,"disruption_type":"Port Congestion","industry":"Electronics","supplier_tier":"2","supplier_region":"Asia-Pacific","supplier_size":"Medium","has_backup_supplier":false,"disruption_severity":4,"production_impact_pct":42.1,"revenue_loss_usd":1000000,"response_type":"Alternative Supplier","response_time_days":3,"partial_recovery_days":20,"full_recovery_days":61,"permanent_supplier_change":false}],"count":1,"filters":{"has_backup_supplier":false},"weights":{"semantic":0.7,"keyword":0.3}}`. Scores/outcomes vary with actual indexes and weights.

## `POST /api/predictions`

Runs persisted prediction models. Required body fields: `disruption_type`, `industry`, `supplier_tier`, `supplier_region`, `supplier_size`, `has_backup_supplier`, `disruption_severity` (1–5). Returns 200 with `predictions`, `explanations`, and `features_used`. Returns 503 `Model not trained` if model artifacts are unavailable; invalid requests return 422.

Sample request: `{"disruption_type":"Port Congestion","industry":"Electronics","supplier_tier":"2","supplier_region":"Asia-Pacific","supplier_size":"Medium","has_backup_supplier":false,"disruption_severity":4}`.

Response shape: `{"predictions":{"production_impact":{"prediction":"<measured at runtime>","unit":"%"},"financial_loss":{"prediction":"<measured at runtime>","unit":"USD"},"recovery_time":{"prediction":"<measured at runtime>","unit":"days"},"permanent_supplier_change":{"prediction":"<measured at runtime>","probability":"<model score>"}},"explanations":{},"features_used":["disruption_type","industry","supplier_tier","supplier_region","supplier_size","has_backup_supplier","disruption_severity"]}`.

## `POST /api/disruptions/analyze`

Runs the full workflow and saves an analysis. Required fields: `description` (12–1200 chars), disruption type, industry, supplier tier, supplier region, supplier size, backup-supplier boolean, and severity 1–5. Optional observed `production_impact_pct` (0–100), `revenue_loss_usd` (0–1e12), `response_type`, and `response_time_days` (0–5000). Returns 200 with `analysis_id`, `classification`, `priority`, `similar_cases`, `predictions`, `response_analysis`, `recovery_analysis`, `resilience_analysis`, `recommendation`, `evidence`, `explanation`, `validation`, and `llm_status`. Returns 503 when workflow or retrieval is unavailable or execution fails. Invalid input returns 422.

Sample request:

```json
{"description":"A severe port disruption has delayed an electronics supplier in Asia-Pacific.","disruption_type":"Port Congestion","industry":"Electronics","supplier_tier":"2","supplier_region":"Asia-Pacific","supplier_size":"Medium","has_backup_supplier":false,"disruption_severity":4}
```

Response shape: `{"analysis_id":1,"classification":{},"priority":{},"similar_cases":[],"predictions":{},"response_analysis":[],"recovery_analysis":{},"resilience_analysis":{},"recommendation":{"recommended_response":"<retrieved strategy or insufficient evidence>","reasoning":[],"confidence":0.0,"human_review_required":true},"evidence":[],"explanation":{},"validation":{"valid":false,"errors":[]},"llm_status":"LLM not configured"}`. Dynamic fields depend on stored cases/models.

## `POST /api/recommendations`

Returns a saved recommendation. Required query parameter `analysis_id` (>0). No body. Returns 200 with recommendation JSON, or 404 `{"detail":"Recommendation not found"}`. Invalid query returns 422.

Example: `POST /api/recommendations?analysis_id=1`.

## `GET /api/analytics/overview`

Returns aggregate counts and averages from all ingested records. No parameters/body. Response 200 fields: `total_disruptions`, `average_production_impact_pct`, `total_revenue_loss_usd`, `average_response_time_days`, `average_recovery_time_days`, `backup_supplier_coverage_pct`, `permanent_supplier_change_rate_pct`.

## `GET /api/analytics/disruptions`

Returns counts grouped by disruption type, industry, supplier region, and severity. No parameters/body. Response 200 shape: `{"by_type":[{"label":"Port Congestion","count":25118}],"by_industry":[],"by_region":[],"by_severity":[]}`. Counts depend on ingested rows.

## `GET /api/analytics/responses`

Returns one row per observed `response_type` with `case_count`, median production impact, median revenue loss, median response time, median partial recovery, and median full recovery. No parameters/body. Returns HTTP 200 array; an empty database returns `[]`.

## `GET /api/analytics/recovery`

Returns full-recovery counts in fixed day buckets (`0-14`, `15-30`, `31-60`, `61-90`, `91-180`, `181+`) and `median_full_recovery_days`. No parameters/body. Response 200 shape: `{"distribution":[{"recovery_bucket":"0-14 days","case_count":123}],"median_full_recovery_days":61}`.

## `POST /api/feedback`

Stores feedback for an existing analysis. Required: positive integer `analysis_id`, boolean `useful`. Optional: `actual_response`, `actual_recovery_days` (0–5000), `actual_production_impact_pct` (0–100), `actual_revenue_loss_usd` (0–1e12), `comment` (up to 1000 chars). Returns 201 `{"id":1,"message":"Feedback saved"}`; 404 if the analysis does not exist; 422 for invalid input.

Sample request: `{"analysis_id":1,"useful":true,"comment":"Evidence was relevant.","actual_recovery_days":42}`.

## `GET /api/evaluation`

Returns local model metrics from `MODEL_METRICS_PATH` when present and up to 50 stored DeepEval results. No parameters/body. Response 200 fields: `model_metrics`, `evaluations`, and `status` (`available` or `Not available`). A database failure can prevent the route from completing.

## `GET /api/models`

Returns saved model availability and the local metrics report. No parameters/body. Response 200 fields: `availability`, `metrics`, and `status` (`available` or `Model not trained`).
