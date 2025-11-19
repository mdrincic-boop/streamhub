import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import { WatchPage } from './pages/WatchPage';
import { EmbedPage } from './pages/EmbedPage';
import { SnapshotPage } from './pages/SnapshotPage';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/watch/:streamId" element={<WatchPage />} />
          <Route path="/embed/:streamId" element={<EmbedPage />} />
          <Route path="/snapshot/:streamId" element={<SnapshotPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
