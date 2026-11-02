import { useEffect, useState } from 'react';
import { auth } from 'kairoq';
import { Toaster } from './components/ui/toaster.jsx';
import SignIn from './components/SignIn.jsx';
import Shell from './components/Shell.jsx';
import Dashboard from './components/Dashboard.jsx';
import Pipeline from './components/Pipeline.jsx';
import Contacts from './components/Contacts.jsx';
import Tasks from './components/Tasks.jsx';
import AgentPage from './components/AgentPage.jsx';
import Copilot from './components/Copilot.jsx';
import { useRecords, invoke } from './lib/crm.js';

function Workspace({ user }) {
  const [view, setView] = useState('dashboard');
  const [copilot, setCopilot] = useState(false);
  const [contacts] = useRecords('contacts');
  const [deals] = useRecords('deals');
  const [tasks] = useRecords('tasks');
  const [activity] = useRecords('activity');
  const [drafts] = useRecords('drafts');
  const [runs] = useRecords('agent_runs');
  // The first time a team signs in, a few example records show how it works (marked as examples).
  useEffect(() => { invoke('seed', {}).catch(() => {}); }, []);
  const props = { contacts, deals, tasks, activity, drafts, runs, setView, onCopilot: () => setCopilot(true) };
  return (
    <Shell view={view} setView={setView} user={user} openTasks={(tasks || []).filter((t) => !t.done).length} onCopilot={() => setCopilot(true)}>
      {view === 'dashboard' && <Dashboard {...props} />}
      {view === 'pipeline' && <Pipeline {...props} />}
      {view === 'contacts' && <Contacts {...props} />}
      {view === 'tasks' && <Tasks {...props} />}
      {view === 'agent' && <AgentPage {...props} />}
      <Copilot open={copilot} onOpenChange={setCopilot} />
    </Shell>
  );
}

export default function App() {
  const [user, setUser] = useState(auth.user());
  useEffect(() => { document.title = 'Relay CRM'; return auth.onChange(setUser); }, []);
  return (<>{user ? <Workspace user={user} /> : <SignIn />}<Toaster /></>);
}
