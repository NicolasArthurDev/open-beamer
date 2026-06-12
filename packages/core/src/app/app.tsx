import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Home } from './routes/home';
import { Present } from './routes/present';
import { Viewer } from './routes/viewer';

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/d/:id" element={<Viewer />} />
        <Route path="/d/:id/present" element={<Present />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
