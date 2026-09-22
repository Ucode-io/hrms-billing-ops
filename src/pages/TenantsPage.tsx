import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Play, Search } from "lucide-react";
import { useRunTick, useTenants } from "../api/billing";
import type { TenantRow } from "../api/billing";
import { Badge, Button, Card, ErrorBox, Input, Loading, Select, Table, Td, errorText, useToast } from "../components/ui";
import { STATUS, day, uzs } from "../lib/format";

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  ...Object.entries(STATUS).map(([value, meta]) => ({ value, label: meta.label })),
];

function StatusCell({ status }: { status: string }) {
  const meta = STATUS[status] ?? { label: status, tone: "slate" as const, hint: "" };
  return (
    <Badge tone={meta.tone} title={meta.hint}>
      {meta.label}
    </Badge>
  );
}

function Totals({ rows }: { rows: TenantRow[] }) {
  const totals = useMemo(() => {
    let debt = 0;
    let balance = 0;
    let billed = 0;
    for (const row of rows) {
      debt += row.debt_uzs;
      balance += row.balance_uzs;
      if (row.status !== "unbilled") billed += 1;
    }
    return { debt, balance, billed };
  }, [rows]);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card>
        <div className="text-xs text-slate-500">Компаний на биллинге</div>
        <div className="mt-1 text-xl font-semibold text-slate-900 tnum">
          {totals.billed} <span className="text-sm font-normal text-slate-400">из {rows.length}</span>
        </div>
      </Card>
      <Card>
        <div className="text-xs text-slate-500">Долг к оплате</div>
        <div className="mt-1 text-xl font-semibold text-rose-700 tnum">{uzs(totals.debt)}</div>
      </Card>
      <Card>
        <div className="text-xs text-slate-500">Средства на балансах</div>
        <div className="mt-1 text-xl font-semibold text-slate-900 tnum">{uzs(totals.balance)}</div>
      </Card>
    </div>
  );
}

export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const toast = useToast();

  const { data, isLoading, error } = useTenants({
    search: search.trim() || undefined,
    status: status || undefined,
  });
  const runTick = useRunTick();

  const rows = data ?? [];

  function onRunTick() {
    runTick.mutate(
      {},
      {
        onSuccess: (summary) => {
          toast(
            "ok",
            `Пересчёт выполнен: компаний ${summary.processed}, продлений ${summary.renewed}, оплачено ${summary.paid}, ` +
              `просрочек ${summary.past_due}, дней отсрочки ${summary.grace_days}` +
              (summary.errors.length ? `, ошибок ${summary.errors.length}` : "")
          );
        },
        onError: (e) => toast("error", errorText(e)),
      }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">Компании</h1>
        <Button onClick={onRunTick} loading={runTick.isPending} title="Пересчитать подписки и списания прямо сейчас">
          <Play className="h-4 w-4" /> Пересчитать сейчас
        </Button>
      </div>

      <Totals rows={rows} />

      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Название компании"
              className="pl-9"
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-52">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {error ? <ErrorBox error={error} /> : null}
        {isLoading ? (
          <Loading />
        ) : (
          <Table
            head={["Компания", "Статус", "План", "Сотрудники", "Баланс", "Долг", "Следующее списание", ""]}
            empty={rows.length === 0}
          >
            {rows.map((row) => (
              <tr key={row.tenant_id} className="hover:bg-slate-50">
                <Td>
                  <Link to={`/tenants/${row.tenant_id}`} className="font-medium text-slate-900 hover:underline">
                    {row.name}
                  </Link>
                  {row.last_error ? (
                    <div className="mt-0.5 max-w-xs truncate text-xs text-rose-600" title={row.last_error}>
                      {row.last_error}
                    </div>
                  ) : null}
                </Td>
                <Td>
                  <StatusCell status={row.status} />
                  {row.grace_until && row.status === "past_due" ? (
                    <div className="mt-0.5 text-xs text-slate-400">просмотр с {day(row.grace_until)}</div>
                  ) : null}
                </Td>
                <Td className="text-slate-600">{row.plan?.title ?? "—"}</Td>
                <Td className="tnum text-slate-600">
                  {row.seats_now}
                  {row.over_seats_now > 0 ? (
                    <span className="ml-1 text-amber-700">(+{row.over_seats_now} сверх)</span>
                  ) : null}
                </Td>
                <Td className={`tnum ${row.balance_uzs < 0 ? "text-rose-700" : "text-slate-700"}`}>
                  {uzs(row.balance_uzs)}
                </Td>
                <Td className={`tnum ${row.debt_uzs > 0 ? "font-medium text-rose-700" : "text-slate-400"}`}>
                  {row.debt_uzs > 0 ? uzs(row.debt_uzs) : "—"}
                </Td>
                <Td className="tnum text-slate-600">{day(row.next_renewal_date)}</Td>
                <Td>
                  <Link to={`/tenants/${row.tenant_id}`} className="text-xs text-slate-500 hover:text-slate-900">
                    Открыть →
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
