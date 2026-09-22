import { NavLink, Outlet } from "react-router";
import { Building2, CreditCard, LogOut, Settings2 } from "lucide-react";
import { auth, useAuth } from "../store/auth";

const NAV = [
  { to: "/tenants", label: "Компании", icon: Building2 },
  { to: "/plans", label: "Планы и пакеты", icon: CreditCard },
  { to: "/settings", label: "Настройки", icon: Settings2 },
];

export default function Layout() {
  const { operator } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
              ₮
            </span>
            <span className="text-sm font-semibold text-slate-900">Биллинг HRMS</span>
          </div>

          <nav className="flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isActive ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-500">{operator?.name || operator?.login}</span>
            <button
              onClick={() => auth.signOut()}
              title="Выйти"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
