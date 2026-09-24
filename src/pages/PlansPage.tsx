import { useState } from "react";
import { Calculator, Pencil, Plus, Trash2 } from "lucide-react";
import {
  usePackDelete,
  usePackSave,
  usePacks,
  usePlanDelete,
  usePlanSave,
  usePlans,
  useRecomputeTokenLimits,
  useSettings,
} from "../api/billing";
import type { Pack, Plan } from "../api/billing";
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal, NumberInput, Select, Table, Td, errorText, useToast } from "../components/ui";
import { tokens, usd } from "../lib/format";

const EMPTY_PLAN: Partial<Plan> = {
  code: "",
  title: "",
  price_usd: 0,
  included_seats: 0,
  overage_price_usd: 0,
  included_ai_usd: 0,
  ai_enabled: true,
  is_active: true,
  sort_order: 0,
};

const EMPTY_PACK: Partial<Pack> = { code: "", title: "", grants_usd: 5, price_usd: 0, is_active: true, sort_order: 0 };

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
          title="Проставить лимит AI по формуле: доля от цены плана"
          onClick={() =>
            recompute.mutate(
              {},
              {
                onSuccess: () => toast("ok", "Лимиты AI пересчитаны по формуле"),
                onError: (e) => toast("error", errorText(e)),
              }
            )
          }
        >
          <Calculator className="h-4 w-4" /> Пересчитать лимиты AI
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
              лимит AI по формуле: {Math.round(settings.data.ai_included_share * 100)}% цены плана
            </span>
          ) : null
        }
      >
        {plans.error ? <ErrorBox error={plans.error} /> : null}
        {plans.isLoading ? (
          <Loading />
        ) : (
          <Table
            head={["Название", "Код", "Цена", "Мест", "Сверх лимита", "AI в месяц", "Компаний", "Статус", ""]}
            empty={(plans.data ?? []).length === 0}
          >
            {(plans.data ?? []).map((plan) => (
              <tr
                key={plan.id}
                onClick={() => setPlanDraft(plan)}
                className="cursor-pointer hover:bg-slate-50"
                title="Открыть для изменения"
              >
                <Td className="font-medium text-slate-900">{plan.title}</Td>
                <Td className="text-slate-400">{plan.code}</Td>
                <Td className="tnum">{usd(plan.price_usd)}</Td>
                <Td className="tnum text-slate-600">{plan.included_seats}</Td>
                <Td className="tnum text-slate-600">{usd(plan.overage_price_usd)} / место</Td>
                <Td className="tnum text-slate-600">
                  {plan.ai_enabled ? (
                    <>
                      {usd(plan.included_ai_usd)}
                      <div className="text-xs text-slate-400">≈ {tokens(plan.included_tokens)} токенов</div>
                    </>
                  ) : (
                    "выключен"
                  )}
                </Td>
                <Td className="tnum text-slate-600">{plan.subscriptions ?? 0}</Td>
                <Td>
                  <Badge tone={plan.is_active ? "green" : "slate"}>{plan.is_active ? "В каталоге" : "Скрыт"}</Badge>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Pencil className="h-3.5 w-3.5" /> Изменить
                  </span>
                </Td>
              </tr>
            ))}
          </Table>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Нажмите на строку, чтобы изменить план. Новая цена действует со следующего счёта: выставленные счета хранят
          свой снимок цен. Удалить можно только план, которым ещё никто не пользовался; если компании на нём уже есть,
          снимите «в каталоге» — он исчезнет из выбора, а действующие подписки не изменятся.
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
          <Table head={["Название", "Код", "Даёт AI на", "Цена", "Статус", ""]} empty={(packs.data ?? []).length === 0}>
            {(packs.data ?? []).map((pack) => (
              <tr
                key={pack.id}
                onClick={() => setPackDraft(pack)}
                className="cursor-pointer hover:bg-slate-50"
                title="Открыть для изменения"
              >
                <Td className="font-medium text-slate-900">{pack.title}</Td>
                <Td className="text-slate-400">{pack.code}</Td>
                <Td className="tnum text-slate-600">{usd(pack.grants_usd)}</Td>
                <Td className="tnum">{usd(pack.price_usd)}</Td>
                <Td>
                  <Badge tone={pack.is_active ? "green" : "slate"}>{pack.is_active ? "В каталоге" : "Скрыт"}</Badge>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Pencil className="h-3.5 w-3.5" /> Изменить
                  </span>
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
  const remove = usePlanDelete();
  const settings = useSettings();
  const [form, setForm] = useState(draft);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = (next: Partial<Plan>) => setForm((prev) => ({ ...prev, ...next }));

  // Подсказка «сколько выходит по формуле» — оператор может взять её как есть
  // или поставить своё число. Рядом — порядок величины в токенах, чтобы было
  // видно, много это или мало.
  const suggestedUsd =
    settings.data && form.price_usd
      ? Math.round(settings.data.ai_included_share * Number(form.price_usd) * 100) / 100
      : null;
  const asTokens =
    settings.data && form.included_ai_usd
      ? Math.floor((Number(form.included_ai_usd) / settings.data.ai_blended_usd_per_mtok) * 1_000_000)
      : null;

  return (
    <Modal
      open
      title={draft.id ? `План «${draft.title}»` : "Новый план"}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          {draft.id ? (
            <Button
              variant="danger"
              className="mr-auto"
              loading={remove.isPending}
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                remove.mutate(
                  { plan_id: draft.id! },
                  {
                    onSuccess: () => {
                      toast("ok", "План удалён");
                      onClose();
                    },
                    onError: (e) => {
                      setConfirmDelete(false);
                      toast("error", errorText(e));
                    },
                  }
                );
              }}
            >
              <Trash2 className="h-4 w-4" /> {confirmDelete ? "Точно удалить?" : "Удалить"}
            </Button>
          ) : null}
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
          <NumberInput
            className="tnum"
            value={form.price_usd}
            onValueChange={(v) => patch({ price_usd: v })}
          />
        </Field>
        <Field label="Включено сотрудников">
          <NumberInput
            integer
            className="tnum"
            value={form.included_seats}
            onValueChange={(v) => patch({ included_seats: v })}
          />
        </Field>
        <Field label="Сверхлимитное место, $ / мес" hint="Списывается по дням за прошедший месяц.">
          <NumberInput
            className="tnum"
            value={form.overage_price_usd}
            onValueChange={(v) => patch({ overage_price_usd: v })}
          />
        </Field>
        <Field
          label="AI в месяц, $"
          hint={
            [
              suggestedUsd !== null ? `По формуле: ${usd(suggestedUsd)}` : null,
              asTokens !== null ? `≈ ${tokens(asTokens)} токенов` : null,
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
        >
          <NumberInput
            className="tnum"
            value={form.included_ai_usd}
            onValueChange={(v) => patch({ included_ai_usd: v })}
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
          <NumberInput
            integer
            className="tnum"
            value={form.sort_order}
            onValueChange={(v) => patch({ sort_order: v })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function PackModal({ draft, onClose }: { draft: Partial<Pack>; onClose: () => void }) {
  const toast = useToast();
  const save = usePackSave();
  const remove = usePackDelete();
  const [form, setForm] = useState(draft);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const patch = (next: Partial<Pack>) => setForm((prev) => ({ ...prev, ...next }));

  return (
    <Modal
      open
      title={draft.id ? `Пакет «${draft.title}»` : "Новый пакет токенов"}
      onClose={onClose}
      footer={
        <>
          {draft.id ? (
            <Button
              variant="danger"
              className="mr-auto"
              loading={remove.isPending}
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                remove.mutate(
                  { pack_id: draft.id! },
                  {
                    onSuccess: () => {
                      toast("ok", "Пакет удалён");
                      onClose();
                    },
                    onError: (e) => {
                      setConfirmDelete(false);
                      toast("error", errorText(e));
                    },
                  }
                );
              }}
            >
              <Trash2 className="h-4 w-4" /> {confirmDelete ? "Точно удалить?" : "Удалить"}
            </Button>
          ) : null}
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!form.code?.trim() || !form.title?.trim() || !form.grants_usd}
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
        <Field label="Даёт AI на, $" hint="Сколько долларов лимита получит компания.">
          <NumberInput
            className="tnum"
            value={form.grants_usd}
            onValueChange={(v) => patch({ grants_usd: v })}
          />
        </Field>
        <Field label="Цена, $">
          <NumberInput
            className="tnum"
            value={form.price_usd}
            onValueChange={(v) => patch({ price_usd: v })}
          />
        </Field>
        <Field label="В каталоге">
          <Select value={form.is_active === false ? "off" : "on"} onChange={(e) => patch({ is_active: e.target.value === "on" })}>
            <option value="on">Показывать</option>
            <option value="off">Скрыть</option>
          </Select>
        </Field>
        <Field label="Порядок в списке">
          <NumberInput
            integer
            className="tnum"
            value={form.sort_order}
            onValueChange={(v) => patch({ sort_order: v })}
          />
        </Field>
      </div>
      <p className="text-xs text-slate-400">
        Купленный лимит не сгорает при продлении: он тратится после того, как закончился месячный лимит плана.
      </p>
    </Modal>
  );
}
