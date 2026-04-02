import { useEffect, useState } from 'react';
import { api, setApiContext } from '../lib/api';

export function PlatformDashboard() {
  const [centers, setCenters] = useState([]);
  const [error, setError] = useState('');
  const [centerForm, setCenterForm] = useState({ name: '', phone: '' });
  const [inviteLinks, setInviteLinks] = useState({});

  useEffect(() => {
    setApiContext({
      role: 'platform_owner',
      userId: '00000000-0000-0000-0000-000000000001',
      centerId: null,
    });
    loadCenters();
  }, []);

  async function loadCenters() {
    setError('');
    try {
      const data = await api.platformListCenters();
      setCenters(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createCenter(event) {
    event.preventDefault();
    setError('');
    try {
      await api.platformCreateCenter({
        name: centerForm.name,
        phone: centerForm.phone || undefined,
      });
      setCenterForm({ name: '', phone: '' });
      await loadCenters();
    } catch (err) {
      setError(err.message);
    }
  }

  async function inviteOwner(centerId) {
    setError('');
    try {
      const result = await api.platformInviteOwner(centerId);
      setInviteLinks((prev) => ({ ...prev, [centerId]: result.activationLink }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="space-y-6">
      <article className="panel space-y-2">
        <h2 className="title-font text-xl font-bold">Platform Dashboard</h2>
        <p className="text-sm text-slate-600">Создание центров и выдача invite-ссылок владельцам.</p>
      </article>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <form className="panel grid gap-3 md:grid-cols-3" onSubmit={createCenter}>
        <input
          className="input"
          placeholder="Название центра"
          value={centerForm.name}
          onChange={(e) => setCenterForm({ ...centerForm, name: e.target.value })}
        />
        <input
          className="input"
          placeholder="Телефон"
          value={centerForm.phone}
          onChange={(e) => setCenterForm({ ...centerForm, phone: e.target.value })}
        />
        <button className="btn-accent" type="submit">Создать центр</button>
      </form>

      <article className="panel space-y-3">
        <h3 className="title-font font-semibold">Центры</h3>
        <div className="space-y-2 text-sm text-slate-700">
          {centers.length ? centers.map((center) => (
            <div key={center.id} className="rounded-xl bg-slate-50 p-3">
              <p className="font-semibold">{center.name}</p>
              <p>ID: {center.id}</p>
              <p>Статус: {center.status}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-primary" onClick={() => inviteOwner(center.id)}>Invite owner</button>
                <a className="btn-ghost" href={`/center/${center.id}/owner/dashboard`}>Открыть owner-зону</a>
                <a className="btn-ghost" href={`/center/${center.id}/manager/workspace`}>Открыть manager-зону</a>
              </div>
              {inviteLinks[center.id] ? (
                <p className="mt-2 break-all rounded-lg bg-white p-2 text-xs">Owner invite: {inviteLinks[center.id]}</p>
              ) : null}
            </div>
          )) : <p className="text-slate-400">Центры пока не созданы</p>}
        </div>
      </article>
    </section>
  );
}
