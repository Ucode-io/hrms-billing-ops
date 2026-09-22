import type { Operator } from "../store/auth";
import { invoke } from "./gateway";

const AUTH_BASE_URL = "https://api.auth.u-code.io";
// Ключ и project-id нужны только для самой формы входа: дальше приложение
// ходит исключительно с Bearer вошедшего человека, API-ключом данные не
// читает и не пишет.
const AUTH_PROJECT_ID = "84f1983d-5095-490e-ba9c-d2618b164c99";
const AUTH_API_KEY = "P-JtJ1lICCMHmhp9JaoxhWh1ZAwoyzFtxw";
const ENVIRONMENT_ID = "2f73835f-3a29-46c8-951e-75119db9bfc0";
const CLIENT_TYPE_ID = "1c435896-2f12-4b61-a684-62ad1d2307d1";
const ROLE_ID = "52e5168d-660b-4339-9ec4-9c02ae226345";

export async function signIn(username: string, password: string): Promise<string> {
  const response = await fetch(`${AUTH_BASE_URL}/v2/login/with-option?project-id=${AUTH_PROJECT_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "API-KEY",
      "x-api-key": AUTH_API_KEY,
      "Environment-Id": ENVIRONMENT_ID,
    },
    body: JSON.stringify({
      login_strategy: "LOGIN_PWD",
      data: { client_type_id: CLIENT_TYPE_ID, role_id: ROLE_ID, username, password },
    }),
  });

  const body = await response.json().catch(() => null);
  const token = body?.data?.token?.access_token;
  if (!response.ok || typeof token !== "string" || !token) {
    throw new Error(body?.description || "Неверный логин или пароль");
  }
  return token;
}

/** Проверка, что вошедший — оператор биллинга. Её делает сервер, не фронт. */
export async function fetchOperator(): Promise<Operator> {
  const result = await invoke<{ operator: boolean; user: Operator }>("billing_ops_me");
  return result.user;
}
