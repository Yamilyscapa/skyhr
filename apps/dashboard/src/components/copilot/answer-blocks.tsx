import { Fragment } from "react";
import { FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Block, Tone } from "@/data/copilot";

const toneColor: Record<Tone, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "var(--muted-foreground)",
};

/** Render **bold** segments in otherwise plain text. */
function RichText({ value }: { value: string }) {
  const parts = value.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="text-sm leading-relaxed">
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

export function AnswerBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "text":
      return <RichText value={block.value} />;

    case "metrics":
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {block.items.map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-border bg-background/60 p-3"
            >
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p
                className="mt-1 text-xl font-bold tabular-nums"
                style={{ color: m.tone ? toneColor[m.tone] : undefined }}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>
      );

    case "table":
      return (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {block.columns.map((c) => (
                  <TableHead key={c}>{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell
                      key={j}
                      className={j === 0 ? "font-medium" : "text-muted-foreground"}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );

    case "bars": {
      const max = Math.max(...block.items.map((i) => i.value), 1);
      return (
        <div className="flex flex-col gap-2.5">
          {block.items.map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">
                {b.label}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(b.value / max) * 100}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums">
                {b.value.toLocaleString("es-MX")}
                {block.unit ? "" : ""}
              </span>
            </div>
          ))}
          {block.unit && (
            <span className="text-right text-[11px] text-muted-foreground">
              {block.unit}
            </span>
          )}
        </div>
      );
    }

    case "draft":
      return (
        <div className="rounded-xl border border-dashed border-primary/40 bg-accent/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary dark:text-accent-foreground">
            <FileText className="size-3.5" />
            Borrador generado
          </div>
          <p className="font-semibold">{block.title}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{block.body}</p>
        </div>
      );
  }
}
