/** Суммы в сумах всегда целые — в ценах Узбекистана копеек нет. */
export const uzs = (value: number | null | undefined): string =>
  `${Math.round(Number(value ?? 0)).toLocaleString("ru-RU").replace(/,/g, " ")} сум`;

export const usd = (value: number | null | undefined): string =>
  `$${Number(value ?? 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const tokens = (value: number | null | undefined): string => {
  const n = Number(value ?? 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} млн`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} тыс`;
  return n.toLocaleString("ru-RU");
};

export const day = (value: string | null | undefined): string => {
  if (!value) return "—";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return y && m && d ? `${d}.${m}.${y}` : "—";
};

export const moment = (value: string | null | undefined): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const today = (): string => {
  const now = new Date();
  const offset = new Date(now.getTime() + 5 * 3600 * 1000); // Asia/Tashkent, как на сервере
  return offset.toISOString().slice(0, 10);
};

type Tone = "green" | "amber" | "red" | "slate" | "blue";

export const STATUS: Record<string, { label: string; tone: Tone; hint: string }> = {
  unbilled: { label: "Без плана", tone: "slate", hint: "Полный доступ, счета не выставляются" },
  active: { label: "Активна", tone: "green", hint: "Оплачено, всё работает" },
  past_due: { label: "Просрочка", tone: "amber", hint: "Идут платные дни отсрочки, доступ пока полный" },
  read_only: { label: "Только просмотр", tone: "red", hint: "Отсрочка истекла, изменения заблокированы" },
  canceled: { label: "Отменена", tone: "red", hint: "Остановлена оператором" },
};

export const TX_TYPE: Record<string, string> = {
  topup_bank: "Банковский перевод",
  topup_card: "Оплата картой",
  charge_plan: "Списание за план",
  charge_overage: "Доплата за места",
  charge_grace_day: "День отсрочки",
  charge_upgrade: "Доплата за апгрейд",
  charge_token_pack: "Пакет токенов",
  adjustment_credit: "Корректировка (начисление)",
  adjustment_debit: "Корректировка (списание)",
  refund: "Возврат",
};

export const EVENT: Record<string, string> = {
  plan_assigned: "Назначен план",
  plan_changed: "План изменён",
  renewed: "Продление оплачено",
  charge_failed: "Списание не прошло",
  grace_day_charged: "Списан день отсрочки",
  read_only: "Переход в режим просмотра",
  reactivated: "Доступ восстановлен",
  payment_recorded: "Отмечен платёж",
  adjustment: "Корректировка баланса",
  plan_upgraded: "Апгрейд плана",
  plan_downgrade_scheduled: "Запланирован даунгрейд",
  invoice_voided: "Счёт аннулирован",
  card_bound: "Привязана карта",
  card_removed: "Карта удалена",
  autopay_changed: "Автосписание переключено",
  canceled: "Подписка отменена",
  set_unbilled: "Снята с биллинга",
  subscription_patched: "Правка дат",
  ai_tokens_granted: "Начислены токены",
  token_pack_bought: "Куплен пакет токенов",
  plan_created: "Создан план",
  plan_updated: "Изменён план",
  plan_activated: "План включён",
  plan_deactivated: "План выключен",
  token_pack_created: "Создан пакет",
  token_pack_updated: "Изменён пакет",
};
