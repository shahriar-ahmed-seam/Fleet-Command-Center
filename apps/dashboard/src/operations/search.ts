import type { DeliveryRecord } from './types';

/**
 * Return exactly the deliveries whose identifier or recipient name contains the
 * (trimmed, case-insensitive) query as a substring. An empty/blank query
 * returns no matches. Input order is preserved; pure.
 */
export function searchDeliveries(
  deliveries: readonly DeliveryRecord[],
  query: string,
): DeliveryRecord[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return deliveries.filter(
    (d) =>
      d.deliveryId.toLowerCase().includes(q) ||
      d.recipientName.toLowerCase().includes(q),
  );
}
