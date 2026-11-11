import logging
import os
from pathlib import Path
import re
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from starlette.exceptions import HTTPException as StarletteHTTPException


LOGGER = logging.getLogger(__name__)
PROJECT_DOMAIN = (
    "Business planning, customer service, marketing, and record keeping"
)
KNOWLEDGE_BASE_DIR = Path(__file__).resolve().parent / "knowledge_base"
EXPECTED_FILES = (
    "business_plan.txt",
    "customer_research.txt",
    "customer_service.txt",
    "marketing.txt",
    "cash_flow.txt",
)
FALLBACK_RESPONSE = (
    "I could not find enough relevant information in this project's knowledge "
    "base to answer that reliably. Try rephrasing the question or consult an "
    "appropriate official or qualified source."
)


class QuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, question: str) -> str:
        question = question.strip()
        if not question:
            raise ValueError("Question must not be blank.")
        return question


class SourceCitation(BaseModel):
    source: str
    passage: int
    score: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceCitation]
    mode: Literal["local", "gemini"]


def load_documents() -> list[dict[str, str | int]]:
    missing_files = [
        filename
        for filename in EXPECTED_FILES
        if not (KNOWLEDGE_BASE_DIR / filename).is_file()
    ]
    if missing_files:
        raise FileNotFoundError(
            "Missing required knowledge-base files: " + ", ".join(missing_files)
        )

    documents: list[dict[str, str | int]] = []
    for filename in EXPECTED_FILES:
        raw_text = (KNOWLEDGE_BASE_DIR / filename).read_text(encoding="utf-8")
        for passage_number, paragraph in enumerate(
            re.split(r"\n\s*\n", raw_text.strip()), start=1
        ):
            paragraph = paragraph.strip()
            if paragraph:
                documents.append(
                    {
                        "source": filename,
                        "passage": passage_number,
                        "text": paragraph,
                    }
                )
    if not documents:
        raise ValueError("The knowledge-base files contain no usable passages.")
    return documents


documents = load_documents()
vectorizer = TfidfVectorizer(
    stop_words="english", ngram_range=(1, 2), sublinear_tf=True
)
document_matrix = vectorizer.fit_transform(
    [str(document["text"]) for document in documents]
)

app = FastAPI(
    title="Business Mitra API",
    description="Source-grounded small-business knowledge-base chat API.",
    version="1.0.0",
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    _request: Request, error: StarletteHTTPException
) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"detail": error.detail},
        headers=error.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request, error: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {
                    "loc": list(item.get("loc", ())),
                    "msg": item.get("msg", "Invalid request."),
                    "type": item.get("type", "value_error"),
                }
                for item in error.errors()
            ]
        },
    )


@app.exception_handler(Exception)
async def unexpected_exception_handler(
    _request: Request, error: Exception
) -> JSONResponse:
    LOGGER.exception("Unhandled API error.", exc_info=error)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected API error occurred."},
    )


def retrieve(
    question: str, top_k: int = 3
) -> list[tuple[dict[str, str | int], float]]:
    question_vector = vectorizer.transform([question])
    scores = cosine_similarity(question_vector, document_matrix).ravel()
    ranked_indices = scores.argsort()[::-1][:top_k]
    return [
        (documents[index], float(scores[index]))
        for index in ranked_indices
        if scores[index] > 0.015
    ]


def local_answer(
    hits: list[tuple[dict[str, str | int], float]],
) -> str:
    if not hits:
        return FALLBACK_RESPONSE
    passages = "\n\n---\n\n".join(
        f"**{document['source']} — passage {document['passage']}**\n\n"
        f"{document['text']}"
        for document, _score in hits
    )
    return (
        "Based on the bundled knowledge base, these passages are most relevant:\n\n"
        + passages
    )


def gemini_answer(
    question: str, hits: list[tuple[dict[str, str | int], float]], api_key: str
) -> str:
    from google import genai

    context = "\n\n".join(
        f"[Source: {document['source']}, passage {document['passage']}]\n"
        f"{document['text']}"
        for document, _score in hits
    )
    prompt = (
        "You are a careful question-answering assistant for this topic: "
        + PROJECT_DOMAIN
        + ".\nAnswer the user's question using ONLY the source passages below.\n"
        "If the passages do not contain the answer, say that the knowledge base "
        "does not provide enough information.\n"
        "Do not invent facts. Add inline source citations using exact filenames "
        "in square brackets, e.g. [business_plan.txt].\n"
        "Keep the answer concise and acknowledge uncertainty.\n\n"
        "SOURCE PASSAGES:\n"
        + context
        + "\n\nUSER QUESTION:\n"
        + question
    )
    client = genai.Client(api_key=api_key)
    result = client.models.generate_content(
        model="gemini-2.5-flash", contents=prompt
    )
    generated = (result.text or "").strip()
    return generated or local_answer(hits)


@app.get("/api/health")
def health_check() -> dict[str, str | int]:
    return {"status": "ok", "documents": len(EXPECTED_FILES)}


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: QuestionRequest) -> ChatResponse:
    hits = retrieve(request.question)
    citations = [
        SourceCitation(
            source=str(document["source"]),
            passage=int(document["passage"]),
            score=score,
        )
        for document, score in hits
    ]

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not hits:
        return ChatResponse(answer=FALLBACK_RESPONSE, sources=[], mode="local")
    if not api_key:
        return ChatResponse(
            answer=local_answer(hits), sources=citations, mode="local"
        )

    try:
        answer = gemini_answer(request.question, hits, api_key)
    except Exception as error:
        LOGGER.exception("Gemini generation failed.")
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini could not generate a response. Check the server-side "
                "GEMINI_API_KEY or try again later."
            ),
        ) from error

    return ChatResponse(answer=answer, sources=citations, mode="gemini")