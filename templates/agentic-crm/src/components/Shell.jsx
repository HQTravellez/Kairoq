import { auth } from 'kairoq';
import { LayoutDashboard, KanbanSquare, Users, CheckSquare, Bot, Sparkles, LogOut } from 'lucide-react';
import { Button } from './ui/button.jsx';

export const VIEWS = [
  ['dashboard', 'Today', LayoutDashboard], ['pipeline', 'Pipeline', KanbanSquare], ['contacts', 'Contacts', Users],
  ['tasks', 'Tasks', CheckSquare], ['agent', 'Agent', Bot]
];

export default function Shell({ view, setView, user, openTasks, onCopilot, children }) {
  return (
    <div className="flex min-h-dvh bg-muted/40 text-foreground">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-card px-3 py-5 md:flex">
        <p className="px-3 font-display text-xl font-semibold tracking-tight">Relay</p>
        <nav aria-label="Main" className="mt-6 grid gap-1">
          {VIEWS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined}
              className={'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ' + (view === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
              <Icon size={16} aria-hidden="true" /> {label}
              {id === 'tasks' && openTasks > 0 && <span className="ml-auto tabular-nums text-xs opacity-80">{openTasks}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          <Button variant="secondary" className="w-full justify-start gap-2" onClick={onCopilot}><Sparkles size={16} /> Ask Copilot</Button>
          <button onClick={() => auth.signOut()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            <LogOut size={14} /> <span className="truncate">{user.email}</span>
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <p className="font-display text-lg font-semibold">Relay</p>
          <Button size="sm" variant="secondary" onClick={onCopilot}><Sparkles size={14} className="mr-1" /> Copilot</Button>
        </header>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-2 md:hidden">
          {VIEWS.map(([id, label]) => <button key={id} onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined} className={'shrink-0 rounded-md px-3 py-1.5 text-sm ' + (view === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{label}</button>)}
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
