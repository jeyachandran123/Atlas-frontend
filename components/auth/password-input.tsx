"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * A password field with an eye to show what was typed. Forwards its ref, so
 * react-hook-form's register() works on it exactly as on a plain input.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { style, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        // Room for the eye, whatever padding the field's class sets.
        style={{ ...style, paddingRight: 40 }}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[10px] transition-colors hover:text-[var(--text-primary)]"
        style={{ color: "var(--text-muted)" }}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});
