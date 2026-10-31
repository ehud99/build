import { Heatmap } from '@/components/charts/Heatmap.jsx';
import { Card, Skeleton } from './Skeleton.jsx';

/** El año de un vistazo, tipo GitHub: cada cuadro es un día con el % de objetivos cumplidos. */
export function HeatmapSection({ heatmap, stale, month }) {
  if (!heatmap) {
    return (
      <Card title="Año">
        <Skeleton className="h-28" />
      </Card>
    );
  }
  return (
    <Card
      title={`Año ${heatmap.year}`}
      subtitle="Cada cuadro es un día: más intenso, más objetivos cumplidos"
      testId="dash-heatmap-card"
      stale={stale}
    >
      <Heatmap year={heatmap.year} days={heatmap.days} today={heatmap.today} focusMonth={month} testId="dash-heatmap" />
    </Card>
  );
}

export default HeatmapSection;
