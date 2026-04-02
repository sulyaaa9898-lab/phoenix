import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

export function ActivatePage() {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const token = searchParams.get('token') || '';

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const data = await api.activateInvite({ token, name, password, email: email || undefined });
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <article className="panel">
        <h2 className="title-font text-xl font-bold">Активация инвайта</h2>
        <p className="mt-1 break-all text-xs text-slate-500">Token: {token || 'отсутствует'}</p>
      </article>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <form className="panel space-y-3" onSubmit={submit}>
        <input className="input" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Email (опционально)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn-accent w-full" type="submit" disabled={!token}>Активировать</button>
      </form>

      {result ? (
        <article className="panel text-sm text-slate-700">
          <p>Пользователь создан: {result.user?.name}</p>
          <p>Роль: {result.role}</p>
          <p>Center ID: {result.centerId || 'N/A'}</p>
        </article>
      ) : null}
    </section>
  );
}
