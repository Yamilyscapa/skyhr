import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerBlock } from "@/components/copilot/answer-blocks";
import {
  resolveResponse,
  responseFor,
  suggestions,
  type CopilotResponse,
} from "@/data/copilot";
import { currentAdmin } from "@/data/org";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: CopilotPage,
});

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; response: CopilotResponse };

function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const started = messages.length > 0 || pending;

  function ask(prompt: string, response: CopilotResponse) {
    if (!prompt.trim()) return;
    const userId = ++idRef.current;
    setMessages((m) => [...m, { id: userId, role: "user", text: prompt }]);
    setDraft("");
    setPending(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const aId = ++idRef.current;
      setMessages((m) => [...m, { id: aId, role: "assistant", response }]);
      setPending(false);
    }, 650);
  }

  function submitFree() {
    const prompt = draft.trim();
    if (!prompt) return;
    ask(prompt, resolveResponse(prompt));
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-3xl flex-col">
      {/* Brand hero */}
      <header
        className={cn(
          "sky-rise relative overflow-hidden rounded-2xl border border-border bg-tint/40 px-6 transition-all dark:bg-accent",
          started ? "py-5" : "py-10",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 text-primary/15 dark:text-white/10 sky-dotgrid"
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-accent-foreground">
              SkyHR Copilot
            </p>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {started ? "¿Algo más?" : `¿Qué quieres saber hoy, ${currentAdmin.name.split(" ")[0]}?`}
            </h1>
          </div>
        </div>
      </header>

      {/* Composer */}
      <div className="sky-rise mt-4" style={{ animationDelay: "60ms" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitFree();
          }}
          className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitFree();
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

        {!started && (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => ask(s.prompt, responseFor(s.id))}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conversation */}
      <div className="mt-6 flex flex-col gap-6 pb-8">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="sky-rise flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="sky-rise flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border bg-card p-4">
                <AnswerBody response={m.response} />
              </div>
            </div>
          ),
        )}

        {pending && (
          <div className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Sparkles className="size-4" />
            </span>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3.5">
              <Dot delay={0} />
              <Dot delay={150} />
              <Dot delay={300} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnswerBody({ response }: { response: CopilotResponse }) {
  return (
    <div className="flex flex-col gap-4">
      <AnswerBlock block={{ type: "text", value: response.summary }} />
      {response.blocks.map((b, i) => (
        <AnswerBlock key={i} block={b} />
      ))}
      {response.actions && response.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {response.actions.map((a) => (
            <Button key={a.label} size="sm" variant={a.variant ?? "default"}>
              {a.label}
            </Button>
          ))}
        </div>
      )}
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
