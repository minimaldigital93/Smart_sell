"use client";

import { useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";

type Props = {
  date: string | number | Date;
  /** date-fns format string. Ignored when `mode="distance"`. */
  format?: string;
  /** "format" (default) renders an absolute date; "distance" renders a relative one. */
  mode?: "format" | "distance";
  /** Only used when `mode="distance"`. */
  addSuffix?: boolean;
  /** Optional placeholder to render during SSR / before mount. */
  placeholder?: React.ReactNode;
  className?: string;
};

export function ClientDate({
  date,
  format: pattern = "MMM d, yyyy · HH:mm",
  mode = "format",
  addSuffix = true,
  placeholder = null,
  className,
}: Props) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className={className} suppressHydrationWarning>{placeholder}</span>;
  }

  const d = date instanceof Date ? date : new Date(date);
  const text =
    mode === "distance"
      ? formatDistanceToNow(d, { addSuffix })
      : format(d, pattern);

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
