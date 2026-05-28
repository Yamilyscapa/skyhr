import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowUp,
  Check,
  Copy,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerBlock } from "@/components/copilot/answer-blocks";
import { StreamingText } from "@/components/copilot/streaming-text";
import {
  dailyBrief,
  resolveResponse,
  type CopilotResponse,
} from "@/data/copilot";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: CopilotPage,
});

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; response: CopilotResponse };

const initialMessages = (): Message[] => [
  { id: 0, role: "assistant", response: dailyBrief },
];

function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { q } = Route.useSearch();
  const handledQuery = useRef(false);

  function ask(prompt: string) {
    const text = prompt.trim();
    if (!text) return;
    const userId = ++idRef.current;
    setMessages((m) => [...m, { id: userId, role: "user", text }]);
    setDraft("");
    setPending(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const aId = ++idRef.current;
      setMessages((m) => [
        ...m,
        { id: aId, role: "assistant", response: resolveResponse(text) },
      ]);
      setPending(false);
    }, 600);
  }

  function reset() {
    if (timerRef.current) clearTimeout(timerRef.current);
    idRef.current = 0;
    setPending(false);
    setDraft("");
    setMessages(initialMessages());
  }

  // Auto-ask a query handed off from the Cmd+K palette (?q=…), then clear it.
  useEffect(() => {
    if (q && !handledQuery.current) {
      handledQuery.current = true;
      ask(q);
      navigate({ to: "/", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Keep the newest message in view.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl flex-col">
      {/* Compact brand header */}
      <header className="relative mb-3 flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-tint/40 px-4 py-3 dark:bg-accent">
        <div
          className="pointer-events-none absolute inset-0 text-primary/15 dark:text-white/10 sky-dotgrid"
          aria-hidden
        />
        <span className="relative flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="size-4.5" />
        </span>
        <div className="relative min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">SkyHR Copilot</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-success" />
            En línea · datos de hoy
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={reset}
          className="relative"
        >
          <RotateCcw className="size-3.5" /> Nueva
        </Button>
      </header>

      {/* Scrollable thread */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex flex-col gap-6 pb-4">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="sky-rise flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
                  {m.text}
                </div>
              </div>
            ) : (
              <AssistantMessage
                key={m.id}
                response={m.response}
                animate={m.id === lastAssistantId}
                onAsk={ask}
                onScroll={() =>
                  threadEndRef.current?.scrollIntoView({ block: "end" })
                }
              />
            ),
          )}

          {pending && <ThinkingBubble />}
          <div ref={threadEndRef} />
        </div>
      </div>

      {/* Sticky bottom composer */}
      <div className="pt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
          className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(draft);
              }
            }}
            rows={1}
            placeholder="Pregúntale a SkyHR sobre asistencia, permisos, nómina…"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Enviar">
            <ArrowUp />
          </Button>
        </form>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          Respuestas de demostración · datos de ejemplo
        </p>
      </div>
    </div>
  );
}

function AssistantMessage({
  response,
  animate,
  onAsk,
  onScroll,
}: {
  response: CopilotResponse;
  animate: boolean;
  onAsk: (prompt: string) => void;
  onScroll: () => void;
}) {
  const [done, setDone] = useState(!animate);
  const [doneActions, setDoneActions] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  function copy() {
    const plain = response.summary.replace(/\*\*/g, "");
    navigator.clipboard?.writeText(plain).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function runAction(label: string) {
    setDoneActions((s) => new Set(s).add(label));
  }

  return (
    <div className="sky-rise flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border bg-card p-4">
        <div className="flex flex-col gap-4">
          <StreamingText
            text={response.summary}
            animate={animate}
            onDone={() => {
              setDone(true);
              onScroll();
            }}
          />

          {done && (
            <div className="flex flex-col gap-4 duration-300 animate-in fade-in">
              {response.blocks.map((b, i) => (
                <AnswerBlock key={i} block={b} />
              ))}

              {response.actions && response.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {response.actions.map((a) => {
                    const isDone = doneActions.has(a.label);
                    return (
                      <Button
                        key={a.label}
                        size="sm"
                        variant={isDone ? "success" : a.variant ?? "default"}
                        disabled={isDone}
                        onClick={() => runAction(a.label)}
                      >
                        {isDone ? <Check /> : null}
                        {isDone ? "Hecho" : a.label}
                      </Button>
                    );
                  })}
                </div>
              )}

              {doneActions.size > 0 && (
                <p className="-mt-1 text-xs text-muted-foreground">
                  Acción simulada en esta demo.
                </p>
              )}

              {/* Affordances footer */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                {response.source && (
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3" />
                    {response.source}
                  </span>
                )}
                <span>· ahora</span>
                <div className="ml-auto flex items-center gap-0.5">
                  <IconBtn label="Copiar" onClick={copy} active={copied}>
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </IconBtn>
                  <IconBtn
                    label="Útil"
                    onClick={() => setVote(vote === "up" ? null : "up")}
                    active={vote === "up"}
                  >
                    <ThumbsUp className="size-3.5" />
                  </IconBtn>
                  <IconBtn
                    label="No útil"
                    onClick={() => setVote(vote === "down" ? null : "down")}
                    active={vote === "down"}
                  >
                    <ThumbsDown className="size-3.5" />
                  </IconBtn>
                </div>
              </div>

              {/* Follow-up chips */}
              {response.followups && response.followups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {response.followups.map((f) => (
                    <button
                      key={f}
                      onClick={() => onAsk(f)}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-accent text-primary",
      )}
    >
      {children}
    </button>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Sparkles className="size-4 animate-pulse" />
      </span>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3.5">
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="size-2 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
