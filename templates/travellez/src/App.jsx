import { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import SiteLayout from './components/SiteLayout.jsx';
import AppShell from './components/AppShell.jsx';
import Home from './pages/Home.jsx';
import SmartItinerary from './pages/SmartItinerary.jsx';
import Pricing from './pages/Pricing.jsx';
import Savings from './pages/Savings.jsx';
import Demo from './pages/Demo.jsx';
import Solutions from './pages/Solutions.jsx';
import Dashboard from './pages/app/Dashboard.jsx';
import Trips from './pages/app/Trips.jsx';
import Approvals from './pages/app/Approvals.jsx';
import Spend from './pages/app/Spend.jsx';
import Travelers from './pages/app/Travelers.jsx';
import Controls from './pages/app/Controls.jsx';

const TITLES = { '/': 'Travellez · Corporate travel that gives you time back', '/product/smart-itinerary': 'Smart Itinerary · Travellez', '/pricing': 'Pricing · Travellez', '/savings-calculator': 'Savings calculator · Travellez', '/demo': 'Book a demo · Travellez' };
function Title() { const { pathname } = useLocation(); useEffect(() => { document.title = TITLES[pathname] || (pathname.startsWith('/app') ? 'Workspace · Travellez' : pathname.startsWith('/solutions') ? 'Solutions · Travellez' : 'Travellez'); }, [pathname]); return null; }
const site = (el) => <SiteLayout>{el}</SiteLayout>;

export default function App() {
  return (
    <HashRouter>
      <Title />
      <Routes>
        <Route path="/" element={site(<Home />)} />
        <Route path="/product/smart-itinerary" element={site(<SmartItinerary />)} />
        <Route path="/pricing" element={site(<Pricing />)} />
        <Route path="/savings-calculator" element={site(<Savings />)} />
        <Route path="/demo" element={site(<Demo />)} />
        <Route path="/solutions/:role" element={site(<Solutions />)} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="trips" element={<Trips />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="spend" element={<Spend />} />
          <Route path="travelers" element={<Travelers />} />
          <Route path="controls" element={<Controls />} />
        </Route>
        <Route path="*" element={site(<Home />)} />
      </Routes>
      <Toaster richColors position="top-center" />
    </HashRouter>
  );
}
