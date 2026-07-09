export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </p>
  );
}
