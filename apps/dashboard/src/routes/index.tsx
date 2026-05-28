import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowUp,
  Check,
  ChevronDown,
  MessageSquare,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CanvasGrid,
  widgetFromResponse,
  type Span,
  type Widget,
} from "@/components/copilot/canvas-grid";
import {
  HistoryDrawer,
  type ChatMsg,
} from "@/components/copilot/history-drawer";
import { resolveResponse, suggestions } from "@/data/copilot";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: CopilotPage,
});

type Session = {
  id: string;
  name: string;
  widgets: Widget[];
  messages: ChatMsg[];
};

const STORAGE_KEY = "skyhr-copilot-sessions";

function freshSession(id: string, name: string): Session {
  return { id, name, widgets: [], messages: [] };
}

function scanMaxId(sessions: Session[]): number {
  let max = 0;
  for (const s of sessions) {
    for (const m of s.messages) max = Math.max(max, m.id);
    for (const w of s.widgets) {
      const n = parseInt(w.id.replace(/\D/g, ""), 10);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
  }
  return max;
}

function CopilotPage() {
  const [sessions, setSessions] = useState<Session[]>([
    freshSession("s-1", "Sesión 1"),
  ]);
  const [currentId, setCurrentId] = useState("s-1");
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [latestFollowups, setLatestFollowups] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const idRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);
  const navigate = useNavigate();
  const { q } = Route.useSearch();
  const handledQuery = useRef(false);

  const current = sessions.find((s) => s.id === currentId) ?? sessions[0];

  // Hydrate from localStorage (client only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { sessions: Session[]; currentId: string };
        if (data.sessions?.length) {
          setSessions(data.sessions);
          setCurrentId(
            data.sessions.find((s) => s.id === data.currentId)?.id ??
              data.sessions[0].id,
          );
          idRef.current = scanMaxId(data.sessions) + 1;
        }
      }
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  // Persist.
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, currentId }));
    } catch {
      /* ignore */
    }
  }, [sessions, currentId]);

  function updateCurrent(fn: (s: Session) => Session) {
    setSessions((prev) => prev.map((s) => (s.id === currentId ? fn(s) : s)));
  }

  function ask(prompt: string) {
    const text = prompt.trim();
    if (!text) return;
    const resp = resolveResponse(text);
    const uid = ++idRef.current;
    updateCurrent((s) => ({
      ...s,
      messages: [...s.messages, { id: uid, role: "user", text }],
    }));
    setDraft("");
    setLatestFollowups([]);
    setPendingTitle(resp.title);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const wid = `w-${++idRef.current}`;
      const aid = ++idRef.current;
      updateCurrent((s) => ({
        ...s,
        widgets: [...s.widgets, widgetFromResponse(resp, wid)],
        messages: [
          ...s.messages,
          { id: aid, role: "assistant", text: resp.summary.replace(/\*\*/g, "") },
        ],
      }));
      setPendingTitle(null);
      setLatestFollowups(resp.followups ?? []);
    }, 700);
  }

  function removeWidget(id: string) {
    updateCurrent((s) => ({ ...s, widgets: s.widgets.filter((w) => w.id !== id) }));
  }

  function reorderWidgets(next: Widget[]) {
    updateCurrent((s) => ({ ...s, widgets: next }));
  }

  function resizeWidget(id: string, span: Span) {
    updateCurrent((s) => ({
      ...s,
      widgets: s.widgets.map((w) => (w.id === id ? { ...w, span } : w)),
    }));
  }

  function newSession() {
    const id = `s-${++idRef.current}`;
    setSessions((prev) => [...prev, freshSession(id, `Sesión ${prev.length + 1}`)]);
    setCurrentId(id);
    setPendingTitle(null);
    setLatestFollowups([]);
    setDrawerOpen(false);
  }

  function switchSession(id: string) {
    setCurrentId(id);
    setPendingTitle(null);
    setLatestFollowups([]);
  }

  // Auto-ask a query handed off from the Cmd+K palette (?q=…).
  useEffect(() => {
    if (q && !handledQuery.current) {
      handledQuery.current = true;
      ask(q);
      navigate({ to: "/", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const isEmpty = current.widgets.length === 0 && !pendingTitle;
  const chips = latestFollowups.length > 0 ? latestFollowups : isEmpty ? suggestions.map((s) => s.prompt) : [];

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col">
      {/* Header: session switcher + actions */}
      <header className="mb-4 flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-2 pr-3 text-sm font-semibold transition-colors hover:bg-accent focus:outline-none">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            {current.name}
            <ChevronDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Sesiones</DropdownMenuLabel>
            {sessions.map((s) => (
              <DropdownMenuItem key={s.id} onSelect={() => switchSession(s.id)}>
                <span className="flex-1 truncate">{s.name}</span>
                {s.id === currentId && <Check className="size-4 text-primary" />}
                {s.widgets.length > 0 && s.id !== currentId && (
                  <span className="text-xs text-muted-foreground">
                    {s.widgets.length}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={newSession}>
              <Plus className="size-4" /> Nueva sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden text-sm text-muted-foreground sm:block">
          {current.widgets.length > 0
            ? `${current.widgets.length} ${current.widgets.length === 1 ? "panel" : "paneles"}`
            : "Lienzo vacío"}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={newSession}>
            <Plus className="size-4" /> Nueva sesión
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            className="relative"
          >
            <MessageSquare className="size-4" />
            Historial
            {current.messages.length > 0 && (
              <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {current.messages.length}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Canvas */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {current.widgets.length > 0 && (
          <p className="mb-3 hidden text-xs text-muted-foreground lg:block">
            Arrastra <span className="font-medium text-foreground">⠿</span> para
            reordenar · arrastra el borde derecho para ocupar 1, 2 o 3 columnas.
          </p>
        )}
        <CanvasGrid
          widgets={current.widgets}
          pendingTitle={pendingTitle}
          onRemove={removeWidget}
          onReorder={reorderWidgets}
          onResize={resizeWidget}
        />
      </div>

      {/* Bottom docked agent bar */}
      <div className="pt-4">
        {chips.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {isEmpty && (
              <span className="self-center text-xs text-muted-foreground">
                Prueba:
              </span>
            )}
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => ask(c)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
          className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30"
        >
          <span className="ml-1 mb-2 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Sparkles className="size-4" />
          </span>
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
            placeholder="Pídele a SkyHR que agregue algo a tu panel…"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!draft.trim() || !!pendingTitle}
            aria-label="Enviar"
          >
            <ArrowUp />
          </Button>
        </form>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          SkyHR construye tu panel a demanda · datos de demostración
        </p>
      </div>

      <HistoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        messages={current.messages}
        sessionName={current.name}
      />
    </div>
  );
}
