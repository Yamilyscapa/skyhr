import { useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Download, GripVertical, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerBlock } from "@/components/copilot/answer-blocks";
import type { Action, Block, CopilotResponse } from "@/data/copilot";
import { cn } from "@/lib/utils";

export type Span = 1 | 2 | 3;

export type Widget = {
  id: string;
  title: string;
  source?: string;
  blocks: Block[];
  actions?: Action[];
  span: Span;
};

/** Wide widgets (tables, alerts, drafts) start at 2 columns; the rest, one. */
export function widgetFromResponse(resp: CopilotResponse, id: string): Widget {
  const wide = resp.blocks.some(
    (b) => b.type === "table" || b.type === "alerts" || b.type === "draft",
  );
  return {
    id,
    title: resp.title,
    source: resp.source,
    blocks: resp.blocks,
    actions: resp.actions,
    span: wide ? 2 : 1,
  };
}

const GAP = 16; // matches gap-4

const smSpanClass: Record<Span, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-2",
};
const lgSpanClass: Record<Span, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
};

export function CanvasGrid({
  widgets,
  pendingTitle,
  onRemove,
  onReorder,
  onResize,
}: {
  widgets: Widget[];
  pendingTitle: string | null;
  onRemove: (id: string) => void;
  onReorder: (widgets: Widget[]) => void;
  onResize: (id: string, span: Span) => void;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  if (widgets.length === 0 && !pendingTitle) {
    return <EmptyCanvas />;
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(arrayMove(widgets, oldIndex, newIndex));
      }
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
        <div
          ref={gridRef}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {widgets.map((w) => (
            <SortableWidget
              key={w.id}
              widget={w}
              gridRef={gridRef}
              onRemove={() => onRemove(w.id)}
              onResize={onResize}
            />
          ))}
          {pendingTitle && <PendingWidget title={pendingTitle} />}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableWidget({
  widget,
  gridRef,
  onRemove,
  onResize,
}: {
  widget: Widget;
  gridRef: React.RefObject<HTMLDivElement | null>;
  onRemove: () => void;
  onResize: (id: string, span: Span) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const [doneActions, setDoneActions] = useState<Set<string>>(new Set());
  const [resizing, setResizing] = useState(false);
  const startX = useRef(0);
  const startSpan = useRef<Span>(widget.span);
  const moveRef = useRef<(e: PointerEvent) => void>(() => {});
  const upRef = useRef<() => void>(() => {});

  function beginResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startSpan.current = widget.span;
    setResizing(true);

    moveRef.current = (ev: PointerEvent) => {
      const grid = gridRef.current;
      if (!grid) return;
      const unit = (grid.clientWidth - 2 * GAP) / 3; // one column width
      const dx = ev.clientX - startX.current;
      const delta = Math.round(dx / (unit + GAP));
      const next = Math.min(3, Math.max(1, startSpan.current + delta)) as Span;
      if (next !== widget.span) onResize(widget.id, next);
    };
    upRef.current = () => {
      window.removeEventListener("pointermove", moveRef.current);
      window.removeEventListener("pointerup", upRef.current);
      setResizing(false);
    };
    window.addEventListener("pointermove", moveRef.current);
    window.addEventListener("pointerup", upRef.current);
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col gap-4 rounded-2xl border bg-card p-5",
        smSpanClass[widget.span],
        lgSpanClass[widget.span],
        isDragging ? "z-10 border-primary/50 shadow-xl" : "border-border",
        resizing && "border-primary/60 ring-2 ring-ring/30",
        resizing && "select-none",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label="Mover panel"
            title="Arrastra para reordenar"
            className="mt-0.5 flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/50 transition hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">{widget.title}</h3>
            {widget.source && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="size-3" />
                {widget.source}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline">
            {widget.span} col
          </span>
          <button
            aria-label="Exportar"
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"
          >
            <Download className="size-3.5" />
          </button>
          <button
            onClick={onRemove}
            aria-label="Quitar del panel"
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {widget.blocks.map((b, i) => (
          <AnswerBlock key={i} block={b} />
        ))}
      </div>

      {widget.actions && widget.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {widget.actions.map((a) => {
            const isDone = doneActions.has(a.label);
            return (
              <Button
                key={a.label}
                size="sm"
                variant={isDone ? "success" : a.variant ?? "default"}
                disabled={isDone}
                onClick={() => setDoneActions((s) => new Set(s).add(a.label))}
              >
                {isDone ? <Check /> : null}
                {isDone ? "Hecho" : a.label}
              </Button>
            );
          })}
        </div>
      )}

      {/* Snap-resize handle (desktop): drag right edge to set 1–3 columns */}
      <div
        onPointerDown={beginResize}
        role="separator"
        aria-label="Redimensionar panel"
        title="Arrastra para ocupar 1, 2 o 3 columnas"
        className={cn(
          "absolute right-0 top-1/2 hidden h-12 w-3 -translate-y-1/2 cursor-col-resize touch-none items-center justify-center lg:flex",
          "opacity-0 transition-opacity group-hover:opacity-100",
          resizing && "opacity-100",
        )}
      >
        <span className="h-9 w-1 rounded-full bg-border transition-colors group-hover:bg-primary/60" />
      </div>
    </div>
  );
}

function PendingWidget({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-primary/40 bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-primary dark:text-accent-foreground">
        <Sparkles className="size-4 animate-pulse" />
        Generando {title}…
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function EmptyCanvas() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Sparkles className="size-7" />
      </span>
      <div className="max-w-md">
        <h2 className="text-xl font-bold tracking-tight">Arma tu panel con SkyHR</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Tu lienzo está vacío. Pídele al copiloto los datos que te importan y
          los irá agregando aquí — KPIs, gráficas y tablas — para construir un
          panel a tu medida.
        </p>
      </div>
    </div>
  );
}
