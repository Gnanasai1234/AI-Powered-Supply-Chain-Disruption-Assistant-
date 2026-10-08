# AI-Powered Supply Chain Disruption Assistant

A local decision-support capstone for comparing a new supply-chain disruption with historical cases. FastAPI serves the existing analysis workflow and a native React/Vite application provides the frontend.

## Project overview

Operations users enter event facts such as disruption type, supplier tier, region, backup availability, and severity. The API retrieves similar stored records, runs saved impact models when available, compares observed response strategies, and returns recovery and resilience context. Recommendations cite retrieved cases and require human review when evidence is limited. An optional LLM can write a grounded explanation; a deterministic historical-analysis path works without an LLM.

## Problem and business objective

Supply-chain teams need a quick way to inspect historical disruption outcomes before choosing a response. This project organizes previous cases around supplier and event attributes, then exposes evidence on production impact, revenue loss, response, recovery, and supplier changes. It supports triage and comparison. It does not replace operational judgment or prove that an observed historical response caused a better outcome.

## Implemented capabilities

- Hybrid retrieval combines Chroma cosine-distance similarity and BM25 keyword scores, weighted by configurable defaults of 0.7 and 0.3.
- MySQL stores the structured disruption records, analysis requests, recommendations, predictions, feedback, model versions, and evaluation results.
- Four saved scikit-learn models predict production impact, financial loss, full recovery time, and permanent supplier change.
- A LangGraph workflow classifies the request, retrieves cases, runs prediction and response/recovery/resilience analyses, produces a recommendation, and checks evidence coverage.
- FastAPI exposes health, disruption, search, prediction, analysis, recommendation, analytics, feedback, model, and evaluation endpoints.
- A native React/Vite dashboard provides login, disruption analysis, history, similar-case search, predictions, recommendations, analytics, feedback, and evaluation views.

## Technology stack

Python, FastAPI, Pydantic Settings, SQLAlchemy, MySQL with PyMySQL, pandas, NumPy, scikit-learn, joblib, ChromaDB, Sentence Transformers (`BAAI/bge-small-en-v1.5`), rank-bm25, LangGraph, httpx, and optional DeepEval. The frontend uses React, Vite, Axios, Recharts, and Lucide and calls the existing FastAPI API.

## Repository layout

```text
architecture/                 Architecture PDF
backend/app/                  FastAPI app, models, agents, RAG, ML and services
backend/data/                  Required local CSV
backend/ml/models/             Locally generated model artifacts (ignored by Git)
docs/                          Design, API, dataset, evaluation and compliance docs
evaluation/                    Dataset profile, measured model metrics and evaluator
frontend/                      Native React/Vite application
scripts/                       Dataset inspection, ingestion, index build and training
tests/                         API and retrieval unit tests
```

The current backend already has a clear package layout under `backend/app`; files remain there so existing imports and scripts continue to work.

## Prerequisites

- Python 3.11 or 3.12 recommended
- MySQL 8 local server
- Internet access for the first Sentence Transformer model download, unless cached
- Node.js 18+ for the React/Vite frontend

## Local setup

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Create a local database:

```sql
CREATE DATABASE supplychain CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Set `DATABASE_URL` in `.env` to your local credentials. Keep `.env` private. The checked-in `.env.example` contains placeholders only.

## Initialize local data and models

Run each offline step once from the repository root. The application does not ingest data, build indexes, or train models at startup.

```bash
python scripts/inspect_dataset.py
python scripts/ingest_dataset.py
python scripts/build_vector_index.py
python scripts/build_bm25_index.py
python scripts/train_models.py
```

This loads the checked-in CSV into MySQL, builds persistent Chroma and BM25 indexes, and trains the four prediction models. The embedding model downloads on first use. These steps can take time on a local machine.

## Configure an optional LLM

The default `LLM_PROVIDER=demo` makes no external request. For Gemini-first routing, set `LLM_PROVIDER=gemini`, `LLM_MODEL=gemini-3.5-flash-lite`, and `GEMINI_API_KEY` in the root `.env`. If Gemini fails, the workflow tries `OPENROUTER_MODEL` using `OPENROUTER_API_KEY` and `OPENROUTER_BASE_URL`; if that also fails, the historical-data recommendation remains available. OpenAI, standalone OpenRouter, and Ollama are also supported. Keep real credentials in `.env`, never in source files or `.env.example`.

## Accounts and private analysis history

Register or sign in from the React entry screen. Passwords are stored as scrypt hashes; API sessions use revocable opaque bearer tokens that expire after 24 hours. Disruption analysis, saved history, feedback, and saved-recommendation access require an authenticated user. The `/api/history` endpoints filter and paginate in MySQL and scope every read or delete to the authenticated account. History records store the final provider/model, fallback flag, safe provider-attempt status, and response time. Deleting history also removes its linked analysis, predictions, recommendations, and feedback.

## Start the backend

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

OpenAPI documentation is at `http://127.0.0.1:8000/docs`.

## Start the React/Vite frontend

```bash
cd frontend
npm install
npm run dev
```

Vite serves the app at the URL shown in the terminal, usually `http://localhost:5173`. The Vite config reads the root `.env`; set `VITE_API_BASE_URL` there if FastAPI is not at `http://localhost:8000`.

## End-to-end flow

Start MySQL, initialize the data and offline artifacts, start FastAPI, then start the React/Vite frontend with `npm run dev`. The UI sends event facts to FastAPI. LangGraph requests hybrid retrieval and saved predictions, compares historical outcomes, and returns a validated response, evidence, and model outputs. The UI displays the returned result. LLM generation is optional. Missing model/index artifacts produce an explicit unavailable response. Running the frontend does not require Streamlit.

## Sample queries

| Query | Expected response |
|---|---|
| Find historical disruptions similar to a severe supplier disruption in Asia-Pacific. | A ranked set of cases with hybrid scores, supplier attributes, impacts, response types, and recovery outcomes. |
| What response strategies appear in high-severity disruption cases? | Retrieved case response groups and their observed outcome medians. |
| Find high-impact electronics disruptions in Asia-Pacific. | Ranked similar cases with their observed production impacts; retrieval does not promise a descending-impact sort. |
| Show recovery outcomes for historical disruptions without a backup supplier. | Retrieved matching cases with their observed recovery durations; this is descriptive evidence, not a causal estimate. |
| Recommend a response for a severe supplier disruption. | A strategy chosen from retrieved response groups, reasoning, evidence, and a human-review flag. With fewer than three cases, the system reports insufficient evidence. |

## Evaluation status

The saved model metrics file reports held-out results from a 70/15/15 train/validation/test split (100,000 source records). It contains measured regression MAE/RMSE/R² and classification accuracy/precision/recall/F1/ROC-AUC. These are model metrics, not RAG or recommendation quality scores. DeepEval evaluation requires a configured LLM judge and saved analyses; no judge scores are included unless that workflow has actually run. See [Evaluation Report](docs/Evaluation_Report.pdf) and [model_metrics.json](evaluation/model_metrics.json).

## Security and limitations

The local account flow uses expiring, revocable bearer sessions and stores password scrypt hashes. This is intended for a local capstone demonstration, not production authentication. Keep real API credentials in the ignored root `.env`; `.env.example` contains placeholders. The dataset has no event timestamp or supplier identity field, and its external provenance is not recorded in this repository. Recommendations compare historical associations and saved model estimates; they do not establish causality. The resilience score is explicitly a project heuristic.

## Documentation

- [Architecture diagram](architecture/Architecture_Diagram.pdf)
- [Design document](design/Design_Document.pdf)
- [API documentation](docs/API_Documentation.pdf)
- [Dataset details](docs/Dataset_Details.pdf)
- [Evaluation report](docs/Evaluation_Report.pdf)
- [Capstone compliance report](docs/CAPSTONE_COMPLIANCE_REPORT.md)
- [Presentation outline](presentation/Project_Presentation_Outline.md). The editable PowerPoint remains outstanding in the compliance report because the required presentation authoring runtime is unavailable here.
