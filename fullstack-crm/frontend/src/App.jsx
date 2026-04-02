import { ArrowRight, BriefcaseBusiness, LogOut, ShieldCheck } from 'lucide-react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { OwnerDashboard } from './components/OwnerDashboard';
import { ManagerWorkspace } from './components/ManagerWorkspace';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/manager/login" replace />} />
      <Route
        path="/owner/login"
        element={
          <AccessPage
            role="owner"
            badge="Зона владельца"
            title="Вход в панель владельца"
            description="Отдельная ссылка для управления тарифами, преподавателями, кабинетами и архитектурой учебного центра."
            primaryLabel="Открыть панель владельца"
            primaryTo="/owner/dashboard"
            secondaryLabel="Открыть рабочее место менеджера"
            secondaryTo="/manager/login"
          />
        }
      />
      <Route
        path="/manager/login"
        element={
          <AccessPage
            role="manager"
            badge="Зона менеджера"
            title="Вход в рабочее место менеджера"
            description="Отдельная ссылка для регистрации учеников, подбора подходящих групп и поиска свободных слотов."
            primaryLabel="Открыть рабочее место менеджера"
            primaryTo="/manager/workspace"
            secondaryLabel="Открыть панель владельца"
            secondaryTo="/owner/login"
          />
        }
      />
      <Route
        path="/owner/dashboard"
        element={
          <WorkspaceLayout
            role="owner"
            badge="Панель владельца"
            title="Управление учебным центром"
            description="Структура центра, тарифы, преподаватели и кабинеты под контролем владельца."
            exitTo="/owner/login"
            exitLabel="Выйти на страницу входа владельца"
            routeLabel="http://localhost:5173/owner/dashboard"
          >
            <OwnerDashboard />
          </WorkspaceLayout>
        }
      />
      <Route
        path="/manager/workspace"
        element={
          <WorkspaceLayout
            role="manager"
            badge="Рабочее место менеджера"
            title="Регистрация и подбор групп"
            description="Подбор преподавателей, доступных групп и свободных слотов для новых записей."
            exitTo="/manager/login"
            exitLabel="Выйти на страницу входа менеджера"
            routeLabel="http://localhost:5173/manager/workspace"
          >
            <ManagerWorkspace />
          </WorkspaceLayout>
        }
      />
      <Route path="*" element={<Navigate to="/manager/login" replace />} />
    </Routes>
  );
}

function AccessPage({ role, badge, title, description, primaryLabel, primaryTo, secondaryLabel, secondaryTo }) {
  const isOwner = role === 'owner';

  return (
    <div className="min-h-screen bg-atmosphere p-4 md:p-8">
      <section className={`mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center rounded-[2rem] p-6 shadow-panel md:p-10 ${isOwner ? 'bg-white/88' : 'bg-slate-950/90 text-white'}`}>
        <div className="grid w-full gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-5">
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${isOwner ? 'bg-orange-50 text-orange-700' : 'bg-white/10 text-white'}`}>
              {isOwner ? <ShieldCheck size={16} /> : <BriefcaseBusiness size={16} />}
              {badge}
            </div>
            <h1 className={`title-font text-4xl font-extrabold leading-tight ${isOwner ? 'text-ink' : 'text-white'}`}>{title}</h1>
            <p className={`max-w-2xl text-base leading-7 ${isOwner ? 'text-slate-600' : 'text-slate-200'}`}>{description}</p>
            <div className="flex flex-wrap gap-3">
              <Link className="btn-accent inline-flex items-center gap-2" to={primaryTo}>
                {primaryLabel} <ArrowRight size={16} />
              </Link>
              <Link className={`btn-ghost inline-flex items-center gap-2 ${isOwner ? '' : 'btn-ghost-dark'}`} to={secondaryTo}>
                {secondaryLabel}
              </Link>
            </div>
          </div>

          <div className={`rounded-[1.75rem] p-6 ${isOwner ? 'bg-slate-50' : 'bg-white/10'}`}>
            <p className={`text-sm ${isOwner ? 'text-slate-500' : 'text-slate-300'}`}>Прямая ссылка для этой зоны</p>
            <p className={`mt-2 break-all text-lg font-semibold ${isOwner ? 'text-ink' : 'text-white'}`}>{`http://localhost:5173${primaryTo}`}</p>
            <div className={`mt-6 grid gap-3 text-sm ${isOwner ? 'text-slate-600' : 'text-slate-200'}`}>
              <div className="rounded-2xl bg-white/70 p-4">
                <p className="font-semibold">Режим доступа</p>
                <p className="mt-1">Открывает только соответствующую рабочую зону.</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-4">
                <p className="font-semibold">Маршрут без #</p>
                <p className="mt-1">Используется нормальный путь браузера, а не hash-навигация.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function WorkspaceLayout({ role, badge, title, description, exitTo, exitLabel, routeLabel, children }) {
  const isOwner = role === 'owner';

  return (
    <div className="min-h-screen bg-atmosphere p-4 md:p-8">
      <header className={`mx-auto mb-6 w-full max-w-7xl rounded-3xl p-6 shadow-panel backdrop-blur md:p-8 ${isOwner ? 'bg-white/88' : 'bg-slate-950/90 text-white'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-3">
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${isOwner ? 'bg-orange-50 text-orange-700' : 'bg-white/10 text-white'}`}>
              {isOwner ? <ShieldCheck size={16} /> : <BriefcaseBusiness size={16} />}
              {badge}
            </div>
            <h1 className={`title-font text-3xl font-extrabold ${isOwner ? 'text-ink' : 'text-white'}`}>{title}</h1>
            <p className={`text-sm md:text-base ${isOwner ? 'text-slate-600' : 'text-slate-200'}`}>{description}</p>
          </div>

          <div className={`rounded-2xl p-4 text-sm ${isOwner ? 'bg-slate-50 text-slate-600' : 'bg-white/10 text-slate-100'}`}>
            <p className="font-semibold">Текущий адрес</p>
            <p>{routeLabel}</p>
            <Link className={`mt-3 inline-flex items-center gap-2 font-semibold ${isOwner ? 'text-coral' : 'text-orange-300'}`} to={exitTo}>
              <LogOut size={16} />
              {exitLabel}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl">{children}</main>
    </div>
  );
}
