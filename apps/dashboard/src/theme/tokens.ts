import { colors, type ColorToken } from '@fleet/design-tokens';

export { colors, type ColorToken };
export {
  typography,
  spacing,
  radius,
  shadows,
  driverStatusColor,
  deliveryStatusColor,
  type DriverStatusKey,
  type DeliveryStatusKey,
} from '@fleet/design-tokens';

/** camelCase token name → kebab-case CSS variable suffix. */
function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** The `var(--color-*)` reference for a semantic color token. */
export function color(token: ColorToken): string {
  return `var(--color-${kebab(token)})`;
}

/** A spacing-scale `var(--space-n)` reference. */
export function space(step: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): string {
  return `var(--space-${step})`;
}

/** A radius `var(--radius-*)` reference. */
export function radiusVar(name: 'control' | 'card' | 'modal' | 'pill'): string {
  return `var(--radius-${name})`;
}

/** A shadow `var(--shadow-*)` reference. */
export function shadow(name: 'sm' | 'md' | 'lg'): string {
  return `var(--shadow-${name})`;
}

/** A font-size `var(--font-size-*)` reference. */
export function fontSize(
  name: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl',
): string {
  return `var(--font-size-${name})`;
}

/** The `var(--status-driver-*)` reference for a Driver_Status value. */
export function driverStatusVar(status: string): string {
  return `var(--status-driver-${kebab(status.replace(/_/g, '-'))})`;
}

/** The `var(--status-delivery-*)` reference for a Delivery_Status value. */
export function deliveryStatusVar(status: string): string {
  return `var(--status-delivery-${kebab(status.replace(/_/g, '-'))})`;
}
