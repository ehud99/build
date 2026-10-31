import { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { PanelLayout } from '@/components/layout/PanelLayout.jsx';
import { LoadingScreen } from '@/components/ui/LoadingScreen.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { MODULES } from '@/modules/registry.js';
import { LoginPage } from '@/pages/auth/LoginPage.jsx';
import { RegisterPage } from '@/pages/auth/RegisterPage.jsx';
import { HomePage } from '@/pages/public/HomePage.jsx';

/** Las rutas del panel piden sesión; sin ella, al login (y de vuelta después). */
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route
        element={
          <RequireAuth>
            <PanelLayout />
          </RequireAuth>
        }
      >
        {MODULES.map((mod) => (
          <Route
            key={mod.key}
            path={mod.path}
            element={
              <Suspense fallback={null}>
                <mod.Page />
              </Suspense>
            }
          />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
