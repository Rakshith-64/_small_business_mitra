"use client";

import { useRef, useState, type FormEvent } from "react";

type SourceCitation = {
  source: string;
  passage: number;
  score: number;
};

type ChatResponse = {
  answer: string;
  sources: SourceCitation[];
  mode: "local" | "gemini";
};

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: SourceCitation[];
  mode?: "local" | "gemini";
};

const suggestedQuestions = [
  "What belongs in a simple business plan?",
  "How can I understand my customers?",
  "Why should I track cash flow?",
];

function isChatResponse(value: unknown): value is ChatResponse {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Partial<ChatResponse>;
  return (
    typeof result.answer === "string" &&
    (result.mode === "local" || result.mode === "gemini") &&
    Array.isArray(result.sources) &&
    result.sources.every(
      (source) =>
        typeof source.source === "string" &&
        typeof source.passage === "number" &&
        typeof source.score === "number",
    )
  );
}

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-[#193d2d] text-[#c8e89c] ${
        small ? "size-10 rounded-xl" : "size-12"
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-6">
        <path
          d="M4.5 18.5c5.4 0 9.5-2.7 12.2-8.1M7 13.5c1.7-5.2 5.3-7.7 11-8-0.1 5.7-2.6 9.3-7.7 11"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 19c.9-2.5 2.7-4.1 5.5-4.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function SourceList({ sources }: { sources: SourceCitation[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-4 border-t border-[#e6ebe3] pt-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7b887e]">
        Sources · similarity is not confidence
      </p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <div
            key={`${source.source}-${source.passage}`}
            className="rounded-lg border border-[#e4e9e1] bg-white/70 px-2.5 py-1.5 text-xs text-[#526056]"
          >
            <span className="font-semibold text-[#294a37]">
              {source.source}
            </span>
            <span className="mx-1.5 text-[#a2aaa3]">·</span>
            passage {source.passage}
            <span className="mx-1.5 text-[#a2aaa3]">·</span>
            {source.score.toFixed(3)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const nextId = useRef(0);
  const conversationEnd = useRef<HTMLDivElement>(null);

  async function sendQuestion(text: string) {
    const trimmedQuestion = text.trim();
    if (!trimmedQuestion || isLoading) return;

    setMessages((current) => [
      ...current,
      {
        id: nextId.current++,
        role: "user",
        content: trimmedQuestion,
      },
    ]);
    setQuestion("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const responseBody = await response.text();
      let result: unknown;
      try {
        result = JSON.parse(responseBody);
      } catch {
        throw new Error(
          `The chat endpoint returned a non-JSON response (HTTP ${response.status}, ${contentType || "unknown content type"}). ` +
            "Make sure the FastAPI backend is running on port 8000 and restart the Next.js dev server.",
        );
      }

      if (!response.ok) {
        const detail =
          typeof result === "object" &&
          result !== null &&
          "detail" in result &&
          typeof result.detail === "string"
            ? result.detail
            : null;
        throw new Error(
          detail ?? "The chat service returned an error.",
        );
      }

      if (!isChatResponse(result)) {
        throw new Error("The chat service returned an invalid response.");
      }

      const chatResult = result;
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          content: chatResult.answer,
          sources: chatResult.sources,
          mode: chatResult.mode,
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The chat service could not be reached. Please try again.",
      );
    } finally {
      setIsLoading(false);
      window.setTimeout(
        () => conversationEnd.current?.scrollIntoView({ behavior: "smooth" }),
        0,
      );
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(question);
  }

  function clearConversation() {
    setMessages([]);
    setQuestion("");
    setError("");
  }

  return (
    <main className="min-h-screen md:flex md:h-screen md:overflow-hidden">
      <aside className="hidden w-[286px] shrink-0 flex-col border-r border-[#e8ebe5] bg-white/75 px-6 py-7 backdrop-blur md:flex">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="font-serif text-[17px] font-semibold tracking-tight text-[#193d2d]">
              Business Mitra
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#839087]">
              Small business basics
            </p>
          </div>
        </div>

        <section className="mt-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#929c94]">
            Your workspace
          </p>
          <div className="mt-4 rounded-2xl border border-[#e8ece6] bg-[#fbfcfa] p-4">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#78a96b]" />
              <span className="text-xs font-semibold text-[#385543]">
                Knowledge base ready
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#78847b]">
              Answers are grounded in five small-business guides with source
              citations.
            </p>
          </div>
        </section>

        <section className="mt-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#929c94]">
            Topics
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-[#526056]">
            {[
              "Business planning",
              "Customer research",
              "Customer service",
              "Marketing",
              "Cash flow",
            ].map((topic) => (
              <li key={topic} className="flex items-center gap-2.5 py-1">
                <span className="size-1.5 rounded-full bg-[#b1c9a6]" />
                {topic}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-auto">
          <div className="mb-4 rounded-xl bg-[#f3f6f0] p-3.5">
            <p className="text-xs font-semibold text-[#385543]">
              Local-first answers
            </p>
            <p className="mt-1 text-[11px] leading-4 text-[#7b887e]">
              Gemini is optional. Your API key stays on the server.
            </p>
          </div>
          <button
            type="button"
            onClick={clearConversation}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#526056] transition hover:bg-[#f3f6f0] hover:text-[#193d2d]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="size-4"
              aria-hidden="true"
            >
              <path
                d="M4 11a8 8 0 1 1 2.1 5.4M4 5v6h6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Clear conversation
          </button>
          <p className="mt-5 text-[10px] leading-4 text-[#9aa39b]">
            Educational demonstration only. Verify important business
            decisions with qualified sources.
          </p>
        </div>
      </aside>

      <section className="flex min-h-screen min-w-0 flex-1 flex-col md:min-h-0">
        <header className="flex items-center justify-between border-b border-[#e9ede7] bg-white/55 px-4 py-3.5 backdrop-blur sm:px-7 md:px-10 md:py-5">
          <div className="flex items-center gap-3 md:hidden">
            <BrandMark small />
            <div>
              <p className="text-sm font-semibold text-[#193d2d]">
                Business Mitra
              </p>
              <p className="text-[10px] text-[#829087]">
                Small business basics
              </p>
            </div>
          </div>
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.19em] text-[#8b978e] md:block">
            Your practical knowledge companion
          </p>
          <div className="ml-auto flex items-center gap-2 text-xs font-medium text-[#647268]">
            <span className="size-2 rounded-full bg-[#78a96b]" />
            <span className="hidden sm:inline">Five guides indexed</span>
            <span className="sm:hidden">Ready</span>
          </div>
          <button
            type="button"
            onClick={clearConversation}
            aria-label="Clear conversation"
            className="ml-3 flex size-9 items-center justify-center rounded-xl border border-[#e6ebe4] bg-white text-[#66736a] transition hover:bg-[#f0f4ed] md:hidden"
          >
            <span aria-hidden="true">↻</span>
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-7 sm:px-7 md:px-10 md:py-9">
            <div className="mx-auto w-full max-w-[790px]">
              {messages.length === 0 ? (
                <div className="mx-auto flex min-h-[min(60vh,570px)] max-w-[650px] flex-col justify-center py-8">
                  <div className="mb-7 flex size-14 items-center justify-center rounded-[20px] border border-[#e1eadc] bg-[#edf4e9]">
                    <BrandMark small />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c927e]">
                    A thoughtful place to start
                  </p>
                  <h1 className="mt-3 max-w-[600px] font-serif text-[34px] leading-[1.13] tracking-[-0.035em] text-[#193d2d] sm:text-[44px]">
                    Small steps make strong businesses.
                  </h1>
                  <p className="mt-4 max-w-[520px] text-[15px] leading-7 text-[#6d7a70]">
                    Welcome to Business Mitra. Ask about planning, customers,
                    marketing, or cash flow. Answers draw from the project
                    guides and show their sources.
                  </p>

                  <div className="mt-9">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.17em] text-[#89958c]">
                      Try asking
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {suggestedQuestions.map((suggestion) => (
                        <button
                          type="button"
                          key={suggestion}
                          onClick={() => void sendQuestion(suggestion)}
                          disabled={isLoading}
                          className="group flex min-h-[58px] items-center justify-between gap-3 rounded-2xl border border-[#e4e9e1] bg-white/80 px-4 py-3 text-left text-[13px] font-medium leading-5 text-[#48584d] shadow-[0_2px_8px_rgb(25_61_45_/_3%)] transition hover:border-[#c5d6bd] hover:bg-[#fbfdf9] disabled:opacity-50"
                        >
                          {suggestion}
                          <span className="text-[#96aa8b] transition group-hover:translate-x-0.5">
                            →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-7 pb-6">
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      className={`flex gap-3.5 sm:gap-4 ${
                        message.role === "user" ? "justify-end" : ""
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center">
                          <BrandMark small />
                        </div>
                      )}
                      <div
                        className={`max-w-[min(88%,650px)] rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 ${
                          message.role === "user"
                            ? "rounded-br-md bg-[#234936] text-white"
                            : "rounded-tl-md border border-[#e7ebe5] bg-white text-[#35463a] shadow-[0_3px_14px_rgb(25_61_45_/_3%)]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-[14px] leading-6">
                          {message.content}
                        </p>
                        {message.role === "assistant" && message.sources && (
                          <SourceList sources={message.sources} />
                        )}
                        {message.role === "assistant" && message.mode && (
                          <p className="mt-3 text-[10px] text-[#87938a]">
                            {message.mode === "gemini"
                              ? "Gemini · grounded in retrieved passages"
                              : "Local retrieval · extractive response"}
                          </p>
                        )}
                      </div>
                      {message.role === "user" && (
                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#e4e9e2] bg-white text-xs font-semibold text-[#5b6b60]">
                          You
                        </div>
                      )}
                    </article>
                  ))}

                  {isLoading && (
                    <div
                      className="flex items-center gap-3.5"
                      role="status"
                      aria-live="polite"
                    >
                      <BrandMark small />
                      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-[#e7ebe5] bg-white px-5 py-4">
                        <span className="size-1.5 animate-pulse rounded-full bg-[#809b7a]" />
                        <span className="size-1.5 animate-pulse rounded-full bg-[#809b7a] [animation-delay:150ms]" />
                        <span className="size-1.5 animate-pulse rounded-full bg-[#809b7a] [animation-delay:300ms]" />
                        <span className="ml-2 text-xs text-[#849087]">
                          Looking through the guides...
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={conversationEnd} />
                </div>
              )}
              {error && (
                <div
                  role="alert"
                  className="mx-auto mt-3 max-w-[650px] rounded-xl border border-[#efd8d0] bg-[#fff8f5] px-4 py-3 text-sm leading-5 text-[#925943]"
                >
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#e9ede7] bg-[#f9faf7]/90 px-4 pb-4 pt-3 sm:px-7 sm:pb-6 md:px-10 md:pt-4">
            <div className="mx-auto w-full max-w-[790px]">
              <form
                onSubmit={handleSubmit}
                className="flex items-end gap-3 rounded-[20px] border border-[#dfe6dc] bg-white p-2 shadow-[0_8px_28px_rgb(25_61_45_/_6%)] transition focus-within:border-[#a9c29f] focus-within:ring-4 focus-within:ring-[#e5efdf]/70"
              >
                <label className="sr-only" htmlFor="question">
                  Ask a question about small businesses
                </label>
                <textarea
                  id="question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendQuestion(question);
                    }
                  }}
                  placeholder="Ask about planning, customers, marketing, or cash flow..."
                  rows={1}
                  maxLength={1000}
                  disabled={isLoading}
                  className="max-h-32 min-h-11 flex-1 resize-y bg-transparent px-3 py-3 text-sm leading-5 text-[#253a2d] outline-none placeholder:text-[#9aa49c] disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isLoading || !question.trim()}
                  className="mb-0.5 flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#193d2d] px-3.5 text-sm font-semibold text-white transition hover:bg-[#28523b] disabled:cursor-not-allowed disabled:bg-[#aab8ad] sm:px-4"
                >
                  <span className="hidden sm:inline">
                    {isLoading ? "Thinking" : "Send"}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="size-4"
                    aria-hidden="true"
                  >
                    <path
                      d="m21 3-7.1 18-3.8-7.1L3 10.1 21 3Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10.1 13.9 15 9"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </form>
              <p className="mt-2.5 text-center text-[10px] leading-4 text-[#99a29a]">
                Responses use the bundled guides. Similarity scores are not
                factual confidence.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}