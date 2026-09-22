import { useSyncExternalStore } from "react";

export interface Operator {
  guid: string;
  login: string;
  name: string;
}

interface AuthState {
  token: string | null;
  operator: Operator | null;
}

const STORAGE_KEY = "billing-ops-auth";

function read(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, operator: null };
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    return { token: parsed.token ?? null, operator: parsed.operator ?? null };
  } catch {
    // Приватное окно или очищенное хранилище — просто разлогиненный старт.
    return { token: null, operator: null };
  }
}

let state = read();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  try {
    if (state.token) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Не смогли сохранить — сессия проживёт до перезагрузки, это не повод падать.
  }
}

export const auth = {
  get token() {
    return state.token;
  },
  get operator() {
    return state.operator;
  },
  get isAuthorized() {
    return Boolean(state.token);
  },
  signIn(token: string, operator: Operator | null) {
    state = { token, operator };
    persist();
    emit();
  },
  setOperator(operator: Operator) {
    state = { ...state, operator };
    persist();
    emit();
  },
  signOut() {
    state = { token: null, operator: null };
    persist();
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot() {
    return state;
  },
};

export function useAuth(): AuthState {
  return useSyncExternalStore(auth.subscribe, auth.snapshot, auth.snapshot);
}
