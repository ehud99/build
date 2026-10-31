import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * «Exportar» la hoja del mes: Excel (CSV) o imprimir / guardar como PDF (la hoja completa, en
 * claro y horizontal, con los estilos de impresión de `index.css`).
 */
export function ExportMenu({ onCsv, onPrint, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const item =
    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent';
  const pick = (fn) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="relative print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="export-button"
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-accent hover:text-text focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Exportar
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-border bg-surface p-1 shadow-lg">
          <button type="button" role="menuitem" onClick={pick(onCsv)} className={item} data-testid="export-csv">
            <FileSpreadsheet className="h-4 w-4 text-text-muted" aria-hidden="true" />
            Excel (CSV)
          </button>
          <button type="button" role="menuitem" onClick={pick(onPrint)} className={item} data-testid="export-print">
            <Printer className="h-4 w-4 text-text-muted" aria-hidden="true" />
            Imprimir o PDF
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default ExportMenu;
