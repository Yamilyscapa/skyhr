import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Sparkles,
  LayoutDashboard,
  Users,
  CalendarCheck,
  Megaphone,
  FileCheck2,
  CornerDownLeft,
  Search,
  type LucideIcon,
} from "lucide-react";
import { suggestions } from "@/data/copilot";

type Ctx = { open: () => void };
const CommandPaletteContext = createContext<Ctx | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within provider");
  return ctx;
}

type NavCmd = { label: string; to: string; icon: LucideIcon; keywords: string };

const navCommands: NavCmd[] = [
  { label: "Copilot", to: "/", icon: Sparkles, keywords: "ia asistente preguntar" },
  { label: "Resumen", to: "/overview", icon: LayoutDashboard, keywords: "dashboard panel estadisticas" },
  { label: "Empleados", to: "/employees", icon: Users, keywords: "personal colaboradores" },
  { label: "Asistencia", to: "/attendance", icon: CalendarCheck, keywords: "checada entrada salida reporte" },
  { label: "Anuncios", to: "/announcements", icon: Megaphone, keywords: "comunicados avisos" },
  { label: "Permisos", to: "/permissions", icon: FileCheck2, keywords: "solicitudes vacaciones ausencias" },
];

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  // Global Cmd/Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();

  const filteredNav = useMemo(
    () =>
      navCommands.filter(
        (c) =>
          !q ||
          c.label.toLowerCase().includes(q) ||
          c.keywords.includes(q),
      ),
    [q],
  );

  const filteredSuggestions = useMemo(
    () => (q ? [] : suggestions),
    [q],
  );

  function goAsk(prompt: string) {
    close();
    navigate({ to: "/", search: { q: prompt } });
  }

  function goTo(to: string) {
    close();
    navigate({ to });
  }

  // Flat list for keyboard nav: [ask?, ...nav, ...suggestions]
  const askItem = q ? { kind: "ask" as const, prompt: query.trim() } : null;
  const items = [
    ...(askItem ? [askItem] : []),
    ...filteredNav.map((c) => ({ kind: "nav" as const, cmd: c })),
    ...filteredSuggestions.map((s) => ({ kind: "suggestion" as const, s })),
  ];

  function runItem(idx: number) {
    const item = items[idx];
    if (!item) return;
    if (item.kind === "ask") goAsk(item.prompt);
    else if (item.kind === "nav") goTo(item.cmd.to);
    else goAsk(item.s.prompt);
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runItem(active);
    }
  }

  let runningIndex = -1;
  const indexOf = () => ++runningIndex;

  return (
    <CommandPaletteContext.Provider value={{ open }}>
      {children}
      <DialogPrimitive.Root open={isOpen} onOpenChange={(o) => (o ? open() : close())}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95"
            onKeyDown={onListKey}
          >
            <DialogPrimitive.Title className="sr-only">
              Buscar y preguntar a SkyHR
            </DialogPrimitive.Title>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4.5 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder="Buscar una sección o preguntar a SkyHR…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
                ESC
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {askItem && (
                <Row
                  active={active === indexOf()}
                  onClick={() => goAsk(askItem.prompt)}
                  icon={Sparkles}
                  label={
                    <>
                      Preguntar a SkyHR:{" "}
                      <span className="font-semibold">“{askItem.prompt}”</span>
                    </>
                  }
                  trailing={<CornerDownLeft className="size-3.5 text-muted-foreground" />}
                />
              )}

              {filteredNav.length > 0 && (
                <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Ir a
                </p>
              )}
              {filteredNav.map((c) => (
                <Row
                  key={c.to}
                  active={active === indexOf()}
                  onClick={() => goTo(c.to)}
                  icon={c.icon}
                  label={c.label}
                />
              ))}

              {filteredSuggestions.length > 0 && (
                <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Sugerencias
                </p>
              )}
              {filteredSuggestions.map((s) => (
                <Row
                  key={s.id}
                  active={active === indexOf()}
                  onClick={() => goAsk(s.prompt)}
                  icon={Sparkles}
                  label={s.label}
                />
              ))}

              {items.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Sin resultados.
                </p>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </CommandPaletteContext.Provider>
  );
}

function Row({
  active,
  onClick,
  icon: Icon,
  label,
  trailing,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => e.currentTarget.focus()}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
      }`}
    >
      <Icon className="size-4.5 text-muted-foreground" />
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}
