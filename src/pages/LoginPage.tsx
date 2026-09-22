import { useState } from "react";
import { signIn } from "../api/auth";
import { auth } from "../store/auth";
import { Button, ErrorBox, Field, Input } from "../components/ui";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = await signIn(username.trim(), password);
      auth.signIn(token, null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Биллинг HRMS</h1>
        <p className="mt-1 text-sm text-slate-500">Кабинет оператора. Вход тем же логином, что и в HRMS.</p>

        <div className="mt-5 space-y-3">
          <Field label="Логин">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Пароль">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          {error ? <ErrorBox error={error} /> : null}
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            Войти
          </Button>
        </div>
      </form>
    </div>
  );
}
