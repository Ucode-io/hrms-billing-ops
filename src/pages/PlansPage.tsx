import { useState } from "react";
import { Calculator, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useCatalogReorder,
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
import { useRowDrag } from "../lib/useRowDrag";

// Кода и порядка в форме нет (решение 25.09): код сервер собирает из названия,
// порядок меняется перетаскиванием строк, новый план встаёт первым.
const EMPTY_PLAN: Partial<Plan> = {
  title: "",
  price_usd: 0,
  included_seats: 0,
  overage_price_usd: 0,
  included_ai_usd: 0,
  ai_enabled: true,
  is_active: true,
};

const EMPTY_PACK: Partial<Pack> = { title: "", grants_usd: 5, price_usd: 0, is_active: true };

/** Полоска-подсказка, куда встанет перетаскиваемая строка. */
const dropLine = (side: "before" | "after" | null) =>
  side === "before" ? "shadow-[inset_0_2px_0_0_#0f172a]" : side === "after" ? "shadow-[inset_0_-2px_0_0_#0f172a]" : "";

function GripCell() {
  return (
    <Td className="w-6 cursor-grab text-slate-300 active:cursor-grabbing" title="Перетащите, чтобы поменять порядок">
      <GripVertical className="h-4 w-4" />
    </Td>
  );
}

export default function PlansPage() {
  const plans = usePlans();
  const packs = usePacks();
  const settings = useSettings();
  const recompute = useRecomputeTokenLimits();
  const toast = useToast();

  const [planDraft, setPlanDraft] = useState<Partial<Plan> | null>(null);
  const [packDraft, setPackDraft] = useState<Partial<Pack> | null>(null);

  const reorderPlans = useCatalogReorder("plan");
  const reorderPacks = useCatalogReorder("pack");
  const onReorderError = { onError: (e: unknown) => toast("error", errorText(e)) };
  const planDrag = useRowDrag(
    (plans.data ?? []).map((plan) => plan.id),
    (ids) => reorderPlans.mutate(ids, onReorderError)
  );
  const packDrag = useRowDrag(
    (packs.data ?? []).map((pack) => pack.id),
    (ids) => reorderPacks.mutate(ids, onReorderError)
  );

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
            head={["", "Название", "Цена", "Мест", "Сверх лимита", "AI в месяц", "Компаний", "Видят клиенты", ""]}
            empty={(plans.data ?? []).length === 0}
          >
            {(plans.data ?? []).map((plan) => (
              <tr
                key={plan.id}
                {...planDrag.rowProps(plan.id)}
                onClick={() => !planDrag.wasDragged() && setPlanDraft(plan)}
                className={`cursor-pointer hover:bg-slate-50 ${planDrag.dragId === plan.id ? "opacity-40" : ""} ${dropLine(planDrag.dropSide(plan.id))}`}
                title="Нажмите, чтобы изменить; перетащите, чтобы поменять порядок"
              >
                <GripCell />
                <Td className="font-medium text-slate-900">{plan.title}</Td>
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
                  <Badge tone={plan.is_active ? "green" : "slate"}>{plan.is_active ? "Да" : "Только оператор"}</Badge>
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
          Нажмите на строку, чтобы изменить план; перетащите за ручку слева, чтобы поменять порядок в этом списке.
          Клиенты видят планы по цене, от дешёвого к дорогому. Новая цена действует со следующего счёта: выставленные
          счета хранят свой снимок цен. Удалить можно только план, которым ещё никто не пользовался; если компании на нём
          уже есть, поставьте «Видят клиенты: нет» — выбрать его сможет только оператор, действующие подписки не изменятся.
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
          <Table head={["", "Название", "Даёт AI на", "Цена", "В продаже", ""]} empty={(packs.data ?? []).length === 0}>
            {(packs.data ?? []).map((pack) => (
              <tr
                key={pack.id}
                {...packDrag.rowProps(pack.id)}
                onClick={() => !packDrag.wasDragged() && setPackDraft(pack)}
                className={`cursor-pointer hover:bg-slate-50 ${packDrag.dragId === pack.id ? "opacity-40" : ""} ${dropLine(packDrag.dropSide(pack.id))}`}
                title="Нажмите, чтобы изменить; перетащите, чтобы поменять порядок"
              >
                <GripCell />
                <Td className="font-medium text-slate-900">{pack.title}</Td>
                <Td className="tnum text-slate-600">{usd(pack.grants_usd)}</Td>
                <Td className="tnum">{usd(pack.price_usd)}</Td>
                <Td>
                  <Badge tone={pack.is_active ? "green" : "slate"}>{pack.is_active ? "Да" : "Не продаётся"}</Badge>
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
            disabled={!form.title?.trim()}
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
        <div className="sm:col-span-2">
          <Field label="Название">
            <Input value={form.title ?? ""} onChange={(e) => patch({ title: e.target.value })} />
          </Field>
        </div>
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
        <Field
          label="Видят клиенты"
          hint="Закрытый план назначает только оператор; компания на нём сама план не меняет. Действующие подписки флаг не трогает."
        >
          <Select value={form.is_active === false ? "off" : "on"} onChange={(e) => patch({ is_active: e.target.value === "on" })}>
            <option value="on">Да — клиенты могут выбрать</option>
            <option value="off">Нет — назначает только оператор</option>
          </Select>
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
            disabled={!form.title?.trim() || !form.grants_usd}
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
        <div className="sm:col-span-2">
          <Field label="Название">
            <Input value={form.title ?? ""} onChange={(e) => patch({ title: e.target.value })} />
          </Field>
        </div>
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
        <Field label="В продаже" hint="Снятый с продажи пакет не купить; купленный остаток у компаний сохраняется.">
          <Select value={form.is_active === false ? "off" : "on"} onChange={(e) => patch({ is_active: e.target.value === "on" })}>
            <option value="on">Да</option>
            <option value="off">Нет — не продаётся</option>
          </Select>
        </Field>
      </div>
      <p className="text-xs text-slate-400">
        Купленный лимит не сгорает при продлении: он тратится после того, как закончился месячный лимит плана.
      </p>
    </Modal>
  );
}
