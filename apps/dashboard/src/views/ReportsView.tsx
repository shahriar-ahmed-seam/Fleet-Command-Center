import React from 'react';
import { Card, Panel } from '../components';
import { StatusCounts } from '../operations';
import { DRIVER_STATUS_ORDER, DELIVERY_STATUS_ORDER } from '../operations';
import { deliveryStatusVar } from '../theme/tokens';
import type { DriverRecord, DeliveryRecord } from '../operations';

export interface ReportsViewProps {
  drivers: DriverRecord[];
  deliveries: DeliveryRecord[];
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }): React.ReactElement {
  return (
    <Card padding={4}>
      <div style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--color-text-muted)' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{sub}</div>}
    </Card>
  );
}

/** Operational summary: fleet/delivery breakdowns and headline metrics. */
export function ReportsView({ drivers, deliveries }: ReportsViewProps): React.ReactElement {
  const total = deliveries.length;
  const completed = deliveries.filter((d) => d.status === 'Completed').length;
  const active = deliveries.filter((d) => ['Assigned', 'In_Transit', 'Arrived'].includes(d.status)).length;
  const failed = deliveries.filter((d) => d.status === 'Failed').length;
  const onDuty = drivers.filter((d) => d.status === 'Available' || d.status === 'On_Delivery').length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div style={{ padding: 'var(--space-4)', height: '100%', boxSizing: 'border-box', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
        <Metric label="Completion rate" value={`${completionRate}%`} sub={`${completed} of ${total} deliveries`} />
        <Metric label="Active deliveries" value={String(active)} sub="assigned · in transit · arrived" />
        <Metric label="Drivers on duty" value={String(onDuty)} sub={`${drivers.length} total`} />
        <Metric label="Failed" value={String(failed)} sub="requires follow-up" />
      </div>

      <Panel title="Deliveries by status">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <StatusCounts items={deliveries} statusOf={(d) => d.status} order={DELIVERY_STATUS_ORDER} kind="delivery" />
        </div>
        <DeliveryBar deliveries={deliveries} />
      </Panel>

      <Panel title="Drivers by status">
        <StatusCounts items={drivers} statusOf={(d) => d.status} order={DRIVER_STATUS_ORDER} kind="driver" />
      </Panel>
    </div>
  );
}

/** A simple stacked proportion bar of delivery statuses. */
function DeliveryBar({ deliveries }: { deliveries: DeliveryRecord[] }): React.ReactElement {
  const total = deliveries.length || 1;
  const segments = DELIVERY_STATUS_ORDER.map((s) => ({
    status: s,
    n: deliveries.filter((d) => d.status === s).length,
  })).filter((s) => s.n > 0);

  return (
    <div style={{ display: 'flex', height: 12, borderRadius: 'var(--radius-pill)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      {segments.map((s) => (
        <div
          key={s.status}
          title={`${s.status.replace(/_/g, ' ')}: ${s.n}`}
          style={{ width: `${(s.n / total) * 100}%`, background: deliveryStatusVar(s.status) }}
        />
      ))}
    </div>
  );
}
