/**
 * Entry point for the management path service (NestJS).
 *
 * Hosts the lower-frequency CRUD/admin domain: Auth_Service, RBAC,
 * driver/vehicle/delivery/assignment/route orchestration, zones, and
 * historical reporting.
 */
import 'reflect-metadata';

const PORT = process.env.MANAGEMENT_PORT ?? '3000';

async function bootstrap(): Promise<void> {
  // NestJS application module wiring is added in later tasks.
  // This skeleton confirms the toolchain compiles and runs.
  // eslint-disable-next-line no-console
  console.log(`management service skeleton ready (intended port ${PORT})`);
}

void bootstrap();
