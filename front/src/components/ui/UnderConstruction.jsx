import { Hammer } from 'lucide-react';

/** «En desarrollo»: el Inicio público y el Dashboard del panel, por ahora. */
export function UnderConstruction({ title = 'En desarrollo', text = 'Pronto habrá algo aquí.', testId = 'under-construction' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center" data-testid={testId}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Hammer className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-xs text-sm text-text-muted">{text}</p>
    </div>
  );
}

export default UnderConstruction;
