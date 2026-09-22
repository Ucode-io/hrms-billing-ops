import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useSettings, useSettingsSave } from "../api/billing";
import type { Requisites, Settings } from "../api/billing";
import { Button, Card, ErrorBox, Field, Input, Loading, Textarea, errorText, useToast } from "../components/ui";

const REQUISITE_FIELDS: { key: keyof Requisites; label: string; hint?: string }[] = [
  { key: "company_name", label: "Наименование" },
  { key: "inn", label: "ИНН" },
  { key: "address", label: "Адрес" },
  { key: "bank_name", label: "Банк" },
  { key: "mfo", label: "МФО" },
  { key: "account", label: "Расчётный счёт" },
  { key: "director", label: "Руководитель" },
  { key: "phone", label: "Телефон" },
  { key: "email", label: "E-mail" },
];

const num = (value: string): number => Number(String(value).replace(",", ".")) || 0;

export default function SettingsPage() {
  const { data, isLoading, error } = useSettings();
  const save = useSettingsSave();
  const toast = useToast();

  const [form, setForm] = useState<Settings | null>(null);
  const [pricesText, setPricesText] = useState("");
  const [pricesError, setPricesError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm(data);
    setPricesText(JSON.stringify(data.ai_model_prices ?? {}, null, 2));
  }, [data]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!form) return null;

  const patchRequisite = (key: keyof Requisites, value: string) =>
    setForm((prev) => (prev ? { ...prev, requisites: { ...prev.requisites, [key]: value } } : prev));

  function submit() {
    if (!form) return;
    let prices = form.ai_model_prices;
    try {
      prices = JSON.parse(pricesText || "{}");
      setPricesError(null);
    } catch {
      setPricesError("Не похоже на JSON — исправьте, иначе цены не сохранятся");
      return;
    }
    save.mutate(
      {
        requisites: form.requisites,
        grace_days: form.grace_days,
        ai_blended_usd_per_mtok: form.ai_blended_usd_per_mtok,
        ai_included_share: form.ai_included_share,
        ai_model_prices: prices,
      },
      {
        onSuccess: () => toast("ok", "Настройки сохранены"),
        onError: (e) => toast("error", errorText(e)),
      }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">Настройки</h1>
        <Button variant="primary" loading={save.isPending} onClick={submit}>
          <Save className="h-4 w-4" /> Сохранить
        </Button>
      </div>

      <Card title="Реквизиты для счетов">
        <p className="mb-3 text-xs text-slate-400">
          Печатаются в счёте. Выставленный счёт хранит копию реквизитов на момент выпуска — правка здесь не меняет
          старые счета.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REQUISITE_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} hint={field.hint}>
              <Input
                value={form.requisites[field.key] ?? ""}
                onChange={(e) => patchRequisite(field.key, e.target.value)}
              />
            </Field>
          ))}
        </div>
        <div className="mt-3">
          <Field label="Примечание внизу счёта" hint="Например: «Оплата в течение 5 банковских дней».">
            <Textarea
              rows={2}
              value={form.requisites.footer_note ?? ""}
              onChange={(e) => patchRequisite("footer_note", e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Отсрочка">
          <Field
            label="Платных дней отсрочки"
            hint="Сколько дней после неудачного списания компания работает как обычно. Каждый такой день списывается по дневной ставке и уводит баланс в минус; после них — только просмотр."
          >
            <Input
              inputMode="numeric"
              className="tnum w-32"
              value={String(form.grace_days)}
              onChange={(e) => setForm({ ...form, grace_days: Math.round(num(e.target.value)) })}
            />
          </Field>
        </Card>

        <Card title="AI-токены">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Доля цены плана на AI" hint="0.10 = 10% цены плана уходит на токены.">
              <Input
                inputMode="decimal"
                className="tnum"
                value={String(form.ai_included_share)}
                onChange={(e) => setForm({ ...form, ai_included_share: num(e.target.value) })}
              />
            </Field>
            <Field label="Средняя цена, $ за млн токенов" hint="Смесь входящих и исходящих токенов модели.">
              <Input
                inputMode="decimal"
                className="tnum"
                value={String(form.ai_blended_usd_per_mtok)}
                onChange={(e) => setForm({ ...form, ai_blended_usd_per_mtok: num(e.target.value) })}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            По этим двум числам считается лимит токенов плана на странице «Планы и пакеты».
          </p>
        </Card>
      </div>

      <Card title="Цены моделей" action={<span className="text-xs text-slate-400">$ за млн токенов</span>}>
        <p className="mb-2 text-xs text-slate-400">
          Нужны только для оценки себестоимости в отчётах по расходу токенов. Формат:{" "}
          <code>{'{"claude-sonnet-5": {"input": 2, "output": 10, "cache_write": 2.5, "cache_read": 0.2}}'}</code>
        </p>
        <Textarea
          rows={8}
          className="font-mono text-xs"
          value={pricesText}
          onChange={(e) => setPricesText(e.target.value)}
        />
        {pricesError ? <p className="mt-2 text-xs text-rose-600">{pricesError}</p> : null}
      </Card>
    </div>
  );
}
