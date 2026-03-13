import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "./lib/utils";

const API_KEY = (import.meta.env.VITE_API_KEY as string) || "";
const CHAT_URL = "/api/chat";

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {}, []);

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

    if (!API_KEY) {
      setMessages((s) => s.map((m) => (m.id === pendingId ? { ...m, text: "VITE_GEMINI_API_KEY が未設定です。", pending: false } : m)));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (res.status === 403) {
        setMessages((s) => s.map((m) => (m.id === pendingId ? { ...m, text: "APIキーが無効です。管理者にご確認ください。", pending: false } : m)));
        return;
      }

      if (res.status === 500) {
        setMessages((s) => s.map((m) => (m.id === pendingId ? { ...m, text: "サーバーエラーが発生しました。しばらく経ってから再度お試しください。", pending: false } : m)));
        return;
      }

      if (!res.ok) {
        setMessages((s) => s.map((m) => (m.id === pendingId ? { ...m, text: `エラーが発生しました（HTTP ${res.status}）。しばらくしてから再度お試しください。`, pending: false } : m)));
        return;
      }

      const data = await res.json();
      const reply = String(data?.reply ?? "");
      setMessages((s) => s.map((m) => (m.id === pendingId ? { ...m, text: normalizeMarkdown(reply), pending: false } : m)));
    } catch (err) {
      console.error("Chat API error:", err);
      setMessages((s) => s.map((m) => (m.id === pendingId ? { ...m, text: "申し訳ございませんが、現在回答できません。「えんサポート24」0120-97-3655(24時間受付)へご連絡ください。", pending: false } : m)));
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
        <header className="px-6 py-4 border-b border-[#A0A0A0] bg-[#3A8E42] flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">えんくらぶサポート</h1>
            <p className="text-sm text-white">入居者様向けのご質問にAIがお答えします。</p>
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
                className="bg-[#3A8E42] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#367836] disabled:opacity-50"
                disabled={!API_KEY || isLoading || input.trim() === ""}
              >
                送信
              </button>
            </div>
          </div>
        </main>

        <footer className="px-6 py-3 border-t border-[#A0A0A0] text-xs text-slate-500">※ 該当する質問以外は回答できません。</footer>
      </div>
    </div>
  );
}



function normalizeMarkdown(input: any) {
  const text = input == null ? "" : String(input);
  if (text === "") return text;

  // Decode a few common HTML entities that models sometimes return
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&ast;': '*',
  };
  let s = text.replace(/&(amp|lt|gt|quot|#39|ast);/g, (m) => entities[m] ?? m);

  // Unescape backslash-escaped markdown markers so react-markdown can parse them.
  // e.g. "\\*\\*bold\\*\\*" -> "**bold**"
  s = s.replace(/\\([*_`~\\])/g, '$1');

  return s;
}

function formatTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
