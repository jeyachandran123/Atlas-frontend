"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function ConnectRepoDialog() {
  const [open, setOpen] = useState(false);
  const connectRepo = useConnectRepo();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { provider: "local", default_branch: "main" },
  });

  const provider = watch("provider");

  function onSubmit(values: FormValues) {
    connectRepo.mutate(values, {
      onSuccess: () => {
        toast.success(`${values.name} connected — indexing will start shortly.`);
        setOpen(false);
        reset();
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Failed to connect repository");
      },
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="signal" size="sm">
          <Plus className="size-4" />
          Connect repository
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-text-primary">
              Connect a repository
            </Dialog.Title>
            <Dialog.Close className="text-text-tertiary hover:text-text-primary">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" placeholder="atlas-backend" {...register("name")} />
              {errors.name && <p className="text-xs text-remove">{errors.name.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="provider">Provider</Label>
              <select
                id="provider"
                {...register("provider")}
                className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
              >
                <option value="local">Local path</option>
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="bitbucket">Bitbucket</option>
              </select>
            </div>

            {provider === "local" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="local_path">Local path</Label>
                <Input
                  id="local_path"
                  placeholder="C:\Users\you\projects\atlas"
                  {...register("local_path")}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="remote_url">Remote URL</Label>
                <Input
                  id="remote_url"
                  placeholder="https://github.com/org/repo.git"
                  {...register("remote_url")}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="default_branch">Default branch</Label>
              <Input id="default_branch" {...register("default_branch")} />
            </div>

            <Button type="submit" variant="signal" disabled={connectRepo.isPending} className="mt-1">
              {connectRepo.isPending && <Loader2 className="size-4 animate-spin" />}
              Connect & index
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
