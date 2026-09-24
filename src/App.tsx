import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchOperator } from "./api/auth";
import { isForbidden } from "./api/gateway";
import { auth, useAuth } from "./store/auth";
import Layout from "./components/Layout";
import { Button, Loading } from "./components/ui";
import LoginPage from "./pages/LoginPage";
import TenantsPage from "./pages/TenantsPage";
import TenantPage from "./pages/TenantPage";
import PlansPage from "./pages/PlansPage";
import SettingsPage from "./pages/SettingsPage";
import InvoicePrintPage from "./pages/InvoicePrintPage";

/**
 * Права проверяет сервер: каждый метод требует глобальную роль
 * billing_operator. Этот экран лишь объясняет отказ человеческим языком,
 * а не решает, пускать ли.
 */
function OperatorGate({ children }: { children: React.ReactNode }) {
  const { operator } = useAuth();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["operator"],
    queryFn: fetchOperator,
    // Отказ по правам повторять бессмысленно; всё остальное (прод-Postgres
    // «connection slots», холодная функция, сеть) обычно проходит со второго раза.
    retry: (failureCount, err) => !isForbidden(err) && failureCount < 2,
    retryDelay: 1500,
  });

  useEffect(() => {
    if (data) auth.setOperator(data);
  }, [data]);

  if (isLoading && !operator) return <Loading label="Проверяем доступ…" />;

  // «Нет роли» — только на ответ Forbidden. Любую другую ошибку раньше тоже
  // показывали как отнятую роль, и сбой базы выглядел как потеря доступа.
  if (error && !isForbidden(error)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-slate-900">Биллинг временно недоступен</h1>
          <p className="mt-2 text-sm text-slate-500">
            Сервер не ответил. Обычно это проходит через несколько секунд.
          </p>
          <p className="mt-2 break-words text-xs text-slate-400">{(error as Error).message}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="primary" loading={isFetching} onClick={() => refetch()}>
              Повторить
            </Button>
            <Button onClick={() => auth.signOut()}>Выйти</Button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-slate-900">Нет доступа к биллингу</h1>
          <p className="mt-2 text-sm text-slate-500">
            У вашей учётной записи нет роли оператора биллинга. Попросите коллегу с этой ролью выдать её вам.
          </p>
          <Button className="mt-4" onClick={() => auth.signOut()}>
            Выйти
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  const { token } = useAuth();

  if (!token) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <OperatorGate>
      <Routes>
        {/* Печать живёт вне общей рамки: на бумаге не нужны меню и кнопки. */}
        <Route path="/invoices/:invoiceId/print" element={<InvoicePrintPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/tenants" replace />} />
          <Route path="/tenants" element={<TenantsPage />} />
          <Route path="/tenants/:tenantId" element={<TenantPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/tenants" replace />} />
        </Route>
      </Routes>
    </OperatorGate>
  );
}
