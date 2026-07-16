"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Sparkles,
  Bot,
  User,
  Wifi,
  WifiOff,
  Info,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/providers";

interface Suggestion {
  ar: string;
  en: string;
}

interface CopilotResponse {
  answer: string;
  followups?: string[];
  sources?: string[];
  meta: { source: "openai" | "local"; online: boolean; model?: string };
}

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  followups?: string[];
  sources?: string[];
  offline?: boolean;
}

let msgSeq = 0;

export function CopilotView({
  online,
  suggestions,
}: {
  online: boolean;
  suggestions: Suggestion[];
}) {
  const { t, lang, pick } = useI18n();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  // Live status reflects the last response's engine (starts from server hint).
  const [effectiveOnline, setEffectiveOnline] = React.useState(online);
  const [lastSource, setLastSource] = React.useState<"openai" | "local">(
    online ? "openai" : "local",
  );
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const isOffline = !effectiveOnline || lastSource === "local";

  async function send(question: string) {
    const text = question.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: ++msgSeq, role: "user", text },
    ]);
    setLoading(true);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, lang }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CopilotResponse;
      setEffectiveOnline(data.meta.online);
      setLastSource(data.meta.source);
      setMessages((prev) => [
        ...prev,
        {
          id: ++msgSeq,
          role: "assistant",
          text: data.answer,
          followups: data.followups,
          sources: data.sources,
          offline: !data.meta.online || data.meta.source === "local",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: ++msgSeq,
          role: "assistant",
          text: pick(
            "تعذّر الوصول إلى المساعد الآن. يرجى المحاولة مرة أخرى بعد قليل — المحرك المحلي هو مصدر الحقيقة للقرارات.",
            "I couldn't reach the copilot right now. Please try again shortly — the local engine remains the source of truth for decisions.",
          ),
          offline: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.copilot.title")}
        subtitle={t("page.copilot.subtitle")}
        actions={
          <StatusChip offline={isOffline} />
        }
      />

      {/* Explainer card */}
      <Card className="flex items-start gap-3 border-coral-500/20 bg-coral-500/[0.04] p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl grad-coral">
          <Info className="size-4 text-white" />
        </span>
        <p className="text-sm leading-relaxed text-slate-700">
          {pick(
            "المساعد يشرح ويلخّص ويوصي فقط، ولا يتخذ قرار الموافقة/الرفض النهائي — المحرك المحلي هو مصدر الحقيقة.",
            "The copilot only explains, summarizes and recommends — it never makes the final approve/reject decision. The local engine is the source of truth.",
          )}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Chat column */}
        <Card className="flex h-[62vh] min-h-[460px] flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && !loading && (
              <EmptyChat suggestions={suggestions} onPick={send} />
            )}
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <ChatBubble key={m.id} message={m} onFollowup={send} />
              ))}
            </AnimatePresence>
            {loading && <TypingIndicator />}
          </div>

          {/* Composer */}
          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 border-t border-navy-700/60 bg-navy-900/40 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={pick(
                "اكتب سؤالك عن العمليات أو القواعد أو الأثر المالي…",
                "Ask about transactions, rules or financial impact…",
              )}
              disabled={loading}
              className="h-11 flex-1 rounded-xl border border-navy-600 bg-navy-900/70 px-4 text-sm text-slate-900 placeholder:text-muted focus:border-coral-500/60 focus:outline-none focus:ring-2 focus:ring-coral-500/20 disabled:opacity-50"
            />
            <Button type="submit" size="icon" className="size-11" disabled={loading || !input.trim()}>
              <Send className="size-4 rtl:-scale-x-100" />
            </Button>
          </form>
        </Card>

        {/* Suggestions sidebar */}
        <Card className="h-fit p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Sparkles className="size-3.5 text-coral-600" />
            {pick("أسئلة مقترحة", "Suggested prompts")}
          </p>
          <div className="flex flex-col gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                disabled={loading}
                onClick={() => send(lang === "ar" ? s.ar : s.en)}
                className="group flex items-center gap-2 rounded-xl border border-navy-700/60 bg-navy-900/40 px-3 py-2 text-start text-xs text-slate-700 transition-all hover:border-coral-500/40 hover:bg-coral-500/5 disabled:opacity-50"
              >
                <ArrowRight className="size-3.5 shrink-0 text-coral-600 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
                <span className="leading-relaxed">{lang === "ar" ? s.ar : s.en}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusChip({ offline }: { offline: boolean }) {
  const { pick } = useI18n();
  if (offline) {
    return (
      <Badge variant="warning" className="gap-1.5">
        <WifiOff className="size-3.5" />
        {pick("المساعد الذكي غير متصل — المحرك المحلي", "AI Copilot Offline — local engine")}
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="gap-1.5">
      <Wifi className="size-3.5" />
      {pick("المساعد الذكي متصل", "AI Copilot online")}
    </Badge>
  );
}

function EmptyChat({
  suggestions,
  onPick,
}: {
  suggestions: Suggestion[];
  onPick: (q: string) => void;
}) {
  const { lang, pick } = useI18n();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
      <span className="grid size-14 place-items-center rounded-2xl grad-coral">
        <Bot className="size-7 text-white" />
      </span>
      <div>
        <p className="text-base font-semibold text-slate-900">
          {pick("كيف يمكنني مساعدتك؟", "How can I help?")}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
          {pick(
            "اسأل عن قرارات العمليات وأداء القواعد والأثر المالي. جرّب أحد الأسئلة التالية:",
            "Ask about transaction decisions, rule performance and financial impact. Try one of these:",
          )}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.slice(0, 4).map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(lang === "ar" ? s.ar : s.en)}
            className="rounded-full border border-navy-600 bg-navy-800/60 px-3 py-1.5 text-xs text-slate-700 transition-all hover:border-coral-500/40 hover:text-slate-900"
          >
            {lang === "ar" ? s.ar : s.en}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  onFollowup,
}: {
  message: Message;
  onFollowup: (q: string) => void;
}) {
  const { pick } = useI18n();
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-xl ${
          isUser ? "grad-coral" : "bg-navy-700 text-sky-700"
        }`}
      >
        {isUser ? (
          <User className="size-4 text-slate-900" />
        ) : (
          <Bot className="size-4" />
        )}
      </span>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "grad-coral text-white shadow-lg shadow-coral-600/20"
              : "surface-2 border border-navy-700/60 text-slate-700"
          }`}
        >
          <FormattedText text={message.text} />
        </div>

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <BookOpen className="size-3 text-muted" />
            {message.sources.map((s, i) => (
              <span
                key={i}
                className="rounded-md border border-navy-700/60 bg-navy-900/40 px-1.5 py-0.5 text-[11px] text-muted"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {!isUser && message.followups && message.followups.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.followups.map((f, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onFollowup(f)}
                className="rounded-full border border-coral-500/25 bg-coral-500/5 px-2.5 py-1 text-[11px] text-coral-200 transition-all hover:bg-coral-500/10"
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {!isUser && message.offline && (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700/80">
            <WifiOff className="size-3" />
            {pick("عبر المحرك المحلي", "via local engine")}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// Render simple line breaks and "- " bullet lines.
function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  let key = 0;

  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={`ul-${key++}`} className="my-1 list-disc space-y-0.5 ps-4">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2));
    } else {
      flush();
      if (line.trim() === "") {
        out.push(<div key={`sp-${key++}`} className="h-1.5" />);
      } else {
        out.push(<p key={`p-${key++}`}>{line}</p>);
      }
    }
  }
  flush();
  return <div className="space-y-0.5">{out}</div>;
}

function TypingIndicator() {
  const { pick } = useI18n();
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-navy-700 text-sky-700">
        <Bot className="size-4" />
      </span>
      <div className="surface-2 flex items-center gap-2 rounded-2xl border border-navy-700/60 px-4 py-3">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1.5 rounded-full bg-coral-300"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </span>
        <span className="text-xs text-muted">
          {pick("يفكّر المساعد…", "Copilot is thinking…")}
        </span>
      </div>
    </div>
  );
}
