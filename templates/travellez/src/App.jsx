import { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import SiteLayout from './components/SiteLayout.jsx';
import AppShell from './components/AppShell.jsx';
import Home from './pages/Home.jsx';
import Platform from './pages/Platform.jsx';
import SmartItinerary from './pages/SmartItinerary.jsx';
import Industries from './pages/Industries.jsx';
import About from './pages/About.jsx';
import Pricing from './pages/Pricing.jsx';
import Dashboard from './pages/app/Dashboard.jsx';
import Trips from './pages/app/Trips.jsx';
import Approvals from './pages/app/Approvals.jsx';
import Spend from './pages/app/Spend.jsx';
import Travelers from './pages/app/Travelers.jsx';
import Controls from './pages/app/Controls.jsx';

const TITLES = { '/': 'Travellez · Business travel that runs itself', '/platform': 'Platform · Travellez', '/smart-itinerary': 'Smart Itinerary · Travellez', '/industries': 'Industries · Travellez', '/about': 'About · Travellez', '/pricing': 'Pricing · Travellez' };
function Title() { const { pathname } = useLocation(); useEffect(() => { document.title = TITLES[pathname] || (pathname.startsWith('/app') ? 'Workspace · Travellez' : 'Travellez'); }, [pathname]); return null; }
const site = (el) => <SiteLayout>{el}</SiteLayout>;

export default function App() {
  return (
    <HashRouter>
      <Title />
      <Routes>
        <Route path="/" element={site(<Home />)} />
        <Route path="/platform" element={site(<Platform />)} />
        <Route path="/smart-itinerary" element={site(<SmartItinerary />)} />
        <Route path="/industries" element={site(<Industries />)} />
        <Route path="/about" element={site(<About />)} />
        <Route path="/pricing" element={site(<Pricing />)} />
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
