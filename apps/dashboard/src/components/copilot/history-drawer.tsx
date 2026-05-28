import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatMsg = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

/** Slide-over panel holding the session conversation, so the canvas stays the focus. */
export function HistoryDrawer({
  open,
  onClose,
  messages,
  sessionName,
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMsg[];
  sessionName: string;
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
        role="dialog"
        aria-label="Conversación"
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-bold leading-tight">Conversación</p>
            <p className="text-xs text-muted-foreground">{sessionName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-9 items-center justify-center rounded-full hover:bg-accent"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Aún no hay mensajes en esta sesión.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Sparkles className="size-3.5" />
                    </span>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-background px-3.5 py-2 text-sm">
                      {m.text}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
