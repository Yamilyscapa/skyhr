import { useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { CalendarClock, Megaphone, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AnnouncementStatusBadge,
  PriorityBadge,
} from "@/components/status-badge";
import { api } from "@/lib/api";
import type { Announcement, AnnouncementStatus } from "@/data/types";

function deriveStatus(publishedAt: string, expiresAt: string | null): AnnouncementStatus {
  const now = Date.now();
  if (new Date(publishedAt).getTime() > now) return "future";
  if (expiresAt && new Date(expiresAt).getTime() <= now) return "expired";
  return "active";
}

export const Route = createFileRoute("/_authed/announcements")({
  component: AnnouncementsPage,
  loader: async (): Promise<Announcement[]> => {
    const res = await api.announcements.list({
      pageSize: 100,
      include_expired: true,
      include_future: true,
    });
    return res.data.map((a): Announcement => ({
      id: a.id,
      title: a.title,
      content: a.content,
      priority: a.priority,
      publishedAt: a.publishedAt,
      expiresAt: a.expiresAt,
      status: deriveStatus(a.publishedAt, a.expiresAt),
      author: a.author ?? "Sistema",
    }));
  },
});

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

const tabs: Array<{ value: AnnouncementStatus | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "future", label: "Programados" },
  { value: "expired", label: "Expirados" },
];

function AnnouncementsPage() {
  const announcements = Route.useLoaderData();
  const [tab, setTab] = useState<AnnouncementStatus | "all">("all");

  const rows = useMemo(
    () => announcements.filter((a) => tab === "all" || a.status === tab),
    [announcements, tab],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Comunicación"
        title="Anuncios"
        description="Publica y administra los comunicados de tu organización."
        actions={<ComposerDialog />}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as AnnouncementStatus | "all")}>
        <TabsList className="flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-4">
        {rows.map((a) => (
          <Card key={a.id} className="sky-rise p-5">
            <div className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Megaphone className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{a.title}</h3>
                  <PriorityBadge priority={a.priority} />
                  <AnnouncementStatusBadge status={a.status} />
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{a.content}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" />
                    Publicado {formatDate(a.publishedAt)}
                  </span>
                  {a.expiresAt && <span>Expira {formatDate(a.expiresAt)}</span>}
                  <span>Por {a.author}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            No hay anuncios en esta categoría.
          </Card>
        )}
      </div>
    </div>
  );
}

function ComposerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">(
    "normal",
  );
  const [expires, setExpires] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.announcements.create({
        title: title.trim(),
        content: content.trim(),
        priority,
        expires_at: expires ? new Date(expires).toISOString() : null,
      });
      if (!res?.data) {
        setError("Respuesta vacía del servidor");
        return;
      }
      setOpen(false);
      setTitle("");
      setContent("");
      setExpires("");
      setPriority("normal");
      router.invalidate();
    } catch (err) {
      setError((err as Error).message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Nueva publicación
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva publicación</DialogTitle>
          <DialogDescription>
            Comparte un comunicado con tu organización.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              required
              placeholder="Ej. Junta general de resultados"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="content">Contenido</Label>
            <Textarea
              id="content"
              required
              placeholder="Escribe el mensaje…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Prioridad</Label>
              <Select
                value={priority}
                onValueChange={(v) =>
                  setPriority(v as "normal" | "important" | "urgent")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="important">Importante</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expires">Expira</Label>
              <Input
                id="expires"
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Publicando…" : "Publicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
