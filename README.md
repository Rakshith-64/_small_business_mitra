# Business Mitra: Small Business Basics RAG Chatbot

## Overview
Introduce small-business fundamentals in a student-friendly, non-legal-advice format.

## Features
- Local, editable text knowledge base in `knowledge_base/`
- TF-IDF retrieval with cosine similarity
- Source filenames and passage numbers displayed with retrieved text
- Fallback response when no relevant evidence is found
- Streamlit chat interface and clear-conversation control
- Works without an API key in local retrieval mode
- Optional Gemini answer generation when `GEMINI_API_KEY` is configured

## Requirements
- Python 3.10 or newer
- Internet access only for installing dependencies (not required for chatbot queries after installation)

## Run on Windows
```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
streamlit run app.py
```

## Run on macOS / Linux
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
streamlit run app.py
```

Open the local URL shown in the terminal, usually `http://localhost:8501`.

## Run the Next.js website and Python API on Windows

The website's `/api/...` requests are proxied by the Next.js development
server to FastAPI on port `8000`. Start the services in two PowerShell
terminals from the project root.

In the first terminal, install the backend dependencies and start FastAPI:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m uvicorn main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

In the second terminal, start Next.js:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. To test the API directly and through the frontend
proxy, run these commands in another PowerShell terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
Invoke-RestMethod http://localhost:3000/api/health

$body = @{ question = "Why should a business track cash flow?" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/chat `
  -ContentType "application/json" -Body $body
```

The chat response includes the answer, source filenames, passage numbers, and
similarity scores. Gemini is optional; without `GEMINI_API_KEY`, the API uses
the local TF-IDF retrieval response.

## Example questions
- What belongs in a simple business plan?
- How can a small business understand customers?
- Why should a business track cash flow?

## How it works
1. Reads `.txt` files from `knowledge_base/`.
2. Fits a TF-IDF vectorizer over source passages.
3. Ranks passages by cosine similarity to the question.
4. Displays the selected source passages and their filenames.

## Important design note
This chatbot has two modes: local extractive mode (no key required) and optional Gemini generation (API key required). In Gemini mode, the model is instructed to use retrieved passages and cite filenames; verify generated responses. Similarity scores are not confidence probabilities. Content is illustrative; verify and replace it with approved sources before real-world use.

## Troubleshooting
- If `streamlit` is not found, activate the virtual environment and run `pip install -r requirements.txt` again.
- If port 8501 is occupied, Streamlit will suggest another port; alternatively run `streamlit run app.py --server.port 8502`.
- If no answer appears, ask a more specific in-domain question and check that `.txt` files exist in `knowledge_base/`.
