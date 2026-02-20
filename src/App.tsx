import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GoogleGenAI } from "@google/genai";
import { cn } from "./lib/utils";

const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string) || "";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  pending?: boolean;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "こんにちは！質問を入力してください。",
      time: formatTime(new Date()),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // FAQ / system prompt (generated from public/mock-responses.json)
  const [, setFaqs] = useState<Array<{ question: string; answer: string }>>([]);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Gemini client + chat session refs
  const aiRef = useRef<any>(null);
  const chatRef = useRef<any>(null);



  // load local FAQ -> build SYSTEM_PROMPT
  useEffect(() => {
    fetch("/mock-responses.json")
      .then((r) => r.json())
      .then((data: { responses: Array<{ question: string; answer: string }>; default: string }) => {
        setFaqs(data.responses ?? []);

        const header = `あなたは「株式会社ソースクリエイト」の採用サポートAIです。\n以下の【FAQデータ】を元に、お客様の質問に丁寧で分かりやすく答えてください。\n回答は簡潔にまとめ、もしFAQデータにない質問をされた場合は、無理に推測せず「申し訳ございませんが、その質問にはお答えできません。詳細は採用窓口(recruit@source.co.jp)までお問い合わせください。」と案内してください。\n\n【FAQデータ】\n`;

        const faqText = (data.responses ?? [])
          .map((r) => `Q: ${r.question}\nA: ${r.answer}`)
          .join("\n\n");

        const sys = header + faqText + "\n\n返答ルール: FAQに正確に基づいて回答してください。FAQにない場合は上記の謝罪メッセージのみを返してください。";
        setSystemPrompt(sys);
      })
      .catch((err) => {
        console.error("failed to load mock-responses.json", err);
        setFaqs([]);
        setSystemPrompt(null);
      });

    // initialize Gemini client & chat session on mount
    if (!API_KEY) return;
    try {
      aiRef.current = new GoogleGenAI({ apiKey: API_KEY });
      chatRef.current = aiRef.current.chats.create({ model: "gemini-2.5-flash" });
    } catch (err) {
      console.error("Gemini init error:", err);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      text: trimmed,
      time: formatTime(new Date()),
    };

    setMessages((s) => [...s, userMsg]);
    setInput("");

    const pendingId = `pending-${Date.now()}`;
    const pendingMsg: Message = {
      id: pendingId,
      role: "assistant",
      text: "...",
      time: formatTime(new Date()),
      pending: true,
    };

    setMessages((s) => [...s, pendingMsg]);

    // Gemini mode
    if (!API_KEY) {
      setMessages((s) => s.map((m) => (m.id === pendingId ? { ...m, text: "VITE_GEMINI_API_KEY が未設定です。", pending: false } : m)));
      return;
    }

    if (!chatRef.current) {
      setMessages((s) => s.map((m) => (m.id === pendingId ? { ...m, text: "チャットセッションの初期化に失敗しました。", pending: false } : m)));
      return;
    }

    setIsLoading(true);

    try {
      // prepend SYSTEM_PROMPT to instruct the model to answer only from the FAQ
      const sys = systemPrompt ?? "FAQ のみを参照してください。該当しなければ謝罪の文面を返してください。";
      const promptForModel = `${sys}\n\nUser question: ${trimmed}`;

      // Try streaming first. SDKs may return an async iterable for stream=true.
      const maybeStream = chatRef.current.sendMessage({ message: promptForModel, stream: true });

      // async iterable (streaming) path
      if (maybeStream && typeof (maybeStream as any)[Symbol.asyncIterator] === "function") {
        let accumulated = "";
        // eslint-disable-next-line no-undef
        for await (const part of maybeStream as AsyncIterable<any>) {
          const chunk =
            typeof part === "string"
              ? part
              : part?.delta ?? part?.text ?? part?.content ?? part?.candidate?.content ?? part?.candidates?.[0]?.content ?? part?.response?.text ?? part?.output?.[0]?.content?.[0]?.text ?? null;

          if (chunk) {
            accumulated += chunk;
            setMessages((s) => s.map((m) => (m.id === pendingId ? { ...m, text: normalizeMarkdown(accumulated) } : m)));
          }
        }

        // finalize streamed response
        setMessages((s) => s.map((m) => (m.id === pendingId ? { ...m, text: normalizeMarkdown(accumulated), pending: false } : m)));
      } else {
        // fallback: non-streaming promise result
        const response = await maybeStream;
        const textResponse = response?.text ?? response?.candidates?.[0]?.content ?? String(response ?? "");
        setMessages((s) => s.map((m) => (m.id === pendingId ? { ...m, text: normalizeMarkdown(textResponse), pending: false } : m)));
      }
    } catch (err) {
      console.error("Gemini API error:", err);
      setMessages((s) => s.map((m) => (m.id === pendingId ? { ...m, text: "API 呼び出しでエラーが発生しました。コンソールを参照してください。", pending: false } : m)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
        <header className="px-6 py-4 border-b bg-linear-to-r from-sky-50 to-white flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">AI 採用サポート</h1>
            <p className="text-sm text-slate-500">AIと連携してソースクリエイトの採用に関するご質問にお答えします。</p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                API_KEY ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              )}
            >
              {API_KEY ? "AI: 有効" : "AI: 無効"}
            </span>
          </div>
        </header>

        <main className="px-6 py-4 h-[60vh] flex flex-col">
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[78%] px-4 py-2 rounded-xl wrap-break-word",
                    m.role === "user" ? "bg-sky-600 text-white rounded-br-none" : "bg-slate-100 text-slate-900 rounded-bl-none"
                  )}
                >
                  <div className="text-sm whitespace-pre-wrap">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code: ({ inline, children }: any) =>
                          inline ? (
                            <code className="bg-slate-100 px-1 rounded text-xs font-mono">{children}</code>
                          ) : (
                            <pre className="bg-slate-900 text-white p-3 rounded overflow-auto"><code className="font-mono text-sm">{children}</code></pre>
                          ),
                        a: ({ href, children }: any) => (
                          <a href={String(href)} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline">
                            {children}
                          </a>
                        ),
                        strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
                        em: ({ children }: any) => <em className="italic">{children}</em>,
                      }}
                    >
                      {normalizeMarkdown(m.text)}
                    </ReactMarkdown>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 text-right">{m.time}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="text-sm text-slate-500">考え中…</div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="mt-4">


            {!API_KEY && (
              <div className="mb-3 text-sm text-rose-600">APIキーが未設定です</div>
            )}

            <div className="flex gap-3">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ここに入力して Enter で送信..."
                className="flex-1 resize-none rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                disabled={!API_KEY}
              />
              <button
                onClick={() => sendMessage(input)}
                className="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-sky-700 disabled:opacity-50"
                disabled={!API_KEY || isLoading || input.trim() === ""}
              >
                送信
              </button>
            </div>
          </div>
        </main>

        <footer className="px-6 py-3 border-t text-xs text-slate-500">※ 該当する質問以外は回答できません。</footer>
      </div>
    </div>
  );
}


function normalizeMarkdown(text: string) {
  if (!text) return text;

  // Decode a few common HTML entities that models sometimes return
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&ast;': '*',
  };
  text = text.replace(/&(amp|lt|gt|quot|#39|ast);/g, (m) => entities[m] ?? m);

  // Unescape backslash-escaped markdown markers so react-markdown can parse them.
  // e.g. "\*\*bold\*\*" -> "**bold**"
  text = text.replace(/\\([*_`~\\])/g, '$1');

  return text;
}

function formatTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
