import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Navigate } from "react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signIn, useAdminSession } from "@/features/admin/api";
import { Field, fieldClass, Notice, primaryButtonClass } from "@/features/admin/ui";

export function AdminLoginPage() {
  const session = useAdminSession();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (session.data) return <Navigate to="/admin" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signIn(email, password);
      await queryClient.invalidateQueries({ queryKey: ["admin-session"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Those details were not accepted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-x mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center py-10">
      <div className="mb-6 flex justify-end">
        <ThemeToggle />
      </div>
      <h1 className="text-3xl font-bold">Admin</h1>
      <p className="mt-2 text-sm text-muted">
        Sign in to manage bookings, services, and the schedule.
      </p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        <Field label="Email">
          <input
            className={fieldClass}
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            className={fieldClass}
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button type="submit" className={primaryButtonClass} disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
