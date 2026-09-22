import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke, newRequestId } from "./gateway";

// ───── типы ответов биллинга (BILLING_DB_SCHEMA.md) ─────

export interface Plan {
  id: string;
  code: string;
  title: string;
  price_usd: number;
  included_seats: number;
  overage_price_usd: number;
  included_tokens: number;
  ai_enabled: boolean;
  is_active: boolean;
  sort_order: number;
  subscriptions?: number;
}

export interface Pack {
  id: string;
  code: string;
  title: string;
  tokens: number;
  price_usd: number;
  is_active: boolean;
  sort_order: number;
}

export interface TenantRow {
  tenant_id: string;
  name: string;
  status: string;
  plan: { id: string; code: string; title: string } | null;
  seats_now: number;
  over_seats_now: number;
  balance_uzs: number;
  open_uzs: number;
  debt_uzs: number;
  next_renewal_date: string | null;
  grace_until: string | null;
  autopay_enabled: boolean;
  tokens_used_period: number;
  tokens_purchased: number;
  last_error: string | null;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  next_renewal_date: string | null;
  grace_started_on: string | null;
  grace_until: string | null;
  grace_days_charged: number;
  pending_plan_id: string | null;
  autopay_enabled: boolean;
  default_card_id: string | null;
  tokens_used_period: number;
  tokens_purchased: number;
  last_error: string | null;
}

export interface InvoiceLine {
  code: string;
  label: string;
  qty: number;
  unit_usd: number;
  amount_usd: number;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  number: string;
  kind: string;
  status: "open" | "paid" | "void";
  plan_title: string | null;
  period_start: string | null;
  period_end: string | null;
  period_days: number;
  arrears_days: number;
  overage_seat_days: number;
  lines: InvoiceLine[];
  amount_usd: number;
  fx_rate: number;
  fx_date: string | null;
  fx_source: string;
  amount_uzs: number;
  grace_reserve_uzs: number;
  charge_uzs: number;
  due_date: string | null;
  issued_on: string | null;
  issued_at: string;
  paid_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  snapshot: { requisites?: Requisites; tenant?: { id: string; name: string } };
}

export interface Transaction {
  id: string;
  type: string;
  amount_uzs: number;
  balance_after_uzs: number;
  invoice_id: string | null;
  description: string;
  created_at: string;
}

export interface CardRow {
  id: string;
  pan_masked: string;
  expire: string;
  card_type: string;
  verified: boolean;
  is_default: boolean;
}

export interface EventRow {
  guid: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AiQuota {
  allowed: boolean;
  reason: string | null;
  limit: number | null;
  used: number;
  purchased: number;
  remaining: number | null;
  period_end: string | null;
}

export interface CardPayment {
  guid: string;
  invoice_id: string | null;
  attempt_key: string;
  order_id: number;
  amount_uzs: number;
  receipt_id: string | null;
  state: string;
  payme_state: number | null;
  error: string | null;
  created_at: string;
}

export interface SeatDay {
  day: string;
  active: number;
  included: number;
  over: number;
}

export interface TenantDetail {
  company: { id: string; name: string };
  subscription: Subscription;
  plan: Plan | null;
  pending_plan: Plan | null;
  account: { balance_uzs: number };
  seats_now: number;
  over_seats_now: number;
  seat_days: SeatDay[];
  ai: AiQuota;
  invoices: Invoice[];
  transactions: Transaction[];
  cards: CardRow[];
  card_payments: CardPayment[];
  events: EventRow[];
}

export interface Requisites {
  company_name?: string;
  inn?: string;
  address?: string;
  bank_name?: string;
  mfo?: string;
  account?: string;
  director?: string;
  phone?: string;
  email?: string;
  footer_note?: string;
}

export interface Settings {
  requisites: Requisites;
  grace_days: number;
  ai_blended_usd_per_mtok: number;
  ai_included_share: number;
  ai_model_prices: Record<string, Record<string, number>>;
}

export interface TickSummary {
  today: string;
  processed: number;
  snapshots: number;
  grace_days: number;
  renewed: number;
  paid: number;
  past_due: number;
  read_only: number;
  reconciled: number;
  errors: { tenant_id: string | null; message: string }[];
}

// ───── чтение ─────

export const useTenants = (filters: { search?: string; status?: string }) =>
  useQuery({
    queryKey: ["tenants", filters],
    queryFn: () => invoke<{ tenants: TenantRow[] }>("billing_ops_tenants_list", filters),
    select: (data) => data.tenants,
  });

export const useTenant = (tenantId: string | undefined) =>
  useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => invoke<TenantDetail>("billing_ops_tenant_get", { tenant_id: tenantId }),
    enabled: Boolean(tenantId),
  });

export const usePlans = () =>
  useQuery({
    queryKey: ["plans"],
    queryFn: () => invoke<{ plans: Plan[] }>("billing_ops_plans_list"),
    select: (data) => data.plans,
  });

export const usePacks = () =>
  useQuery({
    queryKey: ["packs"],
    queryFn: () => invoke<{ packs: Pack[] }>("billing_ops_token_packs_list"),
    select: (data) => data.packs,
  });

export const useSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: () => invoke<Settings>("billing_ops_settings_get") });

export const useInvoice = (invoiceId: string | undefined) =>
  useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () =>
      invoke<{
        invoice: Invoice;
        company: { id: string; name: string };
        transactions: Transaction[];
        current_requisites: Requisites;
      }>("billing_ops_invoice_get", { invoice_id: invoiceId }),
    enabled: Boolean(invoiceId),
  });

// ───── изменения ─────

/**
 * Денежные методы принимают `request_id`: повтор с тем же ключом не спишет
 * и не зачислит второй раз. Генерируем его на каждый вызов мутации.
 */
function useInvokeMutation<TVars extends Record<string, unknown>, TResult>(
  method: string,
  options: { withRequestId?: boolean; invalidate?: string[] } = {}
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: TVars) =>
      invoke<TResult>(method, options.withRequestId ? { ...vars, request_id: newRequestId() } : vars),
    onSuccess: () => {
      for (const key of options.invalidate ?? []) {
        void client.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

const TENANT_KEYS = ["tenant", "tenants"];

export const usePlanAssign = () =>
  useInvokeMutation<
    { tenant_id: string; mode: "assign" | "unbilled" | "cancel"; plan_id?: string; start_date?: string },
    { subscription: Subscription; invoice?: Invoice; paid?: boolean }
  >("billing_ops_plan_assign", { withRequestId: true, invalidate: TENANT_KEYS });

export const usePaymentRecord = () =>
  useInvokeMutation<
    { tenant_id: string; amount_uzs: number; invoice_id?: string; reference?: string; comment?: string },
    { transaction: Transaction; settled_invoices: Invoice[]; subscription: Subscription; duplicate?: boolean }
  >("billing_ops_payment_record", { withRequestId: true, invalidate: TENANT_KEYS });

export const useAdjustment = () =>
  useInvokeMutation<
    { tenant_id: string; kind: "credit" | "debit"; amount_uzs: number; comment: string },
    { transaction: Transaction; subscription: Subscription }
  >("billing_ops_adjustment", { withRequestId: true, invalidate: TENANT_KEYS });

export const useInvoiceVoid = () =>
  useInvokeMutation<{ invoice_id: string; reason: string }, { invoice: Invoice; subscription: Subscription }>(
    "billing_ops_invoice_void",
    { invalidate: [...TENANT_KEYS, "invoice"] }
  );

export const useSubscriptionPatch = () =>
  useInvokeMutation<
    { tenant_id: string; next_renewal_date?: string; grace_until?: string; current_period_start?: string; grace_started_on?: string },
    { subscription: Subscription }
  >("billing_ops_subscription_patch", { withRequestId: true, invalidate: TENANT_KEYS });

export const useRunTick = () =>
  useInvokeMutation<{ tenant_id?: string }, TickSummary>("billing_ops_run_tick", { invalidate: TENANT_KEYS });

export const useAiGrant = () =>
  useInvokeMutation<{ tenant_id: string; tokens: number; comment?: string }, { subscription: Subscription }>(
    "billing_ops_ai_grant",
    { withRequestId: true, invalidate: TENANT_KEYS }
  );

export const usePlanSave = () =>
  useInvokeMutation<{ plan: Partial<Plan> }, { plan: Plan; created: boolean }>("billing_ops_plan_save", {
    invalidate: ["plans", ...TENANT_KEYS],
  });

export const usePackSave = () =>
  useInvokeMutation<{ pack: Partial<Pack> }, { pack: Pack; created: boolean }>("billing_ops_token_pack_save", {
    invalidate: ["packs"],
  });

export const useSettingsSave = () =>
  useInvokeMutation<Partial<Settings>, Settings>("billing_ops_settings_save", { invalidate: ["settings"] });

export const useRecomputeTokenLimits = () =>
  useInvokeMutation<Record<string, never>, { plans: Plan[] }>("billing_ops_ai_recompute_limits", {
    invalidate: ["plans"],
  });
