"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConnectRepo } from "@/lib/hooks/use-repos";
import { ApiError } from "@/types/api";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  provider: z.enum(["local", "github", "gitlab", "bitbucket"]),
  local_path: z.string().optional(),
  remote_url: z.string().optional(),
  default_branch: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const PROVIDERS = [
  { value: "local",     label: "Local" },
  { value: "github",    label: "GitHub" },
  { value: "gitlab",    label: "GitLab" },
  { value: "bitbucket", label: "Bitbucket" },
] as const;

export function ConnectRepoDialog() {
  const [open, setOpen] = useState(false);
  const connectRepo = useConnectRepo();
  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { provider: "local", default_branch: "main" },
  });
  const provider = watch("provider");

  function onSubmit(values: FormValues) {
    connectRepo.mutate(values, {
      onSuccess: () => {
        toast.success(`${values.name} connected — indexing starting.`);
        setOpen(false);
        reset();
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to connect"),
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="signal-btn flex items-center gap-2 px-4 py-2 text-[13px] font-semibold">
          <Plus className="size-3.5" />
          Connect repository
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-[440px] -translate-x-1/2 -translate-y-1/2 animate-scale-up"
        >
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow-2xl)",
            }}
          >
            {/* Top accent */}
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
              }}
            />

            <div className="p-6">
              {/* Header */}
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <Dialog.Title
                    className="text-[16px] font-semibold"
                    style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
                  >
                    Connect repository
                  </Dialog.Title>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                    Index your codebase for AI-powered answers
                  </p>
                </div>
                <Dialog.Close
                  className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-3)]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="size-4" />
                </Dialog.Close>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField label="Display name" error={errors.name?.message}>
                  <input placeholder="my-project" {...register("name")} className="dialog-input" />
                </FormField>

                {/* Provider tabs */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                    Provider
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PROVIDERS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setValue("provider", value)}
                        className="rounded-lg py-2 text-[12px] font-medium transition-all duration-100"
                        style={
                          provider === value
                            ? {
                                background: "var(--accent-subtle)",
                                border: "1px solid var(--accent-border)",
                                color: "var(--accent-glow)",
                              }
                            : {
                                background: "var(--surface-2)",
                                border: "1px solid var(--border-default)",
                                color: "var(--text-tertiary)",
                              }
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {provider === "local" ? (
                  <FormField label="Local path">
                    <input
                      placeholder="C:\projects\my-app"
                      {...register("local_path")}
                      className="dialog-input"
                    />
                  </FormField>
                ) : (
                  <FormField label="Remote URL">
                    <input
                      placeholder="https://github.com/org/repo.git"
                      {...register("remote_url")}
                      className="dialog-input"
                    />
                  </FormField>
                )}

                <FormField label="Default branch">
                  <input {...register("default_branch")} className="dialog-input" />
                </FormField>

                <button
                  type="submit"
                  disabled={connectRepo.isPending}
                  className="signal-btn mt-1 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-semibold"
                >
                  {connectRepo.isPending && <Loader2 className="size-4 animate-spin" />}
                  Connect & index
                </button>
              </form>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FormField({
  label, error, children,
}: {
  label: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[11px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
