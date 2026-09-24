import { auth } from "../store/auth";

const BASE_URL = "https://api.admin.u-code.io";
const PROJECT_ID = "9a462573-ce11-4288-928a-a6ba754b6998";
const FUNCTION_PATH = "udevs-hrms-billing";

export class GatewayError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Шлюз заворачивает ответ метода в несколько конвертов
 * (`data.data.result`), а ошибку метода кладёт в `server_error` при HTTP 200.
 * Спускаемся вниз, пока не найдём наш метод, и по дороге ловим ошибку.
 */
function unwrap(raw: unknown, method: string, depth = 0): unknown {
  if (depth > 6 || !isRecord(raw)) return undefined;

  const serverError = raw.server_error;
  if (typeof serverError === "string" && serverError) {
    throw new GatewayError(serverError);
  }
  if (raw.method === method && "result" in raw) return raw.result;

  for (const key of ["data", "result", "response"]) {
    if (key in raw) {
      const found = unwrap(raw[key], method, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Вызов метода биллинга от имени вошедшего оператора. */
export async function invoke<T>(method: string, data: Record<string, unknown> = {}): Promise<T> {
  const token = auth.token;
  if (!token) throw new GatewayError("Нужно войти заново", 401);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/v2/invoke_function/${FUNCTION_PATH}?project-id=${PROJECT_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: { method, data } }),
    });
  } catch (error) {
    throw new GatewayError(`Сеть недоступна: ${(error as Error).message}`);
  }

  if (response.status === 401 || response.status === 403) {
    auth.signOut();
    throw new GatewayError("Сессия истекла — войдите заново", response.status);
  }

  const body = await response.json().catch(() => null);
  const result = unwrap(body, method);
  if (result === undefined) {
    throw new GatewayError(`Метод ${method} вернул пустой ответ`, response.status);
  }
  return result as T;
}

/** Сервер отказал по правам (метод бросает badRequest('Forbidden')). */
export const isForbidden = (error: unknown): boolean =>
  error instanceof Error && error.message === "Forbidden";

/** Идемпотентный ключ денежной операции: защита от двойного клика и ретрая. */
export const newRequestId = (): string => crypto.randomUUID();
