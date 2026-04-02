import { useMemo, useState } from 'react';
import { WalletCards, UserCog, School, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

const levelOptions = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function OwnerDashboard() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [tariffForm, setTariffForm] = useState({ courseId: '', price: '', totalLessons: '' });
  const [teacherForm, setTeacherForm] = useState({
    fullName: '',
    languages: 'English',
    levels: 'B1',
    workSchedule: '{"mon":[{"start":"18:00","end":"20:00"}]}'
  });
  const [roomForm, setRoomForm] = useState({ name: '', capacity: '' });

  const counts = useMemo(() => ({
    courses: snapshot?.courses?.length || 0,
    tariffs: snapshot?.tariffs?.length || 0,
    teachers: snapshot?.teachers?.length || 0,
    rooms: snapshot?.rooms?.length || 0,
  }), [snapshot]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getOwnerSnapshot();
      setSnapshot(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitTariff(event) {
    event.preventDefault();
    try {
      await api.createTariff({
        courseId: Number(tariffForm.courseId),
        price: Number(tariffForm.price),
        totalLessons: Number(tariffForm.totalLessons),
      });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitTeacher(event) {
    event.preventDefault();
    try {
      await api.createTeacher({
        fullName: teacherForm.fullName,
        languages: teacherForm.languages.split(',').map((x) => x.trim()).filter(Boolean),
        levels: teacherForm.levels.split(',').map((x) => x.trim()).filter(Boolean),
        workSchedule: JSON.parse(teacherForm.workSchedule),
      });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitRoom(event) {
    event.preventDefault();
    try {
      await api.createRoom({
        name: roomForm.name,
        capacity: Number(roomForm.capacity),
      });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="space-y-6">
      <div className="panel flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="title-font text-xl font-bold">Панель владельца</h2>
          <p className="text-sm text-slate-600">Тарифы, компетенции преподавателей и лимиты кабинетов.</p>
        </div>
        <button className="btn-primary inline-flex items-center gap-2" onClick={refresh} disabled={loading}>
          <RefreshCw size={16} /> Обновить
        </button>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Курсы" value={counts.courses} />
        <StatCard label="Тарифы" value={counts.tariffs} />
        <StatCard label="Преподаватели" value={counts.teachers} />
        <StatCard label="Кабинеты" value={counts.rooms} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <form className="panel space-y-3" onSubmit={submitTariff}>
          <h3 className="title-font flex items-center gap-2 font-semibold"><WalletCards size={18} /> Создать тариф</h3>
          <input className="input" placeholder="ID курса" value={tariffForm.courseId} onChange={(e) => setTariffForm({ ...tariffForm, courseId: e.target.value })} />
          <input className="input" placeholder="Цена" value={tariffForm.price} onChange={(e) => setTariffForm({ ...tariffForm, price: e.target.value })} />
          <input className="input" placeholder="Количество уроков" value={tariffForm.totalLessons} onChange={(e) => setTariffForm({ ...tariffForm, totalLessons: e.target.value })} />
          <button className="btn-accent w-full" type="submit">Сохранить тариф</button>
        </form>

        <form className="panel space-y-3" onSubmit={submitTeacher}>
          <h3 className="title-font flex items-center gap-2 font-semibold"><UserCog size={18} /> Карточка преподавателя</h3>
          <input className="input" placeholder="ФИО" value={teacherForm.fullName} onChange={(e) => setTeacherForm({ ...teacherForm, fullName: e.target.value })} />
          <input className="input" placeholder="Языки через запятую" value={teacherForm.languages} onChange={(e) => setTeacherForm({ ...teacherForm, languages: e.target.value })} />
          <select className="input" value={teacherForm.levels} onChange={(e) => setTeacherForm({ ...teacherForm, levels: e.target.value })}>
            {levelOptions.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
          </select>
          <textarea className="input min-h-28" placeholder='{"mon":[{"start":"18:00","end":"20:00"}]}' value={teacherForm.workSchedule} onChange={(e) => setTeacherForm({ ...teacherForm, workSchedule: e.target.value })} />
          <button className="btn-accent w-full" type="submit">Сохранить преподавателя</button>
        </form>

        <form className="panel space-y-3" onSubmit={submitRoom}>
          <h3 className="title-font flex items-center gap-2 font-semibold"><School size={18} /> Управление кабинетами</h3>
          <input className="input" placeholder="Название кабинета" value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} />
          <input className="input" placeholder="Вместимость" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} />
          <button className="btn-accent w-full" type="submit">Сохранить кабинет</button>
        </form>
      </div>
    </section>
  );
}

function StatCard({ label, value }) {
  return (
    <article className="panel">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="title-font mt-1 text-2xl font-bold">{value}</p>
    </article>
  );
}
