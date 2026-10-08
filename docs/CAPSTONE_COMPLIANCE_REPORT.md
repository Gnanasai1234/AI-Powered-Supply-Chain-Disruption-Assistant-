# Capstone Compliance Report

Audit date: 2026-10-06 (Asia/Calcutta). The repository contains no `.git` directory, so tracked-file status and commit history could not be checked.

| Item | Status | Evidence or remaining work |
|---|---|---|
| Architecture diagram | PASS | PDF generated from actual code flow; no invented framework or vector store. |
| Design document | PASS | Covers requested design sections and implementation-specific limits. |
| Complete source code | PASS | Existing `backend/app`, scripts, UI, dataset, and new Streamlit client are present. |
| README | PASS | Local setup, database, offline build, API/UI startup, sample prompts, and limitations documented. |
| API documentation | PASS | Routes cross-checked against FastAPI decorators and handlers. |
| Dataset details | PASS | Schema and profile report document all 15 local columns and source limitation. |
| Presentation | NOT VERIFIED | Presentation authoring runtime is unavailable in this execution environment; no PPTX is claimed as delivered. Create it with the bundled `@oai/artifact-tool` runtime and inspect rendered slides. |
| Evaluation report | PASS | Reports existing held-out model scores. RAG and recommendation judge metrics are labeled not evaluated. |
| Sample test cases | PASS | `python -m pytest -q`: 12 passed. |
| requirements.txt | PARTIAL | Root file includes backend requirements. A clean dependency installation could not be verified because network access to package index is blocked. |
| `.env.example` | PASS | Local DB and optional LLM placeholders; no values that are real credentials. |
| `.gitignore` | PASS | Ignores environment secrets, keys, generated indexes/models, caches, dependencies, and build output. |
| No secrets | PASS WITH LIMIT | No local `.env`, key, PEM, credential, or secrets file found in the scanned project. Git history cannot be checked because `.git` is absent. |
| Local backend execution | PARTIAL | Uvicorn starts and `/api/health` responds. The configured placeholder MySQL credentials are rejected; ChromaDB and LangGraph packages are absent. API route behavior is tested with an isolated SQLite fixture. |
| Local frontend execution | PASS | Streamlit served HTTP 200 on port 8501. React/Vite production build completed; Vite reported one large Three.js chunk warning. |
| End-to-end local execution | NOT VERIFIED | Full workflow requires MySQL rows, matching Chroma and BM25 indexes, fitted model artifacts, and optionally an LLM provider. This environment lacks MySQL and retrieval packages. |

## Audit summary

The existing project implements FastAPI, React/Vite, MySQL persistence, Chroma semantic retrieval, BM25 keyword retrieval, Sentence Transformer embeddings, four saved ML model workflows, LangGraph orchestration, optional OpenAI/OpenRouter/Ollama chat completions, and a DeepEval evaluation script. It did not contain Streamlit, tests, the required submission documents, or a root requirements file. The Streamlit client and the missing documentation/tests have been added without moving the established backend or React frontend. API startup was verified with an unavailable database, and the health route accurately reported missing local services/artifacts.

## Items to complete on a connected local machine

1. Install `requirements.txt`, configure MySQL, ingest the CSV, build both indexes, and train the models.
2. Run the backend and Streamlit client together, then exercise analysis and retrieval with the generated artifacts.
3. Create and visually inspect the 12-slide PowerPoint using the presentation artifact runtime. The current container exposes no presentation runtime loader.
4. Initialize a Git repository if this folder is to be pushed to GitHub, then review history for credentials before publishing.
