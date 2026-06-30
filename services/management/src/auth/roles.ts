export enum Role {
  Administrator = 'Administrator',
  Dispatcher = 'Dispatcher',
  Driver = 'Driver',
  Customer = 'Customer',
}

/** Type guard for a value being one of the defined {@link Role}s. */
export function isRole(value: unknown): value is Role {
  return (
    typeof value === 'string' &&
    (Object.values(Role) as string[]).includes(value)
  );
}
