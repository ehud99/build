/**
 * «Ver datos»: la tabla gemela de un gráfico (accesible sin pasar el mouse). `rows` son pares
 * `[etiqueta, valor]` ya formateados.
 */
export function DataTable({ caption, head, rows, testId }) {
  return (
    <details className="group mt-2 text-xs" data-testid={testId}>
      <summary className="inline-flex cursor-pointer select-none items-center gap-1 rounded-full px-2 py-1 text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent">
        <span className="group-open:hidden">Ver datos</span>
        <span className="hidden group-open:inline">Ocultar datos</span>
      </summary>
      <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-border">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-surface-2 text-text-muted">
            <tr>
              {head.map((h, i) => (
                <th key={h} scope="col" className={`px-3 py-1.5 font-medium ${i ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="px-3 py-1 font-normal text-text-muted">
                      {cell}
                    </th>
                  ) : (
                    <td key={i} className="px-3 py-1 text-right tabular-nums">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default DataTable;
