import { useState } from 'react';
import { Sparkles, GraduationCap, Clock4 } from 'lucide-react';
import { api } from '../lib/api';

const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const dayLabels = {
  mon: 'Пн',
  tue: 'Вт',
  wed: 'Ср',
  thu: 'Чт',
  fri: 'Пт',
  sat: 'Сб',
  sun: 'Вс',
};

export function ManagerWorkspace() {
  const [form, setForm] = useState({
    fullName: '',
    language: 'English',
    level: 'B1',
    tariffId: '',
    groupId: '',
  });
  const [matching, setMatching] = useState(null);
  const [error, setError] = useState('');
  const [registeredStudent, setRegisteredStudent] = useState(null);

  async function loadMatches() {
    setError('');
    setRegisteredStudent(null);
    try {
      const data = await api.getMatchingResources(form.language, form.level);
      setMatching(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function register() {
    setError('');
    try {
      const student = await api.registerStudent({
        fullName: form.fullName,
        languageFocus: form.language,
        currentLevel: form.level,
        tariffId: Number(form.tariffId),
        groupId: Number(form.groupId),
      });
      setRegisteredStudent(student);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="space-y-6">
      <div className="panel">
        <h2 className="title-font text-xl font-bold">Рабочее место менеджера</h2>
        <p className="text-sm text-slate-600">Умная регистрация с подбором в реальном времени.</p>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="panel space-y-3">
          <h3 className="title-font font-semibold">Шаг 1: Данные ученика</h3>
          <input className="input" placeholder="ФИО" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
            <option value="English">Английский</option>
            <option value="Chinese">Китайский</option>
          </select>
          <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
            {levels.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
          </select>
          <button className="btn-primary w-full" onClick={loadMatches}>Шаг 2: Найти доступные ресурсы</button>
        </article>

        <article className="panel space-y-3">
          <h3 className="title-font font-semibold">Шаг 3: Регистрация и начисление уроков</h3>
          <input className="input" placeholder="ID тарифа" value={form.tariffId} onChange={(e) => setForm({ ...form, tariffId: e.target.value })} />
          <input className="input" placeholder="ID группы" value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} />
          <button className="btn-accent w-full" onClick={register}>Зарегистрировать ученика</button>
          {registeredStudent ? (
            <div className="rounded-xl bg-mint p-3 text-sm text-slate-700">
              Ученик {registeredStudent.full_name} создан. Остаток уроков: {registeredStudent.lessons_left}
            </div>
          ) : null}
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ResourcePanel
          icon={<GraduationCap size={16} />}
          title="Подходящие преподаватели"
          items={(matching?.matchingTeachers || []).map((item) => `${item.full_name} (${(item.languages || []).join(', ')})`)}
        />

        <ResourcePanel
          icon={<Sparkles size={16} />}
          title="Доступные группы"
          items={(matching?.availableGroups || []).map((item) => `Группа #${item.id} | ${item.course_title} | ${item.current_students}/${item.capacity}`)}
        />

        <ResourcePanel
          icon={<Clock4 size={16} />}
          title="Свободные слоты"
          items={(matching?.availableSlots || []).map((item) => {
            const firstRoom = item.rooms?.[0]?.name ? `Кабинет: ${item.rooms[0].name}` : 'Кабинет: N/A';
            return `${item.teacherName} | ${dayLabels[item.day] || item.day} ${item.startTime}-${item.endTime} | ${firstRoom}`;
          })}
        />
      </div>
    </section>
  );
}

function ResourcePanel({ icon, title, items }) {
  return (
    <article className="panel">
      <h3 className="title-font mb-3 flex items-center gap-2 font-semibold">{icon} {title}</h3>
      <ul className="space-y-2 text-sm text-slate-700">
        {items.length ? items.map((row) => (
          <li key={row} className="rounded-lg bg-slate-50 p-2">{row}</li>
        )) : <li className="text-slate-400">Пока нет данных</li>}
      </ul>
    </article>
  );
}
