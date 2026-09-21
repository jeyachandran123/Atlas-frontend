import { PageSkeleton } from "@/components/ui/skeleton";

/** Shown while a page's code loads on navigation — the sidebar stays put. */
export default function Loading() {
  return <PageSkeleton />;
}
