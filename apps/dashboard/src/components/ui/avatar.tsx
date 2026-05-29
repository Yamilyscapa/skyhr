import { cn } from "@/lib/utils";

const palette = [
  "#0051fe",
  "#0f9d58",
  "#b45309",
  "#7c93ff",
  "#ed474a",
  "#0891b2",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31;
  return palette[Math.abs(hash) % palette.length];
}

function Avatar({
  name,
  className,
  size = 36,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  const bg = colorFor(name);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize: size * 0.38,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export { Avatar };
