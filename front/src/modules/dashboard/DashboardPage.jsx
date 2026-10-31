import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { UnderConstruction } from '@/components/ui/UnderConstruction.jsx';

/** Inicio del panel: por ahora «En desarrollo». */
export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Inicio" />
      <UnderConstruction testId="dashboard-under-construction" text="El dashboard está en desarrollo." />
    </>
  );
}
