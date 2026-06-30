export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-signal text-sm font-bold text-white">
            A
          </span>
          <span className="text-lg font-semibold text-text-primary">Atlas</span>
        </div>
        {children}
      </div>
    </div>
  );
}
