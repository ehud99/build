/** Pantalla de carga mientras se pregunta por la sesión. */
export function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg" role="status" aria-label="Cargando">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  );
}

export default LoadingScreen;
