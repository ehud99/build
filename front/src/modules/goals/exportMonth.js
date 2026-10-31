import { formatHours } from './hours.js';
import { dayScore, finalScore, maxScore, monthLabel, rowTotal } from './score.js';

/**
 * Exportar la hoja del mes. `monthCsv` arma un CSV para Excel en español (separador `;`, coma
 * decimal y BOM de UTF-8 para los acentos): una fila por objetivo con `1` en los días cumplidos y
 * su T, luego «Horas trabajadas» y «Puntaje del día», y el puntaje final.
 */

const cellText = (value) => {
  const text = String(value ?? '');
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function monthCsv(data) {
  const n = data?.days_in_month ?? 0;
  const days = Array.from({ length: n }, (_, i) => i + 1);
  const goals = data?.goals ?? [];
  const hours = data?.work_hours ?? {};
  const rows = [
    [`Objetivos · ${monthLabel(data.month)}`],
    ['Objetivo', ...days, 'T'],
    ...goals.map((g) => [
      `${g.position + 1}. ${g.title}`,
      ...days.map((d) => (g.checked_days.includes(d) ? 1 : '')),
      rowTotal(g),
    ]),
    ['Horas trabajadas', ...days.map((d) => formatHours(hours[d])), formatHours(data.total_hours) || 0],
    ['Puntaje del día', ...days.map((d) => dayScore(goals, d)), finalScore(goals)],
    [],
    ['Puntaje final', `${finalScore(goals)} / ${maxScore(goals, n)}`],
  ];
  return `\uFEFF${rows.map((r) => r.map(cellText).join(';')).join('\r\n')}\r\n`;
}

/** Nombre del archivo: `objetivos-2026-10.csv`. */
export const csvFileName = (month) => `objetivos-${month}.csv`;

/** Descarga `text` como archivo (en el navegador). */
export function downloadText(text, fileName, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
