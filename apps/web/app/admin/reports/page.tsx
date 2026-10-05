import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminContext } from '../../../lib/admin-session';
import { getDictionary } from '../../../lib/i18n';
import { reportsRepository } from '../../../lib/runtime';
import { reportStatusSchema } from '../../../lib/report-service';
import { ReportActions } from '../../../components/report-actions';
export async function generateMetadata() {
  let context;
  try {
    context = await adminContext();
  } catch {
    notFound();
  }
  const d = getDictionary(context.user.locale);
  return {
    title: `${d.public.admin.title} · Folyo`,
    robots: { index: false, follow: false },
  };
}
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  let context;
  try {
    context = await adminContext();
  } catch {
    notFound();
  }
  const d = getDictionary(context.user.locale),
    a = d.public.admin;
  const status = reportStatusSchema.safeParse((await searchParams).status);
  const rows = await reportsRepository().list(
    status.success ? status.data : undefined,
  );
  return (
    <main>
      <h1>{a.title}</h1>
      <p>{a.note}</p>
      <nav className="report-filter">
        <Link href="/admin/reports">{a.all}</Link>
        {reportStatusSchema.options.map((status) => (
          <Link key={status} href={`/admin/reports?status=${status}`}>
            {a.statuses[status]}
          </Link>
        ))}
      </nav>
      {rows.length === 0 && <p>{a.empty}</p>}
      {rows.map((report) => (
        <section key={report.id}>
          <h2>{report.handle}</h2>
          <p>
            {d.public.report.reasons[
              report.reason as keyof typeof d.public.report.reasons
            ] ?? report.reason}{' '}
            ·{' '}
            {a.statuses[report.status as keyof typeof a.statuses] ??
              report.status}
          </p>
          {report.createdAt && (
            <time dateTime={report.createdAt.toISOString()}>
              {report.createdAt.toLocaleString(context.user.locale)}
            </time>
          )}
          <p className="report-details">{report.details}</p>
          <ReportActions id={report.id} d={d} />
        </section>
      ))}
    </main>
  );
}
