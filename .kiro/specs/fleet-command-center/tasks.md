# Implementation Plan: Fleet Command Center

## Overview

This plan builds Fleet Command Center incrementally in dependency order: monorepo scaffolding and shared contracts first, then the PostGIS schema, the Node.js management path (Auth/RBAC, fleet, delivery, assignment, route orchestration, zones, history), the Go hot path (Ingestion, Geofence, Streaming), the Python OR-Tools optimizer, the shared design-token/brand system, and finally the three client surfaces (React Dispatch Dashboard, Flutter Driver App, Flutter Customer App).

Each correctness property from the design (Properties 1–40) is implemented as a single property-based test using the language-appropriate library (Go `gopter`/`rapid`, Node `fast-check`, Python `Hypothesis`, React `fast-check`), runs a minimum of 100 iterations, and is tagged `Feature: fleet-command-center, Property {n}: ...`. Property/unit/integration/performance/accessibility tasks are sub-tasks marked optional with `*`.

## Tasks

- [x] 1. Monorepo scaffolding and shared contracts
  - [x] 1.1 Create monorepo workspace structure
    - Create top-level packages: `services/ingestion` (Go), `services/streaming` (Go), `services/geofence` (Go), `services/management` (Node/NestJS), `services/optimizer` (Python), `apps/dashboard` (React+TS), `apps/driver` (Flutter), `apps/customer` (Flutter), `packages/contracts`, `packages/design-tokens`
    - Add workspace manifests, language toolchain configs, and per-service Dockerfiles
    - _Requirements: 13.1_
  - [x] 1.2 Define shared wire contracts
    - Define cross-service DTOs/enums in `packages/contracts`: ping payload, position/zoneEvent/assignment/routeUpdate socket events, `Driver_Status`, `Delivery_Status`, error envelope `{ error, fields: [...] }`
    - _Requirements: 4.1, 4.2, 5.2, 6.6, 8.4_
  - [x] 1.3 Configure property-based test harnesses per language
    - Wire `gopter`/`rapid` (Go), `fast-check` (Node and React), `Hypothesis` (Python); add a min-100-iteration default and the `Feature: fleet-command-center` tag convention
    - _Requirements: 4.2_

- [x] 2. PostGIS schema and migrations
  - [x] 2.1 Create core relational tables and migrations
    - Migrations for `Driver`, `Vehicle`, `Delivery`, `Assignment`, `Route` with constraints (unique driver email, unique vehicle identifier, enums, FKs, `createdAt`/`updatedAt`)
    - _Requirements: 1.1, 3.1, 7.1, 8.1, 9.3_
  - [x] 2.2 Create geospatial tables and spatial indexes
    - Migrations for `Zone` (Polygon 4326 + GiST), `Location_Ping` (Point 4326 + GiST + btree `(vehicleId, timestamp)`), `Zone_Event`, `Vehicle_Zone_Membership`
    - _Requirements: 4.1, 6.1, 6.3, 6.4_
  - [x] 2.3 Create history table and retention policy
    - Migration for `Delivery_Status_History` and a ≥365-day retention configuration for completed/failed deliveries
    - _Requirements: 16.1, 16.2_
  - [x]* 2.4 Write unit tests for schema constraints
    - Verify unique constraints, enum guards, and spatial index presence
    - _Requirements: 1.3, 3.2, 6.1_

- [x] 3. Auth_Service and RBAC (Node.js)
  - [x] 3.1 Implement authentication and session tokens
    - Login issuing role-bearing JWTs, refresh, expiry; generic invalid-credential message; customer tracking-link scoped capability tokens
    - _Requirements: 2.1, 2.2, 2.6, 13.1, 11.5_
  - [x]* 3.2 Write property test for credential authentication
    - **Property 7: Valid credentials authenticate; invalid credentials fail indistinguishably**
    - **Validates: Requirements 2.1, 2.2, 13.1** — min 100 iterations, `fast-check`
  - [x]* 3.3 Write property test for expired-token rejection
    - **Property 8: Expired tokens are rejected until re-authentication**
    - **Validates: Requirements 2.6** — min 100 iterations, `fast-check`
  - [x] 3.4 Implement RBAC middleware and permission matrix
    - `authorize(role, action, resource)` enforcing the role matrix, driver ownership scoping, and tracking-link scope; deny with authorization-denied
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.6_
  - [x]* 3.5 Write property test for the RBAC matrix
    - **Property 35: Authorization follows the role permission matrix**
    - **Validates: Requirements 13.2, 13.3, 13.4** — min 100 iterations, `fast-check`
  - [x]* 3.6 Write property test for ownership and link scoping
    - **Property 32: Resource access is restricted to owners and link scope**
    - **Validates: Requirements 11.5, 13.5, 13.6** — min 100 iterations, `fast-check`

- [x] 4. Shared validation utilities (Node.js)
  - [x] 4.1 Implement field/range validators and structured errors
    - Required-field, range (lat/lng, weight `(0,1000]`), and zone-geometry vertex-count checks returning `{ error, fields: [...] }` naming each offending field
    - _Requirements: 1.2, 4.2, 4.3, 6.2, 7.2_
  - [x]* 4.2 Write property test for required-field/range validation
    - **Property 2: Required-field validation rejects and reports offending fields without persisting**
    - **Validates: Requirements 1.2, 4.2, 4.3, 6.2, 7.2** — min 100 iterations, `fast-check`; generators must exercise empty/whitespace strings, non-ASCII text, and coordinate/weight/vertex boundaries

- [x] 5. Driver management (Node.js)
  - [x] 5.1 Implement driver CRUD, listing, and deactivation
    - Create driver (default `Offline`), update with `updatedAt`, deactivate (blocks new assignments), list filtered by `Driver_Status`, duplicate-email rejection
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x]* 5.2 Write property test for driver creation defaults
    - **Property 1: Driver creation initializes to Offline**
    - **Validates: Requirements 1.1** — min 100 iterations, `fast-check`
  - [x]* 5.3 Write property test for update persistence and timestamp
    - **Property 4: Updates persist and advance the update timestamp**
    - **Validates: Requirements 1.4** — min 100 iterations, `fast-check`
  - [x] 5.4 Implement driver status transitions and eligibility
    - `Available`/`On_Break`/`Offline` transitions, system-driven `On_Delivery` during active assignment, eligibility flag
    - _Requirements: 2.3, 2.4, 2.5_
  - [x]* 5.5 Write property test for availability/eligibility
    - **Property 9: Driver availability transitions reflect eligibility**
    - **Validates: Requirements 2.3, 2.5** — min 100 iterations, `fast-check`

- [x] 6. Vehicle management (Node.js)
  - [x] 6.1 Implement vehicle registration, association, and listing
    - Register vehicle, duplicate-identifier rejection, driver association with effective timestamp and single-active-association conflict, list vehicles with current driver
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x]* 6.2 Write property test for unique-key constraints
    - **Property 3: Unique-key constraints reject duplicates**
    - **Validates: Requirements 1.3, 3.2** — min 100 iterations, `fast-check`
  - [x]* 6.3 Write property test for status filters and listings
    - **Property 6: Status filters and listings return exactly the matching set**
    - **Validates: Requirements 1.6, 3.5** — min 100 iterations, `fast-check`
  - [x]* 6.4 Write property test for single active association
    - **Property 10: A vehicle has at most one active driver association**
    - **Validates: Requirements 3.3, 3.4** — min 100 iterations, `fast-check`

- [x] 7. Delivery creation and lifecycle (Node.js)
  - [x] 7.1 Implement delivery creation with validation and geocoding
    - Validate fields and weight range, geocode destination with a 10 s timeout, reject geocoding failure without persisting, create with `Created` status
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 7.2 Implement lifecycle transition table and enforcement
    - Central (state, event) transition table covering Created→Assigned/Cancelled, In_Transit, Arrived, Completed, Failed, Cancelled; reject undefined/terminal transitions with invalid-transition message and retain status
    - _Requirements: 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 10.3, 10.4_
  - [x]* 7.3 Write property test for the lifecycle state machine
    - **Property 20: Delivery lifecycle honors only defined transitions**
    - **Validates: Requirements 7.4, 7.5, 7.6, 7.9, 7.10, 7.11, 10.3, 10.4** — min 100 iterations, `fast-check`
  - [x]* 7.4 Write property test for terminal-transition side effects
    - **Property 21: Terminal transitions record their side effects**
    - **Validates: Requirements 7.7, 7.8** — min 100 iterations, `fast-check`
  - [x]* 7.5 Write integration test for geocoding rejection/timeout
    - Stubbed geocoder failure and 10 s timeout path; assert nothing persisted
    - _Requirements: 7.3_

- [x] 8. Delivery assignment (Node.js)
  - [x] 8.1 Implement assignment create, accept, and reassign
    - Link deliveries to available driver and associated vehicle, reject unavailable-driver/already-assigned, record acceptance timestamp, reassign moving a delivery between assignments
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6_
  - [x]* 8.2 Write property test for assignment eligibility
    - **Property 5: Deactivated and unavailable drivers cannot receive assignments**
    - **Validates: Requirements 1.5, 2.4, 8.2** — min 100 iterations, `fast-check`
  - [x]* 8.3 Write property test for assignment linking
    - **Property 22: Assignment creation links deliveries to the available driver and vehicle**
    - **Validates: Requirements 8.1** — min 100 iterations, `fast-check`
  - [x]* 8.4 Write property test for single active assignment per delivery
    - **Property 23: A delivery belongs to at most one active assignment**
    - **Validates: Requirements 8.3, 8.6** — min 100 iterations, `fast-check`
  - [x]* 8.5 Write property test for acceptance timestamp
    - **Property 24: Assignment acceptance records its timestamp**
    - **Validates: Requirements 8.5** — min 100 iterations, `fast-check`
  - [x]* 8.6 Write integration test for assignment notification to Driver_App
    - Assignment creation reaches a subscribed Driver_App socket within the budget
    - _Requirements: 8.4_

- [x] 9. Route optimization (Python optimizer + Node orchestration)
  - [x] 9.1 Implement Route_Optimizer service (Python + OR-Tools)
    - Pre-cluster destinations within 25 m via `ST_DWithin`-equivalent, solve metric TSP from vehicle origin for 2–50 stops, return `{ sequence, groups }`
    - _Requirements: 9.1, 9.8_
  - [x]* 9.2 Write property test for co-located stop grouping
    - **Property 28: Co-located destinations are grouped into a single stop**
    - **Validates: Requirements 9.8** — min 100 iterations, `Hypothesis`; generators include near-25 m destination pairs
  - [x] 9.3 Implement Node route orchestration and fallback
    - Request optimize for 2–50 deliveries; >50 → assigned-order route flagged unoptimized + over-limit message; validate optimizer output (exact-cover) else fallback; 30 s timeout fallback; re-optimize on delivery-set change; mark assignment complete and free driver when all stops terminal; publish route to Driver_App
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 10.6_
  - [x]* 9.4 Write property test for optimization request/fallback bounds
    - **Property 25: Route optimization is requested for 2–50 deliveries and falls back beyond the limit**
    - **Validates: Requirements 9.1, 9.2** — min 100 iterations, `fast-check`
  - [x]* 9.5 Write property test for optimizer-output validation
    - **Property 26: Route construction trusts only valid optimizer output**
    - **Validates: Requirements 9.3, 9.4, 9.5** — min 100 iterations, `fast-check`; mock optimizer omission/foreign/duplicate/timeout
  - [x]* 9.6 Write property test for re-optimization on change
    - **Property 27: Changing an assignment's delivery set triggers re-optimization**
    - **Validates: Requirements 9.6** — min 100 iterations, `fast-check`
  - [x]* 9.7 Write property test for route completion freeing the driver
    - **Property 29: A route whose stops are all terminal completes the assignment and frees the driver**
    - **Validates: Requirements 10.6** — min 100 iterations, `fast-check`
  - [x]* 9.8 Write integration test for optimizer end-to-end
    - Real Python service for a small assignment; assert ordered route delivered to Driver_App
    - _Requirements: 9.1, 9.7_

- [x] 10. Zone management (Node.js)
  - [x] 10.1 Implement zone definition with geometry validation
    - Validate name length and polygon (closed, simple, 3–1,000 vertices) via `ST_IsValid`/`ST_IsClosed`; persist with optional arrival label; reject and persist nothing on invalid geometry
    - _Requirements: 6.1, 6.2_
  - [x]* 10.2 Write property test for zone geometry round-trip
    - **Property 17: Valid zone geometry round-trips**
    - **Validates: Requirements 6.1** — min 100 iterations, `fast-check`

- [x] 11. Ingestion_Service (Go)
  - [x] 11.1 Implement ping validation, ordering, persistence, and queue publish
    - Validate presence/ranges, enforce per-vehicle high-water mark (discard stale), persist with telemetry and ack within budget, publish `accepted-ping` to the queue; persist even when streaming is down
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 14.5_
  - [x]* 11.2 Write property test for monotonic ping ordering
    - **Property 11: Per-vehicle ping ordering is monotonic; stale pings are discarded**
    - **Validates: Requirements 4.4** — min 100 iterations, `gopter`/`rapid`; shuffled/duplicate timestamps
  - [x]* 11.3 Write property test for ping telemetry round-trip
    - **Property 12: Accepted pings persist with their included telemetry (round-trip)**
    - **Validates: Requirements 4.1, 4.5** — min 100 iterations, `gopter`/`rapid`
  - [x]* 11.4 Write property test for streaming-down persistence
    - **Property 37: Ingestion persists pings even when streaming is unavailable**
    - **Validates: Requirements 14.5** — min 100 iterations, `gopter`/`rapid`; mock streaming unavailable
  - [x]* 11.5 Write performance/load test for ingestion throughput
    - Sustained 5,000 pings/s all-valid persisted and ack latency ≤500 ms
    - _Requirements: 4.6, 4.7_

- [x] 12. Geofence_Engine (Go)
  - [x] 12.1 Implement containment evaluation and Enter/Exit emission
    - On each accepted ping, compute membership (inside-or-boundary) via PostGIS, compare prior membership, emit Enter/Exit/nothing, include arrival label when configured, publish events to queue
    - _Requirements: 6.3, 6.4, 6.5, 6.8_
  - [x]* 12.2 Write property test for geo-fence transition logic
    - **Property 16: Geo-fence events fire if and only if membership changes**
    - **Validates: Requirements 6.3, 6.4, 6.5** — min 100 iterations, `gopter`/`rapid`; include boundary-of-polygon points
  - [x]* 12.3 Write property test for arrival-label payload
    - **Property 18: Zone-event payload carries the arrival label iff configured**
    - **Validates: Requirements 6.8** — min 100 iterations, `gopter`/`rapid`

- [x] 13. Streaming_Service (Go + Socket.IO)
  - [x] 13.1 Implement rooms, broadcast, disconnect release, and reconnect resume
    - Room-keyed subscriptions (`vehicle:{id}`, `delivery:{id}`, `dashboard:global`), broadcast positions/zone events, release resources on disconnect, restore prior subscriptions on reconnect, expose connection-status signal, Redis Pub/Sub fan-out across replicas
    - _Requirements: 5.2, 5.6, 6.6, 14.1, 14.3, 14.4_
  - [x] 13.2 Implement zone-event retry delivery
    - Retain undelivered zone events and retry up to 3 times
    - _Requirements: 6.7_
  - [x]* 13.3 Write property test for retry bound
    - **Property 19: Undelivered zone events are retained and retried up to three times**
    - **Validates: Requirements 6.7** — min 100 iterations, `gopter`/`rapid`; mock delivery failures
  - [x]* 13.4 Write property test for subscription correctness and resume
    - **Property 36: Subscriptions deliver exactly the relevant updates and survive reconnect**
    - **Validates: Requirements 14.1, 14.3, 14.4** — min 100 iterations, `gopter`/`rapid`
  - [x]* 13.5 Write integration test for zone-event broadcast to dashboard
    - Zone event reaches a subscribed dashboard client and activity feed within budget
    - _Requirements: 6.6, 12.4_
  - [x]* 13.6 Write performance/load test for concurrent clients
    - ≥1,000 concurrent clients receiving live updates with broadcast latency ≤2 s
    - _Requirements: 14.2, 5.2_

- [x] 14. Customer arrival notification wiring (Node.js)
  - [x] 14.1 Implement destination-zone arrival notification routing
    - On an Enter event for the vehicle entering a delivery's destination zone, route an arrival notification to that delivery's customer only
    - _Requirements: 11.3_
  - [x]* 14.2 Write property test for arrival-notification scoping
    - **Property 31: Destination-zone entry notifies the delivery's customer**
    - **Validates: Requirements 11.3** — min 100 iterations, `fast-check`

- [x] 15. Historical data and reporting (Node.js)
  - [x] 15.1 Implement history, vehicle-track, and summary queries
    - Ordered delivery status history, vehicle track within a time range, date-range summary counts of Completed/Failed/Cancelled
    - _Requirements: 16.2, 16.3, 16.4_
  - [x]* 15.2 Write property test for range/history query correctness
    - **Property 40: History and range queries return exactly the in-range records, ordered**
    - **Validates: Requirements 16.2, 16.3, 16.4** — min 100 iterations, `fast-check`

- [x] 16. Checkpoint - backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Shared design system and branding
  - [x] 17.1 Implement design tokens for web and Flutter
    - Single source of color/typography/spacing/radius/shadow tokens as CSS custom properties and a Dart token map; status-color mapping for `Driver_Status`/`Delivery_Status`
    - _Requirements: 15.2_
  - [x] 17.2 Implement BrandProvider and placeholder branding
    - Runtime `palette.json` load mapping onto tokens, logo wordmark placeholder, hero gradient placeholder so no slot renders broken
    - _Requirements: 15.1, 15.3, 15.5_
  - [x]* 17.3 Write property test for branding slots
    - **Property 38: Branding renders an asset or a defined placeholder, never a broken element**
    - **Validates: Requirements 15.5** — min 100 iterations, `fast-check`
  - [x]* 17.4 Write property test for token contrast ratios
    - **Property 39: Token color pairs meet WCAG AA contrast thresholds**
    - **Validates: Requirements 15.6** — min 100 iterations, `fast-check`
  - [x]* 17.5 Write visual/responsive and accessibility tests
    - Snapshot/visual-regression for token application and ≥1280 px responsive layout; automated contrast audit plus notes for manual assistive-technology review
    - _Requirements: 15.2, 15.4, 15.6_

- [x] 18. Dispatch Dashboard (React + TypeScript)
  - [x] 18.2 Build shared component primitives
    - Token-styled `Button`, `Input`/`Select`/`FormField`, `Badge`, `Card`/`Panel`, `Modal`, `Toast`, `Table`, `Tabs`, `Tooltip`, `ConnectionIndicator`, `StatCard`, `ActivityFeedItem`, `MapMarker`, `MapPathTrace`
    - _Requirements: 15.2_
  - [x] 18.1 Build app shell, navigation, and connection indicator
    - Top nav with operator logo, search field, connection indicator; left rail; RBAC-aware routing; WebSocket client with auto-reconnect
    - _Requirements: 15.1, 15.4, 5.6, 13.2_
  - [x] 18.3 Build live map with markers, path trace, filters, and zones
    - Render active vehicle markers updating from WebSocket, draw selected-vehicle path trace (≥60 min, chronological), `Driver_Status`/`Zone` filters, translucent zone polygons
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x]* 18.4 Write property test for path-trace ordering/windowing
    - **Property 14: Path trace is chronological and windowed**
    - **Validates: Requirements 5.3, 5.4** — min 100 iterations, `fast-check`
  - [x]* 18.5 Write property test for filtered marker set
    - **Property 15: Live map shows exactly the vehicles matching the active view/filter**
    - **Validates: Requirements 5.1, 5.5** — min 100 iterations, `fast-check`
  - [x] 18.6 Build status counts, activity feed, search, and driver detail
    - Driver/Delivery count cards by status, zone-event activity feed, delivery search by identifier/recipient, driver detail panel (assignment/route/position)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  - [x]* 18.7 Write property test for status counts
    - **Property 33: Status counts equal actual grouped counts**
    - **Validates: Requirements 12.1, 12.2** — min 100 iterations, `fast-check`
  - [x]* 18.8 Write property test for delivery search
    - **Property 34: Delivery search returns exactly the matching deliveries**
    - **Validates: Requirements 12.5** — min 100 iterations, `fast-check`
  - [x]* 18.9 Write unit tests for dashboard scenarios
    - Connection-lost indicator + auto-reconnect (5.6), driver-detail rendering (12.3), logo-in-nav rendering with/without asset (15.1)
    - _Requirements: 5.6, 12.3, 15.1_

- [x] 19. Driver App (Flutter)
  - [x] 19.1 Build driver auth, availability, route view, and ping transmit
    - Sign-in and availability controls, ordered route with stops, navigation guidance to next stop, start/complete stop progress, transmit pings at ≤10 s during active assignment
    - _Requirements: 2.1, 2.3, 10.1, 10.2, 10.3, 10.4, 10.5_
  - [x] 19.2 Implement offline ping queue and reconnect flush
    - Local chronological queue capped at 10,000 (drop oldest when full), flush in chronological order on reconnect within 60 s
    - _Requirements: 4.8, 4.9_
  - [x]* 19.3 Write property test for offline queue
    - **Property 13: Offline ping queue is bounded and chronological**
    - **Validates: Requirements 4.8, 4.9** — min 100 iterations
  - [x]* 19.4 Write performance test for flush and cadence
    - Offline flush completes within 60 s; active-assignment ping cadence ≤10 s
    - _Requirements: 4.9, 10.5_

- [x] 20. Customer App (Flutter)
  - [x] 20.1 Build tracking view with live position and branding
    - Resolve tracking link to a single delivery, show current status, live vehicle position while In_Transit (update ≤5 s), arrival notification on destination-zone entry, completion/cancellation states, hero/branding via shared tokens
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 15.3_
  - [x]* 20.2 Write property test for tracking-view state
    - **Property 30: Tracking views reflect delivery state**
    - **Validates: Requirements 11.1, 11.4, 11.6** — min 100 iterations
  - [x]* 20.3 Write integration test for live customer position
    - Live position updates on an In_Transit delivery within budget
    - _Requirements: 11.2_

- [x] 21. Final checkpoint - all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (tests) and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each correctness property (1–40) is implemented as a single property-based test running a minimum of 100 iterations and tagged `Feature: fleet-command-center, Property {n}: ...`.
- External dependencies (geocoder, optimizer, streaming transport, clock) are mocked in property tests; timing/load/external-service criteria are covered by the integration and performance sub-tasks.
- Each task references the specific requirement clauses it implements for traceability.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3", "9.1", "17.1"] },
    { "id": 3, "tasks": ["2.4", "3.1", "4.1", "9.2", "11.1", "17.2"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "4.2", "5.1", "7.1", "10.1", "11.2", "11.3", "11.4", "12.1", "13.1", "17.3", "17.4", "18.2"] },
    { "id": 5, "tasks": ["3.5", "3.6", "5.2", "5.3", "5.4", "6.1", "7.2", "10.2", "11.5", "12.2", "12.3", "13.2", "15.1", "17.5", "18.1"] },
    { "id": 6, "tasks": ["5.5", "6.2", "6.3", "6.4", "7.3", "7.4", "7.5", "8.1", "13.3", "13.4", "13.5", "13.6", "14.1", "15.2", "18.3", "18.6"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4", "8.5", "9.3", "14.2", "18.4", "18.5", "18.7", "18.8", "18.9", "20.1"] },
    { "id": 8, "tasks": ["9.4", "9.5", "9.6", "9.7", "9.8", "19.1", "20.2", "20.3"] },
    { "id": 9, "tasks": ["8.6", "19.2"] },
    { "id": 10, "tasks": ["19.3", "19.4"] }
  ]
}
```
