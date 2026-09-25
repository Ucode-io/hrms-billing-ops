import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Banknote, CalendarCog, Play, Printer, Scale, Sparkles, Wallet } from "lucide-react";
import {
  useAdjustment,
  useAiGrant,
  useInvoiceVoid,
  usePaymentRecord,
  usePlanAssign,
  usePlans,
  useRunTick,
  useSubscriptionPatch,
  useTenant,
} from "../api/billing";
import type { Invoice, TenantDetail } from "../api/billing";
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  Input,
  Loading,
  Modal,
  Select,
  Table,
  Td,
  Textarea,
  errorText,
  useToast,
} from "../components/ui";
import { EVENT, STATUS, TX_TYPE, day, moment, tokens, usd, uzs, today } from "../lib/format";

const toInt = (value: string): number => Math.round(Number(String(value).replace(/\s/g, "")) || 0);

function Stat({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 text-sm font-medium tnum ${tone || "text-slate-900"}`}>{value}</div>
    </div>
  );
}

const CARD_STATE: Record<string, { label: string; tone: "green" | "amber" | "red" | "slate" }> = {
  created: { label: "Отправлено в Payme", tone: "amber" },
  paid: { label: "Списано", tone: "green" },
  reconciled: { label: "Списано (сверено)", tone: "green" },
  failed: { label: "Отказ", tone: "red" },
};

/**
 * Сколько ещё нужно внести по каждому открытому счёту. Из счёта дебетуется всё,
 * кроме резерва дней отсрочки (он уже списан подневно и сидит в минусе баланса),
 * поэтому нужная сумма = charge_uzs − баланс; отрицательный баланс её увеличивает.
 * Деньги закрывают счета от старого к новому — тем же порядком, что и сервер.
 */
function remainingToPay(openInvoices: Invoice[], balanceUzs: number): Map<string, number> {
  const result = new Map<string, number>();
  let balance = balanceUzs;
  for (const invoice of [...openInvoices].reverse()) {
    result.set(invoice.id, Math.max(0, invoice.charge_uzs - balance));
    balance = Math.max(0, balance - invoice.charge_uzs);
  }
  return result;
}

const INVOICE_STATUS: Record<string, { label: string; tone: "green" | "amber" | "slate" }> = {
  open: { label: "Не оплачен", tone: "amber" },
  paid: { label: "Оплачен", tone: "green" },
  void: { label: "Аннулирован", tone: "slate" },
};

export default function TenantPage() {
  const { tenantId } = useParams();
  const toast = useToast();
  const { data, isLoading, error } = useTenant(tenantId);
  const plans = usePlans();

  const [modal, setModal] = useState<null | "plan" | "payment" | "adjust" | "ai" | "dates">(null);
  const [voidInvoice, setVoidInvoice] = useState<Invoice | null>(null);

  const runTick = useRunTick();
  const resume = usePlanAssign();

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const { company, subscription, plan, pending_plan, account, seats_now, over_seats_now, ai } = data;
  const status = STATUS[subscription.status] ?? { label: subscription.status, tone: "slate" as const, hint: "" };
  const openInvoices = data.invoices.filter((invoice) => invoice.status === "open");
  const toPay = remainingToPay(openInvoices, account.balance_uzs);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/tenants" className="text-slate-400 hover:text-slate-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">{company.name}</h1>
        <Badge tone={status.tone} title={status.hint}>
          {status.label}
        </Badge>
        {subscription.cancel_at_period_end ? (
          <>
            <Badge tone="amber" title="Отмена запланирована: новый счёт не выставится, после этого дня — только просмотр">
              Не продлевается · доступ до {day(subscription.current_period_end)}
            </Badge>
            <Button
              loading={resume.isPending}
              onClick={() =>
                resume.mutate(
                  { tenant_id: company.id, mode: "resume" },
                  {
                    onSuccess: () => toast("ok", "Отмена снята: подписка продлится как обычно"),
                    onError: (e) => toast("error", errorText(e)),
                  }
                )
              }
            >
              Возобновить
            </Button>
          </>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => setModal("payment")} variant="primary">
            <Banknote className="h-4 w-4" /> Отметить платёж
          </Button>
          <Button onClick={() => setModal("plan")}>
            <Wallet className="h-4 w-4" /> План
          </Button>
          <Button onClick={() => setModal("adjust")}>
            <Scale className="h-4 w-4" /> Корректировка
          </Button>
          <Button onClick={() => setModal("ai")}>
            <Sparkles className="h-4 w-4" /> Токены
          </Button>
          <Button onClick={() => setModal("dates")} title="Ручная правка дат подписки — записывается в историю">
            <CalendarCog className="h-4 w-4" />
          </Button>
          <Button
            loading={runTick.isPending}
            title="Пересчитать только эту компанию"
            onClick={() =>
              runTick.mutate(
                { tenant_id: tenantId },
                {
                  onSuccess: (summary) => toast("ok", `Пересчитано. Продлений ${summary.renewed}, дней отсрочки ${summary.grace_days}`),
                  onError: (e) => toast("error", errorText(e)),
                }
              )
            }
          >
            <Play className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-4 sm:grid-cols-2">
        <Card>
          <Stat
            label="Баланс"
            value={uzs(account.balance_uzs)}
            tone={account.balance_uzs < 0 ? "text-rose-700" : "text-slate-900"}
          />
          {account.balance_uzs < 0 ? (
            <div className="mt-1 text-xs text-rose-600">Минус накоплен днями отсрочки</div>
          ) : null}
        </Card>
        <Card>
          <Stat label="План" value={plan ? `${plan.title} · ${usd(plan.price_usd)}` : "Не назначен"} />
          {pending_plan ? (
            <div className="mt-1 text-xs text-slate-500">Со следующего периода: {pending_plan.title}</div>
          ) : null}
        </Card>
        <Card>
          <Stat
            label="Сотрудники"
            value={
              <>
                {seats_now}
                {plan ? <span className="text-slate-400"> / {plan.included_seats} включено</span> : null}
              </>
            }
          />
          {over_seats_now > 0 && plan ? (
            <div className="mt-1 text-xs text-amber-700">
              Сверх лимита {over_seats_now} × {usd(plan.overage_price_usd)} — спишется по дням в следующем счёте
            </div>
          ) : null}
        </Card>
        <Card>
          <Stat
            label="AI за период"
            // spent_usd — расход против лимита плана; докупленное лежит отдельно
            // и уменьшается по мере трат (purchased_usd — это уже остаток).
            // Складывать их в «из» нельзя: знаменатель поедет вниз при каждом вопросе.
            value={
              ai.limit_usd === null
                ? "Без лимита"
                : `${usd(ai.spent_usd)} из ${usd(ai.limit_usd)}`
            }
            tone={ai.limit_usd !== null && ai.remaining_usd !== null && ai.remaining_usd <= 0 ? "text-rose-700" : ""}
          />
          <div className="mt-1 text-xs text-slate-500">
            {ai.purchased_usd > 0 ? `Докуплено, осталось: ${usd(ai.purchased_usd)} · ` : ""}
            {ai.remaining_usd !== null ? `доступно сейчас: ${usd(ai.remaining_usd)} · ` : ""}
            израсходовано {tokens(ai.tokens_used)} токенов
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Подписка" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Текущий период" value={day(subscription.current_period_start)} />
            <Stat label="по" value={day(subscription.current_period_end)} />
            <Stat label="Следующее списание" value={day(subscription.next_renewal_date)} />
            <Stat label="Отсрочка до" value={day(subscription.grace_until)} />
            <Stat label="Дней отсрочки списано" value={subscription.grace_days_charged} />
            <Stat label="Автосписание" value={subscription.autopay_enabled ? "Включено" : "Выключено"} />
          </div>
          {subscription.last_error ? (
            <div className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{subscription.last_error}</div>
          ) : null}
        </Card>

        <Card title="Счета" className="lg:col-span-2">
          <Table head={["Номер", "Период", "Сумма", "К оплате", "Статус", ""]} empty={data.invoices.length === 0}>
            {data.invoices.map((invoice) => {
              const meta = INVOICE_STATUS[invoice.status];
              return (
                <tr key={invoice.id} className="hover:bg-slate-50">
                  <Td>
                    <div className="font-medium text-slate-900">{invoice.number}</div>
                    <div className="text-xs text-slate-400">{day(invoice.issued_on)}</div>
                  </Td>
                  <Td className="tnum text-slate-600">
                    {day(invoice.period_start)} — {day(invoice.period_end)}
                  </Td>
                  <Td className="tnum">
                    {uzs(invoice.amount_uzs)}
                    <div className="text-xs text-slate-400">{usd(invoice.amount_usd)}</div>
                  </Td>
                  <Td className="tnum text-slate-600">
                    {invoice.status === "open" ? uzs(toPay.get(invoice.id) ?? invoice.charge_uzs) : "—"}
                  </Td>
                  <Td>
                    <Badge tone={meta?.tone ?? "slate"}>{meta?.label ?? invoice.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/invoices/${invoice.id}/print`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-slate-900"
                        title="Печать счёта"
                      >
                        <Printer className="h-4 w-4" />
                      </a>
                      {invoice.status === "open" ? (
                        <button
                          onClick={() => setVoidInvoice(invoice)}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          Аннулировать
                        </button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Движения по балансу">
          <Table head={["Дата", "Операция", "Сумма", "Остаток"]} empty={data.transactions.length === 0}>
            {data.transactions.map((tx) => (
              <tr key={tx.id}>
                <Td className="whitespace-nowrap text-slate-500">{moment(tx.created_at)}</Td>
                <Td>
                  <div className="text-slate-800">{TX_TYPE[tx.type] ?? tx.type}</div>
                  {tx.description ? <div className="text-xs text-slate-400">{tx.description}</div> : null}
                </Td>
                <Td className={`tnum whitespace-nowrap ${tx.amount_uzs < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {tx.amount_uzs > 0 ? "+" : ""}
                  {uzs(tx.amount_uzs)}
                </Td>
                <Td className="tnum whitespace-nowrap text-slate-500">{uzs(tx.balance_after_uzs)}</Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Сотрудники по дням" action={<span className="text-xs text-slate-400">текущий период</span>}>
          <Table head={["День", "Активных", "Включено", "Сверх лимита"]} empty={data.seat_days.length === 0}>
            {data.seat_days.map((row) => (
              <tr key={row.day}>
                <Td className="tnum text-slate-600">{day(row.day)}</Td>
                <Td className="tnum">{row.active}</Td>
                <Td className="tnum text-slate-500">{row.included}</Td>
                <Td className={`tnum ${row.over > 0 ? "text-amber-700" : "text-slate-400"}`}>{row.over}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card title="Карты и автосписания">
        {data.cards.length === 0 && data.card_payments.length === 0 ? (
          <p className="text-sm text-slate-400">
            Карта не привязана. Компания платит переводом по счёту либо привяжет карту в своём кабинете.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Карты</div>
              <Table head={["Карта", "Срок", "Тип", "Статус"]} empty={data.cards.length === 0}>
                {data.cards.map((card) => (
                  <tr key={card.id}>
                    <Td className="tnum text-slate-800">
                      {card.pan_masked}
                      {card.is_default ? <span className="ml-2 text-xs text-slate-400">основная</span> : null}
                    </Td>
                    <Td className="tnum text-slate-500">{card.expire}</Td>
                    <Td className="text-slate-500">{card.card_type || "—"}</Td>
                    <Td>
                      <Badge tone={card.verified ? "green" : "amber"}>
                        {card.verified ? "Подтверждена" : "Ждёт кода"}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </Table>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Попытки списания</div>
              <Table head={["Дата", "Сумма", "Результат"]} empty={data.card_payments.length === 0}>
                {data.card_payments.map((payment) => (
                  <tr key={payment.guid}>
                    <Td className="whitespace-nowrap text-slate-500">{moment(payment.created_at)}</Td>
                    <Td className="tnum">{uzs(payment.amount_uzs)}</Td>
                    <Td>
                      <Badge tone={CARD_STATE[payment.state]?.tone ?? "slate"}>
                        {CARD_STATE[payment.state]?.label ?? payment.state}
                      </Badge>
                      {payment.error ? (
                        <div className="mt-0.5 max-w-xs truncate text-xs text-rose-600" title={payment.error}>
                          {payment.error}
                        </div>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </Table>
            </div>
          </div>
        )}
      </Card>

      <Card title="История">
        <Table head={["Дата", "Событие", "Статус", "Детали"]} empty={data.events.length === 0}>
          {data.events.map((event) => (
            <tr key={event.guid}>
              <Td className="whitespace-nowrap text-slate-500">{moment(event.created_at)}</Td>
              <Td className="text-slate-800">{EVENT[event.event_type] ?? event.event_type}</Td>
              <Td className="text-slate-500">
                {event.from_status || event.to_status ? `${event.from_status ?? "—"} → ${event.to_status ?? "—"}` : "—"}
              </Td>
              <Td className="max-w-md truncate text-xs text-slate-400" title={JSON.stringify(event.payload)}>
                {JSON.stringify(event.payload)}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      {modal === "plan" && (
        <PlanModal
          detail={data}
          plans={plans.data ?? []}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "payment" && (
        <PaymentModal detail={data} openInvoices={openInvoices} toPay={toPay} onClose={() => setModal(null)} />
      )}
      {modal === "adjust" && <AdjustmentModal detail={data} onClose={() => setModal(null)} />}
      {modal === "ai" && <AiGrantModal detail={data} onClose={() => setModal(null)} />}
      {modal === "dates" && <DatesModal detail={data} onClose={() => setModal(null)} />}
      {voidInvoice && <VoidModal invoice={voidInvoice} onClose={() => setVoidInvoice(null)} />}
    </div>
  );
}

// ───── модалки действий ─────

function PlanModal({ detail, plans, onClose }: { detail: TenantDetail; plans: { id: string; title: string; price_usd: number; included_seats: number; is_active: boolean }[]; onClose: () => void }) {
  const toast = useToast();
  const assign = usePlanAssign();
  const [mode, setMode] = useState<"assign" | "unbilled" | "cancel">("assign");
  const [planId, setPlanId] = useState(detail.subscription.plan_id ?? "");
  const [startDate, setStartDate] = useState(today());
  // Идёт оплаченный период: отмена не отнимет его, а только не продлит.
  const paidPeriodRuns =
    detail.subscription.status === "active" &&
    Boolean(detail.subscription.next_renewal_date) &&
    (detail.subscription.next_renewal_date ?? "") > today();

  function submit() {
    assign.mutate(
      mode === "assign"
        ? { tenant_id: detail.company.id, mode, plan_id: planId, start_date: startDate }
        : { tenant_id: detail.company.id, mode },
      {
        onSuccess: (result) => {
          toast(
            "ok",
            result.cancel_scheduled
              ? `Подписка не продлится: доступ до ${day(result.access_until)}, новый счёт не выставится`
              : result.voided_invoices?.length
                ? `Подписка отменена. Аннулированы счета: ${result.voided_invoices.join(", ")}`
                : result.invoice
                ? `Счёт ${result.invoice.number} выставлен`
                : "Подписка обновлена"
          );
          onClose();
        },
        onError: (e) => toast("error", errorText(e)),
      }
    );
  }

  return (
    <Modal
      open
      title="План компании"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" loading={assign.isPending} onClick={submit} disabled={mode === "assign" && !planId}>
            Применить
          </Button>
        </>
      }
    >
      <Field label="Действие">
        <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
          <option value="assign">Назначить план</option>
          <option value="unbilled">Снять с биллинга (полный доступ, счетов нет)</option>
          <option value="cancel">{paidPeriodRuns ? "Отменить подписку (не продлевать)" : "Отменить подписку"}</option>
        </Select>
      </Field>

      {mode === "assign" ? (
        <>
          <Field label="План">
            <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">— выберите —</option>
              {plans
                .filter((plan) => plan.is_active || plan.id === detail.subscription.plan_id)
                .map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title} — {usd(plan.price_usd)} / {plan.included_seats} мест
                  </option>
                ))}
            </Select>
          </Field>
          <Field
            label="Начало биллинга"
            hint="Сегодняшняя дата запускает первый счёт сразу; будущая — счёт выставится в этот день."
          >
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          {mode === "unbilled"
            ? "Компания получит полный доступ без счетов. Открытые счета будут аннулированы."
            : paidPeriodRuns
              ? `Оплаченный период сохранится: полный доступ до ${day(detail.subscription.current_period_end)}, `
                + "новый счёт не выставится, деньги не возвращаются. После этого дня — только просмотр. "
                + "До этой даты отмену можно снять кнопкой «Возобновить»."
              : "Оплаченного периода нет: подписка отменится сразу, доступ только на просмотр. Открытые счета "
                + "аннулируются — долгом останется только минус на балансе (использованные дни отсрочки). "
                + "Оплата после этого ляжет на баланс и компанию не включит: вернуть её можно, только назначив план."}
        </p>
      )}
    </Modal>
  );
}

function PaymentModal({
  detail,
  openInvoices,
  toPay,
  onClose,
}: {
  detail: TenantDetail;
  openInvoices: Invoice[];
  toPay: Map<string, number>;
  onClose: () => void;
}) {
  const toast = useToast();
  const record = usePaymentRecord();
  // Самый старый открытый счёт: его сервер закроет первым, его сумму и предлагаем.
  const oldest = openInvoices[openInvoices.length - 1];
  const suggested = oldest ? toPay.get(oldest.id) ?? oldest.charge_uzs : 0;
  const [amount, setAmount] = useState(suggested ? String(suggested) : "");
  const [invoiceId, setInvoiceId] = useState(oldest?.id ?? "");
  const [reference, setReference] = useState("");
  const [comment, setComment] = useState("");

  function submit() {
    record.mutate(
      {
        tenant_id: detail.company.id,
        amount_uzs: toInt(amount),
        invoice_id: invoiceId || undefined,
        reference: reference.trim() || undefined,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          if (result.duplicate) toast("ok", "Этот платёж уже был отмечен — повтор не зачислен");
          else
            toast(
              "ok",
              `Платёж зачислен. Закрыто счетов: ${result.settled_invoices.length}. Статус: ${
                STATUS[result.subscription.status]?.label ?? result.subscription.status
              }`
            );
          onClose();
        },
        onError: (e) => toast("error", errorText(e)),
      }
    );
  }

  return (
    <Modal
      open
      title="Платёж по счёту"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" loading={record.isPending} onClick={submit} disabled={toInt(amount) <= 0}>
            Зачислить
          </Button>
        </>
      }
    >
      <Field label="Сумма, сум" hint="Вводите сумму, которая фактически пришла на счёт.">
        <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="tnum" />
      </Field>
      <Field label="Счёт" hint="Можно не выбирать: деньги лягут на баланс и закроют самый старый счёт.">
        <Select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
          <option value="">— на баланс —</option>
          {openInvoices.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.number} — к оплате {uzs(toPay.get(invoice.id) ?? invoice.charge_uzs)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Реквизит платежа" hint="Номер платёжного поручения или выписки.">
        <Input value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>
      <Field label="Комментарий">
        <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
    </Modal>
  );
}

function AdjustmentModal({ detail, onClose }: { detail: TenantDetail; onClose: () => void }) {
  const toast = useToast();
  const adjust = useAdjustment();
  const [kind, setKind] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");

  return (
    <Modal
      open
      title="Корректировка баланса"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            loading={adjust.isPending}
            disabled={toInt(amount) <= 0 || !comment.trim()}
            onClick={() =>
              adjust.mutate(
                { tenant_id: detail.company.id, kind, amount_uzs: toInt(amount), comment: comment.trim() },
                {
                  onSuccess: () => {
                    toast("ok", "Баланс скорректирован");
                    onClose();
                  },
                  onError: (e) => toast("error", errorText(e)),
                }
              )
            }
          >
            Применить
          </Button>
        </>
      }
    >
      <Field label="Тип">
        <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="credit">Начислить (бонус, компенсация)</option>
          <option value="debit">Списать</option>
        </Select>
      </Field>
      <Field label="Сумма, сум">
        <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="tnum" />
      </Field>
      <Field label="Причина" hint="Обязательно: попадёт в историю и в выгрузку.">
        <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
    </Modal>
  );
}

function AiGrantModal({ detail, onClose }: { detail: TenantDetail; onClose: () => void }) {
  const toast = useToast();
  const grant = useAiGrant();
  const [value, setValue] = useState("5");
  const [comment, setComment] = useState("");

  return (
    <Modal
      open
      title="Начислить лимит AI"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            loading={grant.isPending}
            disabled={!(Number(value) > 0)}
            onClick={() =>
              grant.mutate(
                { tenant_id: detail.company.id, usd: Number(value), comment: comment.trim() || undefined },
                {
                  onSuccess: () => {
                    toast("ok", "Лимит AI начислен");
                    onClose();
                  },
                  onError: (e) => toast("error", errorText(e)),
                }
              )
            }
          >
            Начислить
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-500">
        Начисленный лимит не сгорает при продлении — расходуется после месячного лимита плана.
      </p>
      <Field label="Сумма, $" hint="Доллары себестоимости AI, а не сумма к оплате.">
        <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="tnum" />
      </Field>
      <Field label="Комментарий">
        <Input value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
    </Modal>
  );
}

function DatesModal({ detail, onClose }: { detail: TenantDetail; onClose: () => void }) {
  const toast = useToast();
  const patch = useSubscriptionPatch();
  const { subscription } = detail;
  const [nextRenewal, setNextRenewal] = useState(subscription.next_renewal_date ?? "");
  const [periodStart, setPeriodStart] = useState(subscription.current_period_start ?? "");
  const [graceUntil, setGraceUntil] = useState(subscription.grace_until ?? "");
  // Дата продления внутри оплаченного периода = второй счёт за оплаченные дни.
  // Не запрещаем, но переспрашиваем: сервер без confirm_overlap тоже откажет.
  const paidUntil = subscription.status === "active" ? subscription.current_period_end : null;
  const overlaps = Boolean(nextRenewal && paidUntil && nextRenewal <= paidUntil);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Modal
      open
      title="Правка дат подписки"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            loading={patch.isPending}
            disabled={overlaps && !confirmed}
            onClick={() =>
              patch.mutate(
                {
                  tenant_id: detail.company.id,
                  next_renewal_date: nextRenewal || undefined,
                  current_period_start: periodStart || undefined,
                  grace_until: graceUntil || undefined,
                  confirm_overlap: overlaps && confirmed ? true : undefined,
                },
                {
                  onSuccess: () => {
                    toast("ok", "Даты обновлены");
                    onClose();
                  },
                  onError: (e) => toast("error", errorText(e)),
                }
              )
            }
          >
            Сохранить
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-500">
        Ручной сдвиг дат. Нужен для переноса срока по договорённости и для проверки сценариев — каждое изменение
        пишется в историю.
      </p>
      <Field label="Следующее списание">
        <Input
          type="date"
          value={nextRenewal}
          onChange={(e) => {
            setNextRenewal(e.target.value);
            setConfirmed(false);
          }}
        />
      </Field>
      {overlaps ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p>
            Компания оплатила период до {day(paidUntil)}. Если поставить списание {day(nextRenewal)}, клиенту
            выставится ещё один счёт за уже оплаченные дни.
          </p>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Понимаю, всё равно поставить эту дату
          </label>
        </div>
      ) : null}
      <Field label="Начало текущего периода">
        <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
      </Field>
      <Field label="Отсрочка до" hint="С этой даты доступ переходит в режим просмотра.">
        <Input type="date" value={graceUntil} onChange={(e) => setGraceUntil(e.target.value)} />
      </Field>
    </Modal>
  );
}

function VoidModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const toast = useToast();
  const voidInvoice = useInvoiceVoid();
  const [reason, setReason] = useState("");

  return (
    <Modal
      open
      title={`Аннулировать счёт ${invoice.number}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="danger"
            loading={voidInvoice.isPending}
            disabled={!reason.trim()}
            onClick={() =>
              voidInvoice.mutate(
                { invoice_id: invoice.id, reason: reason.trim() },
                {
                  onSuccess: (result) => {
                    toast("ok", `Счёт аннулирован. Статус: ${STATUS[result.subscription.status]?.label ?? result.subscription.status}`);
                    onClose();
                  },
                  onError: (e) => toast("error", errorText(e)),
                }
              )
            }
          >
            Аннулировать
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-500">
        Долг по счёту на {uzs(invoice.amount_uzs)} будет прощён, статус подписки пересчитается. Уже списанные дни
        отсрочки останутся в истории.
      </p>
      <Field label="Причина">
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}
