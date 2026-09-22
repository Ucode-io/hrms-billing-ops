import { useState } from "react";
import { Calculator, Plus } from "lucide-react";
import {
  usePackSave,
  usePacks,
  usePlanSave,
  usePlans,
  useRecomputeTokenLimits,
  useSettings,
} from "../api/billing";
import type { Pack, Plan } from "../api/billing";
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal, Select, Table, Td, errorText, useToast } from "../components/ui";
import { tokens, usd } from "../lib/format";

const EMPTY_PLAN: Partial<Plan> = {
  code: "",
  title: "",
  price_usd: 0,
  included_seats: 0,
  overage_price_usd: 0,
  included_tokens: 0,
  ai_enabled: true,
  is_active: true,
  sort_order: 0,
};

const EMPTY_PACK: Partial<Pack> = { code: "", title: "", tokens: 1_000_000, price_usd: 0, is_active: true, sort_order: 0 };

const num = (value: string): number => Number(String(value).replace(",", ".")) || 0;

export default function PlansPage() {
  const plans = usePlans();
  const packs = usePacks();
  const settings = useSettings();
  const recompute = useRecomputeTokenLimits();
  const toast = useToast();

  const [planDraft, setPlanDraft] = useState<Partial<Plan> | null>(null);
  const [packDraft, setPackDraft] = useState<Partial<Pack> | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">Планы и пакеты</h1>
        <Button
          loading={recompute.isPending}
          title="Проставить лимит токенов по формуле: доля от цены плана, делённая на стоимость токенов"
          onClick={() =>
            recompute.mutate(
              {},
              {
                onSuccess: () => toast("ok", "Лимиты токенов пересчитаны по формуле"),
                onError: (e) => toast("error", errorText(e)),
              }
            )
          }
        >
          <Calculator className="h-4 w-4" /> Пересчитать лимиты токенов
        </Button>
        <Button variant="primary" onClick={() => setPlanDraft({ ...EMPTY_PLAN })}>
          <Plus className="h-4 w-4" /> Новый план
        </Button>
      </div>

      <Card
        title="Планы"
        action={
          settings.data ? (
            <span className="text-xs text-slate-400">
              формула токенов: {Math.round(settings.data.ai_included_share * 100)}% цены ÷ $
              {settings.data.ai_blended_usd_per_mtok} за млн
            </span>
          ) : null
        }
      >
        {plans.error ? <ErrorBox error={plans.error} /> : null}
        {plans.isLoading ? (
          <Loading />
        ) : (
          <Table
            head={["Название", "Код", "Цена", "Мест", "Сверх лимита", "AI-токены", "Компаний", "Статус", ""]}
            empty={(plans.data ?? []).length === 0}
          >
            {(plans.data ?? []).map((plan) => (
              <tr key={plan.id} className="hover:bg-slate-50">
                <Td className="font-medium text-slate-900">{plan.title}</Td>
                <Td className="text-slate-400">{plan.code}</Td>
                <Td className="tnum">{usd(plan.price_usd)}</Td>
                <Td className="tnum text-slate-600">{plan.included_seats}</Td>
                <Td className="tnum text-slate-600">{usd(plan.overage_price_usd)} / место</Td>
                <Td className="tnum text-slate-600">{plan.ai_enabled ? tokens(plan.included_tokens) : "выключен"}</Td>
                <Td className="tnum text-slate-600">{plan.subscriptions ?? 0}</Td>
                <Td>
                  <Badge tone={plan.is_active ? "green" : "slate"}>{plan.is_active ? "В каталоге" : "Скрыт"}</Badge>
                </Td>
                <Td>
                  <button onClick={() => setPlanDraft(plan)} className="text-xs text-slate-500 hover:text-slate-900">
                    Изменить
                  </button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Новая цена действует со следующего счёта: выставленные счета хранят свой снимок цен. План, на котором есть
          компании, удалить нельзя — его можно скрыть из каталога.
        </p>
      </Card>

      <Card
        title="Пакеты AI-токенов"
        action={
          <Button size="sm" onClick={() => setPackDraft({ ...EMPTY_PACK })}>
            <Plus className="h-4 w-4" /> Новый пакет
          </Button>
        }
      >
        {packs.error ? <ErrorBox error={packs.error} /> : null}
        {packs.isLoading ? (
          <Loading />
        ) : (
          <Table head={["Название", "Код", "Токенов", "Цена", "Статус", ""]} empty={(packs.data ?? []).length === 0}>
            {(packs.data ?? []).map((pack) => (
              <tr key={pack.id} className="hover:bg-slate-50">
                <Td className="font-medium text-slate-900">{pack.title}</Td>
                <Td className="text-slate-400">{pack.code}</Td>
                <Td className="tnum text-slate-600">{tokens(pack.tokens)}</Td>
                <Td className="tnum">{usd(pack.price_usd)}</Td>
                <Td>
                  <Badge tone={pack.is_active ? "green" : "slate"}>{pack.is_active ? "В каталоге" : "Скрыт"}</Badge>
                </Td>
                <Td>
                  <button onClick={() => setPackDraft(pack)} className="text-xs text-slate-500 hover:text-slate-900">
                    Изменить
                  </button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {planDraft && <PlanModal draft={planDraft} onClose={() => setPlanDraft(null)} />}
      {packDraft && <PackModal draft={packDraft} onClose={() => setPackDraft(null)} />}
    </div>
  );
}

function PlanModal({ draft, onClose }: { draft: Partial<Plan>; onClose: () => void }) {
  const toast = useToast();
  const save = usePlanSave();
  const settings = useSettings();
  const [form, setForm] = useState(draft);

  const patch = (next: Partial<Plan>) => setForm((prev) => ({ ...prev, ...next }));

  // Подсказка «сколько токенов получится по формуле» — оператор может взять её
  // как есть или поставить своё число.
  const suggested =
    settings.data && form.price_usd
      ? Math.floor(
          (settings.data.ai_included_share * Number(form.price_usd)) / settings.data.ai_blended_usd_per_mtok * 1_000_000
        )
      : null;

  return (
    <Modal
      open
      title={draft.id ? `План «${draft.title}»` : "Новый план"}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!form.code?.trim() || !form.title?.trim()}
            onClick={() =>
              save.mutate(
                { plan: form },
                {
                  onSuccess: (result) => {
                    toast("ok", result.created ? "План создан" : "План сохранён");
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Название">
          <Input value={form.title ?? ""} onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <Field label="Код" hint="Латиница, цифры, дефис. Используется в API и в истории.">
          <Input value={form.code ?? ""} onChange={(e) => patch({ code: e.target.value })} disabled={Boolean(draft.id)} />
        </Field>
        <Field label="Цена в месяц, $">
          <Input
            inputMode="decimal"
            className="tnum"
            value={String(form.price_usd ?? 0)}
            onChange={(e) => patch({ price_usd: num(e.target.value) })}
          />
        </Field>
        <Field label="Включено сотрудников">
          <Input
            inputMode="numeric"
            className="tnum"
            value={String(form.included_seats ?? 0)}
            onChange={(e) => patch({ included_seats: Math.round(num(e.target.value)) })}
          />
        </Field>
        <Field label="Сверхлимитное место, $ / мес" hint="Списывается по дням за прошедший месяц.">
          <Input
            inputMode="decimal"
            className="tnum"
            value={String(form.overage_price_usd ?? 0)}
            onChange={(e) => patch({ overage_price_usd: num(e.target.value) })}
          />
        </Field>
        <Field
          label="AI-токенов в месяц"
          hint={suggested !== null ? `По формуле: ${tokens(suggested)}` : undefined}
        >
          <Input
            inputMode="numeric"
            className="tnum"
            value={String(form.included_tokens ?? 0)}
            onChange={(e) => patch({ included_tokens: Math.round(num(e.target.value)) })}
          />
        </Field>
        <Field label="AI-помощник">
          <Select
            value={form.ai_enabled === false ? "off" : "on"}
            onChange={(e) => patch({ ai_enabled: e.target.value === "on" })}
          >
            <option value="on">Доступен</option>
            <option value="off">Выключен на этом плане</option>
          </Select>
        </Field>
        <Field label="В каталоге">
          <Select value={form.is_active === false ? "off" : "on"} onChange={(e) => patch({ is_active: e.target.value === "on" })}>
            <option value="on">Показывать</option>
            <option value="off">Скрыть (действующие подписки не меняются)</option>
          </Select>
        </Field>
        <Field label="Порядок в списке">
          <Input
            inputMode="numeric"
            className="tnum"
            value={String(form.sort_order ?? 0)}
            onChange={(e) => patch({ sort_order: Math.round(num(e.target.value)) })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function PackModal({ draft, onClose }: { draft: Partial<Pack>; onClose: () => void }) {
  const toast = useToast();
  const save = usePackSave();
  const [form, setForm] = useState(draft);
  const patch = (next: Partial<Pack>) => setForm((prev) => ({ ...prev, ...next }));

  return (
    <Modal
      open
      title={draft.id ? `Пакет «${draft.title}»` : "Новый пакет токенов"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!form.code?.trim() || !form.title?.trim() || !form.tokens}
            onClick={() =>
              save.mutate(
                { pack: form },
                {
                  onSuccess: (result) => {
                    toast("ok", result.created ? "Пакет создан" : "Пакет сохранён");
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Название">
          <Input value={form.title ?? ""} onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <Field label="Код">
          <Input value={form.code ?? ""} onChange={(e) => patch({ code: e.target.value })} disabled={Boolean(draft.id)} />
        </Field>
        <Field label="Токенов">
          <Input
            inputMode="numeric"
            className="tnum"
            value={String(form.tokens ?? 0)}
            onChange={(e) => patch({ tokens: Math.round(num(e.target.value)) })}
          />
        </Field>
        <Field label="Цена, $">
          <Input
            inputMode="decimal"
            className="tnum"
            value={String(form.price_usd ?? 0)}
            onChange={(e) => patch({ price_usd: num(e.target.value) })}
          />
        </Field>
        <Field label="В каталоге">
          <Select value={form.is_active === false ? "off" : "on"} onChange={(e) => patch({ is_active: e.target.value === "on" })}>
            <option value="on">Показывать</option>
            <option value="off">Скрыть</option>
          </Select>
        </Field>
        <Field label="Порядок в списке">
          <Input
            inputMode="numeric"
            className="tnum"
            value={String(form.sort_order ?? 0)}
            onChange={(e) => patch({ sort_order: Math.round(num(e.target.value)) })}
          />
        </Field>
      </div>
      <p className="text-xs text-slate-400">
        Купленные токены не сгорают при продлении: они тратятся после того, как закончился месячный лимит плана.
      </p>
    </Modal>
  );
}
