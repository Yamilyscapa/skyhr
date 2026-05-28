import { Fragment, useEffect, useRef, useState } from "react";

/** Parse **bold** segments and render, given a visible character count. */
function renderRich(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/**
 * Types out `text` character-by-character, then calls onDone.
 * If animate=false (e.g. older messages), renders instantly.
 */
export function StreamingText({
  text,
  animate = true,
  onDone,
  speed = 12,
  step = 2,
}: {
  text: string;
  animate?: boolean;
  onDone?: () => void;
  speed?: number;
  step?: number;
}) {
  const [count, setCount] = useState(animate ? 0 : text.length);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!animate) {
      onDone?.();
      return;
    }
    if (count >= text.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
      return;
    }
    const t = setTimeout(() => setCount((c) => Math.min(c + step, text.length)), speed);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, text, animate]);

  // Avoid showing a dangling "**" while a bold marker is half-revealed.
  let visible = text.slice(0, count);
  const opens = (visible.match(/\*\*/g) || []).length;
  if (opens % 2 === 1) visible = visible.replace(/\*\*([^*]*)$/, "$1");

  const streaming = animate && count < text.length;

  return (
    <p className="text-sm leading-relaxed">
      {renderRich(visible)}
      {streaming && (
        <span className="ml-0.5 inline-block h-4 w-[2px] -translate-y-px animate-pulse bg-primary align-middle" />
      )}
    </p>
  );
}
