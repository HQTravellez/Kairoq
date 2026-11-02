import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Router } from 'kairoq';
import { BillingPage, TeamPage, AdminPage } from 'kairoq/saas';
import { PLANS } from './saas.config.js';
import Home from './pages/Home.jsx';
import Account from './pages/Account.jsx';
import Workspace from './pages/Workspace.jsx';
import AppShell from './components/AppShell.jsx';

// Public pages, then the signed-in app under /app (sign-in and a team are required there).
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<Account mode="signin" />} />
        <Route path="/signup" element={<Account mode="signup" />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Workspace />} />
          <Route path="billing" element={<BillingPage plans={PLANS} />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="admin" element={<AdminPage plans={PLANS} />} />
        </Route>
        <Route path="*" element={<Home />} />
      </Routes>
      <Toaster position="top-center" />
    </Router>
  );
}
