import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { OwnerDashboard } from './OwnerDashboard';
import { api, setApiContext } from '../lib/api';

export function CenterOwnerDashboard() {
  const { centerId } = useParams();
  const [managers, setManagers] = useState([]);
  const [overview, setOverview] = useState(null);
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!centerId) {
      return;
    }

    setApiContext({
      role: 'center_owner',
      centerId,
      userId: '00000000-0000-0000-0000-000000000002',
    });

    loadCenterOwnerData(centerId);
  }, [centerId]);

  async function loadCenterOwnerData(id) {
    setError('');
    try {
      const [managerRows, overviewData] = await Promise.all([
        api.centerManagers(id),
        api.centerAnalyticsOverview(id, 30),
      ]);

      setManagers(managerRows);
      setOverview(overviewData);
    } catch (err) {
      setError(err.message);
    }
  }

  async function inviteManager() {
    setError('');
    try {
      const data = await api.centerInviteManager(centerId);
      setInviteLink(data.activationLink);
      await loadCenterOwnerData(centerId);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="space-y-6">
      <article className="panel">
        <h2 className="title-font text-xl font-bold">Center Owner Dashboard</h2>
        <p className="text-sm text-slate-600">Center ID: {centerId}</p>
      </article>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="panel">
          <p className="text-sm text-slate-500">Всего учеников</p>
          <p className="title-font text-2xl font-bold">{overview?.total_students || 0}</p>
        </article>
        <article className="panel">
          <p className="text-sm text-slate-500">Новых (30 дней)</p>
          <p className="title-font text-2xl font-bold">{overview?.new_students || 0}</p>
        </article>
        <article className="panel">
          <p className="text-sm text-slate-500">Продлений (30 дней)</p>
          <p className="title-font text-2xl font-bold">{overview?.renewals || 0}</p>
        </article>
      </div>

      <article className="panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="title-font font-semibold">Менеджеры центра</h3>
          <button className="btn-primary" onClick={inviteManager}>Invite manager</button>
        </div>
        {inviteLink ? <p className="break-all rounded-lg bg-slate-50 p-2 text-xs">Manager invite: {inviteLink}</p> : null}
        <ul className="space-y-2 text-sm text-slate-700">
          {managers.length ? managers.map((m) => (
            <li key={m.id} className="rounded-lg bg-slate-50 p-2">{m.name} ({m.email || 'no email'})</li>
          )) : <li className="text-slate-400">Менеджеров пока нет</li>}
        </ul>
      </article>

      <OwnerDashboard />
    </section>
  );
}
