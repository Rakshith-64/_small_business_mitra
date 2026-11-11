from pathlib import Path
import re
import os
import streamlit as st
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

APP_DIR = Path(__file__).resolve().parent
KB_DIR = APP_DIR / "knowledge_base"
PROJECT_TITLE = 'Business Mitra: Small Business Basics RAG Chatbot'
PROJECT_DOMAIN = 'Business planning, customer service, marketing, and record keeping'

st.set_page_config(page_title=PROJECT_TITLE, page_icon="📚", layout="centered")
st.title(PROJECT_TITLE)
st.caption("Python • Streamlit • Retrieval-Augmented Generation (RAG) demonstration")
api_key = os.getenv("GEMINI_API_KEY", "").strip()
if api_key:
    st.info("Gemini generation is enabled. Responses are grounded in retrieved local passages; check the displayed source citations.")
else:
    st.info("Local mode is active. The app retrieves and displays source passages without an API key. Set GEMINI_API_KEY to enable optional Gemini-generated answers.")

@st.cache_data
def load_documents():
    docs = []
    for path in sorted(KB_DIR.glob("*.txt")):
        raw = path.read_text(encoding="utf-8")
        # Split by blank lines into source passages while preserving source filenames.
        for i, paragraph in enumerate(re.split(r"\n\s*\n", raw.strip())):
            paragraph = paragraph.strip()
            if paragraph:
                docs.append({
                    "source": path.name,
                    "passage": i + 1,
                    "text": paragraph,
                })
    return docs

documents = load_documents()

@st.cache_resource
def build_index(texts):
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
    matrix = vectorizer.fit_transform(texts)
    return vectorizer, matrix

if not documents:
    st.error("No knowledge-base documents were found. Add .txt files to the knowledge_base folder.")
    st.stop()

vectorizer, matrix = build_index([d["text"] for d in documents])

def retrieve(question, top_k=3):
    query_vec = vectorizer.transform([question])
    scores = cosine_similarity(query_vec, matrix).ravel()
    ranked = scores.argsort()[::-1][:top_k]
    return [(documents[i], float(scores[i])) for i in ranked if scores[i] > 0.015]

def answer_from_context(question, hits):
    if not hits:
        return ("I could not find enough relevant information in this project's knowledge base to answer that reliably. "
                "Try rephrasing the question or consult an appropriate official or qualified source.")
    context = "\n\n".join(
        f"[Source: {doc['source']}, passage {doc['passage']}]\n{doc['text']}"
        for doc, score in hits
    )
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            prompt = (
                "You are a careful question-answering assistant for this topic: " + PROJECT_DOMAIN + ".\n"
                "Answer the user's question using ONLY the source passages below.\n"
                "If the passages do not contain the answer, say that the knowledge base does not provide enough information.\n"
                "Do not invent facts. Add inline source citations using exact filenames in square brackets, e.g. [borrowing_rules.txt].\n"
                "Keep the answer concise and acknowledge uncertainty.\n\n"
                "SOURCE PASSAGES:\n" + context + "\n\nUSER QUESTION:\n" + question
            )
            result = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
            generated = (getattr(result, "text", None) or "").strip()
            if generated:
                return generated
        except Exception:
            # Preserve local functionality if the key, network, quota, or model is unavailable.
            pass
    lead = "Based on the bundled knowledge base, these passages are most relevant:"
    parts = [f"**{doc['source']} — passage {doc['passage']}**\n\n{doc['text']}" for doc, score in hits]
    return lead + "\n\n---\n\n".join(parts)

with st.expander("What this project covers"):
    st.write(PROJECT_DOMAIN)
    st.write("Try one of these questions:")
    st.write(['What belongs in a simple business plan?', 'How can a small business understand customers?', 'Why should a business track cash flow?'])

if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

question = st.chat_input("Ask a question about this project's topic…")
if question:
    st.session_state.messages.append({"role": "user", "content": question})
    with st.chat_message("user"):
        st.markdown(question)
    hits = retrieve(question)
    response = answer_from_context(question, hits)
    with st.chat_message("assistant"):
        st.markdown(response)
        if hits:
            st.caption("Retrieval scores are similarity signals, not factual confidence scores.")
            with st.expander("Retrieved sources and relevance scores"):
                for doc, score in hits:
                    st.write(f"- `{doc['source']}` (passage {doc['passage']}) — {score:.3f}")
    st.session_state.messages.append({"role": "assistant", "content": response})

with st.sidebar:
    st.header("Project information")
    st.write(f"**Topic:** {PROJECT_DOMAIN}")
    st.write(f"**Documents indexed:** {len(documents)}")
    st.write("**Method:** TF-IDF retrieval + source-grounded extractive response")
    st.divider()
    if st.button("Clear conversation"):
        st.session_state.messages = []
        st.rerun()
    st.caption("Academic demonstration only. Replace sample content with reviewed, domain-appropriate material before real-world use.")
