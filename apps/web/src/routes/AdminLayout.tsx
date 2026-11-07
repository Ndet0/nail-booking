import { useQueryClient } from "@tanstack/react-query";
import { Navigate, NavLink, Outlet } from "react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut, useAdminNotifications, useAdminSession } from "@/features/admin/api";
import { secondaryButtonClass } from "@/features/admin/ui";
import { ApiError } from "@/lib/api";

const LINKS = [
  { to: "/admin", label: "Bookings", end: true },
  { to: "/admin/calendar", label: "Calendar", end: false },
  { to: "/admin/notifications", label: "Notifications", end: false },
  { to: "/admin/services", label: "Services", end: false },
  { to: "/admin/staff", label: "Staff", end: false },
  { to: "/admin/gallery", label: "Gallery", end: false },
];

export function AdminLayout() {
  const session = useAdminSession();
  const notifications = useAdminNotifications(Boolean(session.data));
  const unread = notifications.data?.unreadCount ?? 0;
  const queryClient = useQueryClient();

  if (session.isPending) {
    return <p className="page-x py-10 text-muted">Checking your session…</p>;
  }
  if (session.isError) {
    const forbidden = session.error instanceof ApiError && session.error.status === 403;
    return (
      <p className="page-x py-10 text-danger">
        {forbidden
          ? "This account is not an administrator."
          : "The admin dashboard couldn't be opened."}
      </p>
    );
  }
  if (!session.data) return <Navigate to="/admin/login" replace />;

  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
      <header className="border-b border-border">
        <div className="page-x mx-auto flex w-full max-w-3xl items-center justify-between gap-3 py-3">
          <p className="font-display text-lg font-bold tracking-tight">
            NAILS<span className="text-accent">BY</span>CHAO
          </p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                void signOut().finally(() => {
                  queryClient.setQueryData(["admin-session"], null);
                });
              }}
            >
              Sign out
            </button>
          </div>
        </div>
        <nav
          aria-label="Admin"
          className="page-x mx-auto flex w-full max-w-3xl gap-2 overflow-x-auto pb-3"
        >
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold ${
                  isActive ? "bg-accent text-accent-foreground" : "border border-border"
                }`
              }
            >
              {link.label}
              {link.to === "/admin/notifications" && unread > 0 ? ` (${unread})` : ""}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="page-x mx-auto flex w-full min-w-0 max-w-3xl flex-1 flex-col gap-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
