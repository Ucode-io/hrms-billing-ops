import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertTriangle, Check, CheckCircle2, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useCompanyCreate, useTenants } from "../api/billing";
import type { CompanyCreateResult } from "../api/billing";
import { Button, ErrorBox, Field, Input, Modal, useToast } from "../components/ui";
import {
  credentialsText,
  generatePassword,
  loginProblem,
  nameProblem,
  passwordProblem,
  suggestLogin,
} from "../lib/companyForm";

type FieldKey = "name" | "firstName" | "login" | "password";

/** Копирование с запасным путём: clipboard API есть не везде (http, старые браузеры). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

function FieldError({ text }: { text: React.ReactNode }) {
  return <span className="mt-1 block text-xs text-rose-600">{text}</span>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</div>;
}

/**
 * Окно «Новая компания» (решения 28.09): компания + её первый админ одним
 * вызовом. Сервер всё проверяет сам и создаёт «всё или ничего»; здесь правила
 * повторены, чтобы ошибка была видна под полем сразу. После успеха окно
 * показывает данные для входа — пароль только здесь и только один раз.
 */
export default function CreateCompanyModal({ onClose }: { onClose: () => void }) {
  const create = useCompanyCreate();
  const tenants = useTenants({});
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [secondName, setSecondName] = useState("");
  // Пока оператор не трогал логин, он собирается из названия компании.
  const [login, setLogin] = useState("");
  const [loginEdited, setLoginEdited] = useState(false);
  const [password, setPassword] = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(true);
  const [touched, setTouched] = useState<Set<FieldKey>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const [result, setResult] = useState<{ data: CompanyCreateResult; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmClose, setConfirmClose] = useState<null | "close" | "open">(null);

  const loginValue = loginEdited ? login : suggestLogin(name);

  const taken = useMemo(() => {
    const wanted = name.trim().toLowerCase();
    if (!wanted) return null;
    return (tenants.data ?? []).find((row) => row.name.trim().toLowerCase() === wanted) ?? null;
  }, [name, tenants.data]);

  const problems: Record<FieldKey, string> = {
    name: nameProblem(name),
    firstName: firstName.trim() ? "" : "Укажите имя администратора",
    login: loginProblem(loginValue),
    password: passwordProblem(password),
  };
  const blocked = Object.values(problems).some(Boolean) || Boolean(taken);
  const shown = (key: FieldKey) => (submitted || touched.has(key) ? problems[key] : "");
  const touch = (key: FieldKey) => () => setTouched((prev) => new Set(prev).add(key));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (blocked || create.isPending) return;
    const sentPassword = password;
    create.mutate(
      {
        name: name.trim(),
        admin: {
          first_name: firstName.trim(),
          second_name: secondName.trim() || undefined,
          login: loginValue.trim().toLowerCase(),
          password: sentPassword,
        },
      },
      {
        onSuccess: (data) => setResult({ data, password: sentPassword }),
        // Компанию могли создать параллельно — обновим список, чтобы показать ссылку на неё.
        onError: () => void tenants.refetch(),
      }
    );
  }

  const text = result
    ? credentialsText(result.data.company.name, result.data.hrms_url, result.data.admin.login, result.password)
    : "";

  async function onCopy() {
    if (await copyText(text)) {
      setCopied(true);
      setConfirmClose(null);
    } else {
      toast("error", "Не удалось скопировать — выделите текст и скопируйте вручную");
    }
  }

  function openCard() {
    if (!result) return;
    onClose();
    navigate(`/tenants/${result.data.company.id}`);
  }

  // Пароль виден только здесь: закрыть, не скопировав, — только после вопроса.
  function requestClose() {
    if (create.isPending) return;
    if (result && !copied) {
      setConfirmClose("close");
      return;
    }
    onClose();
  }

  function requestOpenCard() {
    if (result && !copied) {
      setConfirmClose("open");
      return;
    }
    openCard();
  }

  if (result) {
    return (
      <Modal
        open
        title="Компания создана"
        onClose={requestClose}
        width="max-w-xl"
        footer={
          <>
            <Button onClick={requestOpenCard}>Открыть карточку компании</Button>
            <Button variant="primary" onClick={requestClose}>
              Готово
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Компания «{result.data.company.name}» создана.
            {result.data.duplicate ? " Этот запрос уже создал её раньше — повторно ничего не создавалось." : ""}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          Передайте клиенту данные для входа. Пароль показывается <b>один раз</b> — после закрытия окна его не
          увидеть.
        </p>
        <pre className="select-all whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-800">
          {text}
        </pre>
        <Button variant={copied ? "outline" : "primary"} onClick={onCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Скопировано" : "Скопировать всё"}
        </Button>
        <p className="text-xs text-slate-400">
          В списке компания появилась со статусом «Без плана»: полный доступ, счетов нет. План назначается на её
          карточке.
        </p>
        {confirmClose ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="mr-auto">Пароль больше не будет показан. Закрыть, не скопировав?</span>
            <Button size="sm" onClick={() => setConfirmClose(null)}>
              Вернуться
            </Button>
            <Button size="sm" variant="danger" onClick={confirmClose === "open" ? openCard : onClose}>
              {confirmClose === "open" ? "Всё равно открыть" : "Закрыть всё равно"}
            </Button>
          </div>
        ) : null}
      </Modal>
    );
  }

  return (
    <Modal
      open
      title="Новая компания"
      onClose={requestClose}
      width="max-w-xl"
      footer={
        <>
          <Button onClick={requestClose} disabled={create.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="create-company-form" variant="primary" loading={create.isPending}>
            Создать компанию
          </Button>
        </>
      }
    >
      <form id="create-company-form" onSubmit={submit} className="space-y-3" noValidate>
        <SectionTitle>Компания</SectionTitle>
        <Field label="Название *">
          <Input
            value={name}
            autoFocus
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            onBlur={touch("name")}
            placeholder="Например, Burch development"
          />
          {taken ? (
            <FieldError
              text={
                <>
                  Компания «{taken.name}» уже существует —{" "}
                  <Link to={`/tenants/${taken.tenant_id}`} onClick={onClose} className="underline">
                    открыть карточку
                  </Link>
                </>
              }
            />
          ) : shown("name") ? (
            <FieldError text={shown("name")} />
          ) : null}
        </Field>
        <p className="text-xs text-slate-400">
          Валюта UZS, язык русский, часовой пояс Ташкент — компания поменяет в настройках.
        </p>

        <SectionTitle>Администратор компании</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Имя *">
            <Input value={firstName} maxLength={100} onChange={(e) => setFirstName(e.target.value)} onBlur={touch("firstName")} />
            {shown("firstName") ? <FieldError text={shown("firstName")} /> : null}
          </Field>
          <Field label="Фамилия">
            <Input value={secondName} maxLength={100} onChange={(e) => setSecondName(e.target.value)} />
          </Field>
        </div>

        <Field
          label="Логин *"
          hint={
            shown("login")
              ? undefined
              : `${loginEdited ? "" : "Подставлен из названия — можно изменить. "}От 6 символов, без пробелов и «+», не email и не телефон.`
          }
        >
          <Input
            value={loginValue}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setLogin(e.target.value);
              // Стёр всё — снова подставляем из названия.
              setLoginEdited(e.target.value !== "");
            }}
            onBlur={touch("login")}
            className="font-mono"
          />
          {shown("login") ? <FieldError text={shown("login")} /> : null}
        </Field>

        <Field
          label="Пароль *"
          hint={shown("password") ? undefined : "Сгенерирован автоматически. Можно ввести свой: от 8 символов, заглавная и строчная буква и цифра."}
        >
          <div className="flex gap-2">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              maxLength={128}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={touch("password")}
              className="font-mono"
            />
            <Button
              type="button"
              title={showPassword ? "Скрыть пароль" : "Показать пароль"}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              title="Сгенерировать заново"
              onClick={() => {
                setPassword(generatePassword());
                setShowPassword(true);
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {shown("password") ? <FieldError text={shown("password")} /> : null}
        </Field>

        {create.error ? <ErrorBox error={create.error} /> : null}
      </form>
    </Modal>
  );
}
