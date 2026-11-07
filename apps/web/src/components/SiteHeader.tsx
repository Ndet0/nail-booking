import { NavLink } from "react-router";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader({ variant = "solid" }: { variant?: "overlay" | "solid" }) {
  const overlay = variant === "overlay";
  return (
    <header className={overlay ? undefined : "border-b border-border"}>
      <div
        className={`page-x mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-x-3 gap-y-1 ${
          overlay ? "pt-[max(0.75rem,env(safe-area-inset-top))]" : "py-3"
        }`}
      >
        <NavLink
          to="/"
          end
          className={`font-display text-lg font-bold tracking-tight ${
            overlay ? "text-white drop-shadow-md" : ""
          }`}
        >
          NAILS<span className="text-accent">BY</span>CHAO
        </NavLink>
        <div className="flex items-center gap-2">
          <NavLink
            to="/manage"
            className={({ isActive }) =>
              `inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold ${
                overlay
                  ? isActive
                    ? "text-accent"
                    : "text-white drop-shadow-md hover:text-accent"
                  : isActive
                    ? "text-accent"
                    : "hover:text-accent"
              }`
            }
          >
            Manage my booking
          </NavLink>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
