import { useEffect } from "react";
import { useParams } from "react-router";
import { Printer } from "lucide-react";
import { useInvoice } from "../api/billing";
import type { InvoiceLine, Requisites } from "../api/billing";
import { Button, ErrorBox, Loading } from "../components/ui";
import { day, usd, uzs } from "../lib/format";
import { uzsInWords } from "../lib/words";

const LINE_LABEL: Record<string, string> = {
  plan: "Подписка HRMS",
  overage: "Сотрудники сверх лимита",
  grace_reserve: "Дни отсрочки",
  upgrade: "Переход на старший план",
  token_pack: "Пакет AI-токенов",
};

/**
 * Построчные суммы в сумах считаются из долларов, а итог берётся из счёта —
 * иначе округление каждой строки разойдётся с той суммой, которую клиент реально
 * должен. Разницу поглощает последняя строка, и столбец всегда сходится с итогом.
 */
function linesInUzs(lines: InvoiceLine[], fxRate: number, totalUzs: number): number[] {
  if (!lines.length) return [];
  const raw = lines.map((line) => Math.round(Number(line.amount_usd) * fxRate));
  const sum = raw.reduce((acc, value) => acc + value, 0);
  raw[raw.length - 1] += totalUzs - sum;
  return raw;
}

function Party({ title, requisites }: { title: string; requisites: Requisites }) {
  const rows: [string, string | undefined][] = [
    ["Наименование", requisites.company_name],
    ["ИНН", requisites.inn],
    ["Адрес", requisites.address],
    ["Банк", requisites.bank_name],
    ["МФО", requisites.mfo],
    ["Р/с", requisites.account],
    ["Телефон", requisites.phone],
  ];
  return (
    <div className="w-1/2">
      <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">{title}</div>
      <table className="w-full text-xs">
        <tbody>
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <tr key={label}>
                <td className="py-0.5 pr-2 align-top text-slate-400">{label}</td>
                <td className="py-0.5 align-top text-slate-900">{value}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InvoicePrintPage() {
  const { invoiceId } = useParams();
  const { data, isLoading, error } = useInvoice(invoiceId);

  useEffect(() => {
    if (data) document.title = `Счёт ${data.invoice.number}`;
  }, [data]);

  if (isLoading) return <Loading />;
  if (error) return <div className="p-6"><ErrorBox error={error} /></div>;
  if (!data) return null;

  const { invoice, company } = data;
  const requisites = invoice.snapshot?.requisites ?? data.current_requisites ?? {};
  const uzsLines = linesInUzs(invoice.lines, invoice.fx_rate, invoice.amount_uzs);
  const stale = JSON.stringify(requisites) !== JSON.stringify(data.current_requisites ?? {});

  return (
    <div className="mx-auto max-w-3xl p-6 print:p-0">
      <div className="no-print mb-4 flex items-center gap-3">
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Печать
        </Button>
        {stale ? (
          <span className="text-xs text-amber-700">
            Счёт напечатается с реквизитами на дату выпуска — они отличаются от текущих.
          </span>
        ) : null}
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-8 print:rounded-none print:border-0 print:p-0">
        <header className="border-b border-slate-300 pb-3">
          <h1 className="text-lg font-bold text-slate-900">
            Счёт на оплату № {invoice.number} от {day(invoice.issued_on)}
          </h1>
          {invoice.period_start ? (
            <p className="mt-1 text-xs text-slate-500">
              Период обслуживания: {day(invoice.period_start)} — {day(invoice.period_end)}
            </p>
          ) : null}
        </header>

        <div className="mt-4 flex gap-6">
          <Party title="Поставщик" requisites={requisites} />
          <div className="w-1/2">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Покупатель</div>
            <div className="text-sm font-medium text-slate-900">{company.name}</div>
          </div>
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="w-8 py-2 font-medium">№</th>
              <th className="py-2 font-medium">Наименование</th>
              <th className="py-2 text-right font-medium">Кол-во</th>
              <th className="py-2 text-right font-medium">Цена, $</th>
              <th className="py-2 text-right font-medium">Сумма, $</th>
              <th className="py-2 text-right font-medium">Сумма, сум</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={`${line.code}-${index}`} className="border-b border-slate-100">
                <td className="py-2 text-slate-400">{index + 1}</td>
                <td className="py-2 text-slate-900">
                  {line.label || LINE_LABEL[line.code] || line.code}
                  {invoice.plan_title && line.code === "plan" && !(line.label ?? "").includes(invoice.plan_title) ? (
                    <span className="text-slate-400"> · {invoice.plan_title}</span>
                  ) : null}
                </td>
                <td className="py-2 text-right tnum text-slate-600">{line.qty}</td>
                <td className="py-2 text-right tnum text-slate-600">{usd(line.unit_usd)}</td>
                <td className="py-2 text-right tnum text-slate-600">{usd(line.amount_usd)}</td>
                <td className="py-2 text-right tnum text-slate-900">{uzs(uzsLines[index])}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} />
              <td className="py-2 text-right text-sm font-semibold text-slate-900 tnum">{usd(invoice.amount_usd)}</td>
              <td className="py-2 text-right text-sm font-semibold text-slate-900 tnum">{uzs(invoice.amount_uzs)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-3 text-xs text-slate-500">
          Пересчёт по курсу ЦБ РУз на {day(invoice.fx_date)}: 1 USD = {invoice.fx_rate.toLocaleString("ru-RU")} сум.
        </p>
        <p className="mt-3 text-sm text-slate-900">
          Всего к оплате: <span className="font-medium">{uzsInWords(invoice.amount_uzs)}</span>.
        </p>

        {requisites.footer_note ? (
          <p className="mt-4 whitespace-pre-line text-xs text-slate-500">{requisites.footer_note}</p>
        ) : null}

        <div className="mt-10 flex gap-10 text-xs text-slate-500">
          <div className="w-1/2">
            Руководитель ______________________
            {requisites.director ? <div className="mt-1 text-slate-700">{requisites.director}</div> : null}
          </div>
          <div className="w-1/2">Главный бухгалтер ______________________</div>
        </div>
      </article>
    </div>
  );
}
