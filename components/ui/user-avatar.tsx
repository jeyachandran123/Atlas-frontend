"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U";
}

/**
 * The signed-in person: their Google photo when there is one, their initials
 * otherwise — and the initials again if the photo fails to load, so a broken
 * or expired link never leaves an empty circle.
 */
export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  /** Size and text size, e.g. "size-8 text-[12px]". */
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = !!src && failedSrc !== src;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white",
        className,
      )}
      style={{ background: showPhoto ? "var(--surface-2)" : "var(--accent-gradient)" }}
      aria-hidden
    >
      {showPhoto ? (
        // Google's photo host refuses requests that carry a referrer, hence no-referrer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
