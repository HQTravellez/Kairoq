import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Rooms from './pages/Rooms.jsx';
import Book from './pages/Book.jsx';
import Stays from './pages/Stays.jsx';
import Owner from './pages/Owner.jsx';

export default function App() {
  useEffect(() => { document.title = 'Casa Azul · Boutique hotel in Alfama, Lisbon'; }, []);
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/book" element={<Book />} />
          <Route path="/stays" element={<Stays />} />
          <Route path="/owner" element={<Owner />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Layout>
      <Toaster richColors position="top-center" />
    </HashRouter>
  );
}
