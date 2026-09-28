/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Шлюз биллинга; по умолчанию прод. Для песочницы — http://localhost:5199. */
  readonly VITE_BILLING_BASE_URL?: string;
}
