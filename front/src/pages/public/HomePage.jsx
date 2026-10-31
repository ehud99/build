import { AuthHeader } from '@/components/layout/AuthHeader.jsx';
import { LoadingScreen } from '@/components/ui/LoadingScreen.jsx';
import { UnderConstruction } from '@/components/ui/UnderConstruction.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { HOME_PATH } from '@/modules/registry.js';

/** Inicio público: «En desarrollo». Arriba a la derecha, «Iniciar sesión» o, con sesión, «Ir al panel». */
export function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text" data-testid="home">
      {isAuthenticated ? (
        <AuthHeader to={HOME_PATH} label="Ir al panel" testId="home-panel" />
      ) : (
        <AuthHeader to="/login" label="Iniciar sesión" testId="home-login" />
      )}
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <UnderConstruction testId="home-under-construction" />
      </main>
    </div>
  );
}

export default HomePage;
