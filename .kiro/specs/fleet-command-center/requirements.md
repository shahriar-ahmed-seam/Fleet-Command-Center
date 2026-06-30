# Requirements Document

## Introduction

Fleet Command Center is a complete logistics fleet management system that enables logistics operators to track vehicles, manage drivers, assign and monitor deliveries, and provide customers with live delivery tracking. The system ingests high-frequency location pings from driver mobile devices, streams positions to a live map with real-time path tracing, triggers zone-based events through geo-fencing, and optimizes multi-stop delivery routes.

The platform consists of an admin/dispatch web dashboard, a Flutter-based driver mobile app, and a Flutter-based customer app. The backend ingests location telemetry at scale, persists geospatial data, streams updates in real time, and delegates multi-delivery route optimization to a dedicated optimization service.

### Recommended Technical Decisions (Guidance for Scope)

These recommendations resolve the open architecture choices so the system can be built autonomously. They inform requirement scope but remain implementation guidance, not requirements themselves.

- **Backend runtime**: Go for the ingestion and streaming services (strong concurrency for thousands of concurrent location pings), with Node.js permitted for supporting CRUD/admin services.
- **Database**: PostGIS (PostgreSQL with spatial extension) for authoritative geospatial and relational data, chosen for mature spatial indexing, geo-fence containment queries, and transactional integrity.
- **Real-time transport**: Socket.io (WebSocket) for browser dashboard and customer/driver apps, due to broad client support and reconnection handling.
- **Route optimization**: A standalone Python microservice solving the multi-stop routing (Traveling Salesman) problem, invoked asynchronously by the backend.
- **Geo-fencing**: Server-side zone containment evaluation on each accepted location ping using PostGIS spatial predicates.
- **Frontend**: A modern, branded, custom-designed dashboard and apps using operator-provided brand assets (logo, hero imagery, color palette), avoiding generic templated styling.

## Glossary

- **System**: The complete Fleet Command Center platform, including backend services, databases, and client applications.
- **Ingestion_Service**: The backend component that receives, validates, and persists vehicle location pings and telemetry.
- **Streaming_Service**: The backend component that broadcasts real-time location and event updates to connected clients.
- **Geofence_Engine**: The backend component that evaluates location pings against defined zones and triggers zone events.
- **Route_Optimizer**: The Python microservice that computes an optimized stop sequence for a set of deliveries assigned to a driver.
- **Dispatch_Dashboard**: The web application used by dispatchers and administrators to manage drivers, vehicles, deliveries, and live tracking.
- **Driver_App**: The Flutter mobile application used by drivers to receive assignments, report status, and transmit location.
- **Customer_App**: The Flutter mobile application (and/or web tracking page) used by customers to track their deliveries.
- **Auth_Service**: The backend component that authenticates users and enforces role-based authorization.
- **Driver**: A person who operates a vehicle and performs deliveries; has an account in the System.
- **Dispatcher**: A user who assigns deliveries, monitors the fleet, and manages operations.
- **Administrator**: A user with full configuration and management privileges, including zone and user management.
- **Customer**: A recipient of a delivery who tracks delivery progress.
- **Vehicle**: A tracked physical asset associated with a Driver, reporting location and telemetry.
- **Delivery**: A unit of work representing transport of goods to a destination, with a defined lifecycle.
- **Location_Ping**: A timestamped geographic position (latitude, longitude) reported by a Vehicle or Driver_App.
- **Telemetry**: Vehicle operational data accompanying a Location_Ping, such as speed, heading, and battery level.
- **Zone**: A named geographic area (polygon) used for geo-fencing, such as a warehouse or delivery region.
- **Zone_Event**: An event generated when a Vehicle enters or exits a Zone.
- **Path_Trace**: The ordered sequence of recent Location_Pings rendered as a line on the live map.
- **Route**: An ordered sequence of delivery stops assigned to a Driver for execution.
- **Assignment**: The association of one or more Deliveries to a specific Driver and Vehicle.
- **Delivery_Status**: The current lifecycle state of a Delivery (Created, Assigned, In_Transit, Arrived, Completed, Failed, Cancelled).
- **Driver_Status**: The current availability state of a Driver (Offline, Available, On_Delivery, On_Break).

## Requirements

### Requirement 1: Driver Onboarding and Management

**User Story:** As an Administrator, I want to onboard and manage driver accounts, so that only authorized drivers can operate vehicles and receive assignments.

#### Acceptance Criteria

1. WHEN an Administrator submits a new driver record with name, contact details, and license information, THE System SHALL create a Driver account with Driver_Status set to Offline.
2. IF an Administrator submits a new driver record missing a required field, THEN THE System SHALL reject the submission and return a message identifying each missing field.
3. IF an Administrator submits a new driver record with an email address that already exists, THEN THE System SHALL reject the submission and return a duplicate-account message.
4. WHEN an Administrator updates a Driver record, THE System SHALL persist the changes and record the update timestamp.
5. WHEN an Administrator deactivates a Driver, THE System SHALL set the Driver to an inactive state and SHALL prevent that Driver from receiving new Assignments.
6. THE System SHALL allow an Administrator to retrieve a list of all Drivers filtered by Driver_Status.

### Requirement 2: Driver Authentication and Status

**User Story:** As a Driver, I want to sign in and set my availability, so that the dispatch team knows when I can take deliveries.

#### Acceptance Criteria

1. WHEN a Driver submits valid credentials through the Driver_App, THE Auth_Service SHALL authenticate the Driver and issue a session token.
2. IF a Driver submits invalid credentials, THEN THE Auth_Service SHALL reject the request and return an authentication-failed message without revealing which credential was incorrect.
3. WHEN an authenticated Driver sets status to Available, THE System SHALL update the Driver_Status to Available and make the Driver eligible for Assignments.
4. WHEN an authenticated Driver sets status to On_Break or Offline, THE System SHALL update the Driver_Status accordingly and exclude the Driver from new Assignments.
5. WHILE a Driver has an active Assignment in progress, THE System SHALL set the Driver_Status to On_Delivery.
6. WHEN a Driver session token expires, THE Auth_Service SHALL require re-authentication before accepting further requests.

### Requirement 3: Vehicle Registration and Association

**User Story:** As an Administrator, I want to register vehicles and associate them with drivers, so that location data is attributed to the correct asset.

#### Acceptance Criteria

1. WHEN an Administrator registers a Vehicle with identifier, type, and capacity, THE System SHALL create a Vehicle record.
2. IF an Administrator registers a Vehicle with an identifier that already exists, THEN THE System SHALL reject the registration and return a duplicate-identifier message.
3. WHEN an Administrator associates a Vehicle with a Driver, THE System SHALL record the association and the effective timestamp.
4. IF an Administrator attempts to associate a Vehicle that is already associated with another active Driver, THEN THE System SHALL reject the association and return a conflict message.
5. THE System SHALL allow an Administrator to retrieve all Vehicles and their current Driver associations.

### Requirement 4: Location Ping Ingestion at Scale

**User Story:** As a Dispatcher, I want vehicle locations continuously ingested, so that the fleet position data stays current.

#### Acceptance Criteria

1. WHEN the Driver_App transmits a Location_Ping containing a latitude, a longitude, and a timestamp, THE Ingestion_Service SHALL persist the Location_Ping associated with the Vehicle and Driver within 500 milliseconds of acceptance.
2. IF a Location_Ping is missing the latitude, the longitude, or the timestamp, THEN THE Ingestion_Service SHALL reject the Location_Ping, return a validation-error message indicating the missing field, and SHALL NOT persist the Location_Ping.
3. IF a Location_Ping contains a latitude outside the range -90 to 90 or a longitude outside the range -180 to 180, THEN THE Ingestion_Service SHALL reject the Location_Ping, return a validation-error message indicating the out-of-range field, and SHALL NOT persist the Location_Ping.
4. IF a Location_Ping carries a timestamp older than the most recently persisted Location_Ping for the same Vehicle, THEN THE Ingestion_Service SHALL discard the out-of-order Location_Ping and SHALL retain the most recently persisted Location_Ping unchanged.
5. WHERE a Location_Ping includes one or more Telemetry fields, THE Ingestion_Service SHALL persist the included Telemetry fields together with the Location_Ping.
6. WHILE the incoming rate is at or below 5,000 Location_Pings per second across the fleet, THE Ingestion_Service SHALL accept and persist each valid Location_Ping.
7. WHEN the Ingestion_Service accepts a Location_Ping while the incoming rate is at or below 5,000 Location_Pings per second across the fleet, THE Ingestion_Service SHALL acknowledge receipt to the Driver_App within 500 milliseconds.
8. WHILE the Driver_App has no network connectivity, THE Driver_App SHALL queue up to 10,000 Location_Pings locally in chronological order, discarding the oldest queued Location_Ping when the queue is full.
9. WHEN network connectivity is restored, THE Driver_App SHALL transmit the queued Location_Pings to the Ingestion_Service in chronological order within 60 seconds.

### Requirement 5: Live Map Tracking and Path Tracing

**User Story:** As a Dispatcher, I want to see vehicles moving on a live map with their recent paths, so that I can monitor fleet activity in real time.

#### Acceptance Criteria

1. WHEN a Dispatcher opens the live map in the Dispatch_Dashboard, THE System SHALL display the current position of every active Vehicle.
2. WHEN the Ingestion_Service persists a new Location_Ping, THE Streaming_Service SHALL broadcast the updated position to subscribed Dispatch_Dashboard clients within 2 seconds.
3. WHILE a Vehicle is selected on the live map, THE Dispatch_Dashboard SHALL render a Path_Trace connecting the Vehicle's Location_Pings in chronological order.
4. THE Dispatch_Dashboard SHALL render the Path_Trace for at least the most recent 60 minutes of a selected Vehicle's Location_Pings.
5. WHEN a Dispatcher applies a filter by Driver_Status or Zone, THE Dispatch_Dashboard SHALL display only the Vehicles matching the filter.
6. IF the real-time connection to the Streaming_Service is lost, THEN THE Dispatch_Dashboard SHALL display a connection-status indicator and SHALL attempt to reconnect automatically.

### Requirement 6: Zone Definition and Geo-Fencing

**User Story:** As an Administrator, I want to define geographic zones and have the system detect entry and exit, so that operational events trigger automatically.

#### Acceptance Criteria

1. WHEN an Administrator defines a Zone with a name of 1 to 100 characters and a polygon boundary of 3 to 1,000 vertices, THE System SHALL persist the Zone as a geospatial region.
2. IF an Administrator submits a Zone whose polygon is not closed, is self-intersecting, or has fewer than 3 or more than 1,000 vertices, THEN THE System SHALL reject the Zone, return a geometry-validation message, and SHALL NOT persist any part of the Zone.
3. WHEN the Ingestion_Service accepts a Location_Ping that falls inside or on the boundary of a Zone the Vehicle was previously outside, THE Geofence_Engine SHALL generate a Zone_Event of type Enter for that Vehicle and Zone.
4. WHEN the Ingestion_Service accepts a Location_Ping that falls strictly outside a Zone the Vehicle was previously inside, THE Geofence_Engine SHALL generate a Zone_Event of type Exit for that Vehicle and Zone.
5. IF the Ingestion_Service accepts a Location_Ping that does not change the Vehicle's membership relative to a Zone, THEN THE Geofence_Engine SHALL NOT generate a Zone_Event for that Vehicle and Zone.
6. WHEN the Geofence_Engine generates a Zone_Event, THE Streaming_Service SHALL broadcast the Zone_Event to subscribed Dispatch_Dashboard clients within 2 seconds.
7. IF the Streaming_Service does not deliver a Zone_Event within 2 seconds, THEN THE Streaming_Service SHALL retain the Zone_Event and retry delivery up to 3 times.
8. WHERE a Zone is configured with a named arrival label of 1 to 100 characters, THE System SHALL include that label in the Zone_Event payload.

### Requirement 7: Delivery Creation and Lifecycle

**User Story:** As a Dispatcher, I want to create deliveries and track their status, so that I can manage the progress of each shipment.

#### Acceptance Criteria

1. WHEN a Dispatcher creates a Delivery with a destination address of 1 to 255 characters, a recipient name of 1 to 100 characters, a recipient contact of 1 to 50 characters, and a package weight greater than 0 and at most 1,000 kilograms, THE System SHALL create the Delivery with Delivery_Status set to Created.
2. IF a Dispatcher submits a Delivery with a missing or empty required field or a package weight outside the range greater than 0 to 1,000 kilograms, THEN THE System SHALL reject the Delivery, return a validation-error message indicating each invalid field, and SHALL NOT persist the Delivery.
3. IF a Dispatcher creates a Delivery with a destination address that cannot be geocoded to coordinates within 10 seconds, THEN THE System SHALL reject the Delivery, return a geocoding-failure message, and SHALL NOT persist the Delivery.
4. WHEN a Delivery in Delivery_Status Created is assigned to a Driver, THE System SHALL set the Delivery_Status to Assigned.
5. WHEN a Driver begins transit toward the destination of a Delivery in Delivery_Status Assigned, THE System SHALL set the Delivery_Status to In_Transit.
6. WHEN a Driver reports arrival at the destination of a Delivery in Delivery_Status In_Transit, THE System SHALL set the Delivery_Status to Arrived.
7. WHEN a Driver confirms successful handover of a Delivery in Delivery_Status Arrived, THE System SHALL set the Delivery_Status to Completed and record the completion timestamp.
8. IF a Driver reports a failed Delivery with a reason of 1 to 500 characters, THEN THE System SHALL set the Delivery_Status to Failed and record the reason.
9. WHEN a Dispatcher cancels a Delivery whose Delivery_Status is Created, Assigned, In_Transit, or Arrived, THE System SHALL set the Delivery_Status to Cancelled.
10. IF a Dispatcher attempts to cancel a Delivery whose Delivery_Status is Completed, Failed, or Cancelled, THEN THE System SHALL reject the cancellation, return an invalid-transition message, and SHALL retain the current Delivery_Status.
11. IF a requested Delivery_Status transition is not part of the defined lifecycle, THEN THE System SHALL reject the transition, return an invalid-transition message, and SHALL retain the current Delivery_Status.

### Requirement 8: Delivery Assignment to Drivers

**User Story:** As a Dispatcher, I want to assign deliveries to available drivers, so that the right driver carries out each delivery.

#### Acceptance Criteria

1. WHEN a Dispatcher assigns one or more Deliveries to an Available Driver, THE System SHALL create an Assignment linking the Deliveries to the Driver and the Driver's associated Vehicle.
2. IF a Dispatcher attempts to assign a Delivery to a Driver whose Driver_Status is Offline or On_Break, THEN THE System SHALL reject the Assignment and return an unavailable-driver message.
3. IF a Dispatcher attempts to assign a Delivery that is already part of an active Assignment, THEN THE System SHALL reject the Assignment and return an already-assigned message.
4. WHEN an Assignment is created, THE Streaming_Service SHALL notify the assigned Driver_App within 5 seconds.
5. WHEN a Driver accepts an Assignment in the Driver_App, THE System SHALL record the acceptance timestamp.
6. WHEN a Dispatcher reassigns a Delivery from one Driver to another, THE System SHALL remove the Delivery from the original Assignment and add it to the new Assignment.

### Requirement 9: Multi-Delivery Route Optimization

**User Story:** As a Dispatcher, I want the system to optimize the stop order for multiple deliveries, so that drivers travel efficient routes.

#### Acceptance Criteria

1. WHEN an Assignment contains 2 to 50 Deliveries, THE System SHALL request an optimized stop sequence from the Route_Optimizer using the Vehicle's current location as the origin.
2. IF an Assignment contains more than 50 Deliveries, THEN THE System SHALL create a Route using the Deliveries in their assigned order, flag the Route as unoptimized, and return an over-limit message to the Dispatcher.
3. WHEN the Route_Optimizer returns a sequence that includes every Delivery in the Assignment exactly once, THE System SHALL create a Route ordering the Delivery stops according to the returned sequence.
4. IF the Route_Optimizer returns a sequence that omits a Delivery or includes a Delivery not in the Assignment, THEN THE System SHALL discard the returned sequence, create a Route using the Deliveries in their assigned order, and flag the Route as unoptimized.
5. IF the Route_Optimizer fails to return a sequence within 30 seconds, THEN THE System SHALL create a Route using the Deliveries in their assigned order and SHALL flag the Route as unoptimized.
6. WHEN the set of Deliveries in an Assignment changes, THE System SHALL clear the unoptimized flag and request a new optimized sequence from the Route_Optimizer.
7. WHEN a Route is created or updated, THE System SHALL make the ordered Route available to the assigned Driver_App within 5 seconds.
8. WHERE more than one Delivery shares destination coordinates within 25 meters of each other, THE Route_Optimizer SHALL group those Deliveries into a single stop in the Route.

### Requirement 10: Driver Delivery Execution

**User Story:** As a Driver, I want to view my assigned route and update delivery progress, so that dispatch and customers know my status.

#### Acceptance Criteria

1. WHEN a Driver opens an accepted Assignment in the Driver_App, THE Driver_App SHALL display the ordered Route with each Delivery stop and destination.
2. WHEN a Driver selects the next stop, THE Driver_App SHALL display navigation guidance to the Delivery destination.
3. WHEN a Driver marks a stop as started, THE System SHALL set the corresponding Delivery_Status to In_Transit.
4. WHEN a Driver marks a stop as completed, THE System SHALL set the corresponding Delivery_Status to Completed and advance the Route to the next stop.
5. WHILE a Driver has an active Assignment, THE Driver_App SHALL transmit Location_Pings at an interval no greater than 10 seconds.
6. WHEN all stops in a Route reach a terminal Delivery_Status, THE System SHALL mark the Assignment as complete and set the Driver_Status to Available.

### Requirement 11: Customer Delivery Tracking

**User Story:** As a Customer, I want to track my delivery on a map, so that I know when it will arrive.

#### Acceptance Criteria

1. WHEN a Customer opens a tracking link for a Delivery, THE Customer_App SHALL display the current Delivery_Status.
2. WHILE a Delivery is In_Transit, THE Customer_App SHALL display the assigned Vehicle's live position on a map and update it within 5 seconds of each broadcast position change.
3. WHEN a Zone_Event of type Enter is generated for the Vehicle entering the Delivery destination Zone, THE System SHALL notify the Customer that the Driver is arriving.
4. WHEN a Delivery reaches Delivery_Status Completed, THE Customer_App SHALL display a completion confirmation and SHALL stop displaying the live position.
5. THE Customer_App SHALL restrict each tracking link to display only the Delivery associated with that link.
6. IF a Customer opens a tracking link for a Delivery that is Cancelled, THEN THE Customer_App SHALL display a cancellation notice.

### Requirement 12: Dispatch Dashboard Operations

**User Story:** As a Dispatcher, I want a consolidated dashboard, so that I can oversee drivers, deliveries, and fleet status in one place.

#### Acceptance Criteria

1. THE Dispatch_Dashboard SHALL display the count of Drivers grouped by Driver_Status.
2. THE Dispatch_Dashboard SHALL display the count of Deliveries grouped by Delivery_Status.
3. WHEN a Dispatcher selects a Driver, THE Dispatch_Dashboard SHALL display that Driver's active Assignment, Route, and current Vehicle position.
4. WHEN a Zone_Event is broadcast, THE Dispatch_Dashboard SHALL display the Zone_Event in an activity feed within 2 seconds.
5. WHEN a Dispatcher searches for a Delivery by identifier or recipient, THE Dispatch_Dashboard SHALL display the matching Delivery and its current status.

### Requirement 13: Role-Based Access Control

**User Story:** As an Administrator, I want access restricted by role, so that users can only perform actions appropriate to their responsibilities.

#### Acceptance Criteria

1. WHEN a user authenticates, THE Auth_Service SHALL associate the session with the user's assigned role of Administrator, Dispatcher, Driver, or Customer.
2. IF a user requests an action not permitted for the user's role, THEN THE Auth_Service SHALL deny the request and return an authorization-denied response.
3. THE Auth_Service SHALL permit only Administrators to create, update, or deactivate Driver, Vehicle, and Zone records.
4. THE Auth_Service SHALL permit only Administrators and Dispatchers to create Deliveries and Assignments.
5. THE Auth_Service SHALL permit a Driver to access only Assignments and Deliveries linked to that Driver.
6. THE Auth_Service SHALL permit a Customer to access only the Delivery associated with the Customer's tracking link.

### Requirement 14: Real-Time Streaming and Resilience

**User Story:** As a Dispatcher, I want real-time updates that recover from interruptions, so that monitoring remains reliable at scale.

#### Acceptance Criteria

1. WHEN a client subscribes to the Streaming_Service for a set of Vehicles or a Delivery, THE Streaming_Service SHALL deliver subsequent relevant updates to that client.
2. THE Streaming_Service SHALL support at least 1,000 concurrently connected clients receiving live updates.
3. WHEN a client connection to the Streaming_Service drops, THE Streaming_Service SHALL detect the disconnection and release the associated subscription resources.
4. WHEN a disconnected client reconnects, THE Streaming_Service SHALL resume delivering updates for the client's prior subscriptions.
5. IF the Streaming_Service is temporarily unavailable, THEN THE Ingestion_Service SHALL continue to accept and persist Location_Pings.

### Requirement 15: Branded, Modern Frontend Experience

**User Story:** As an Administrator, I want the applications to present a polished, on-brand experience, so that the product looks professional and distinct.

#### Acceptance Criteria

1. THE Dispatch_Dashboard SHALL display the operator-provided logo in the primary navigation area.
2. THE Dispatch_Dashboard, Driver_App, and Customer_App SHALL apply the operator-provided color palette and typography consistently across all screens.
3. WHERE operator-provided hero imagery is supplied, THE Customer_App SHALL display the hero imagery on the landing and tracking entry screens.
4. THE Dispatch_Dashboard SHALL render a responsive layout that remains usable at viewport widths of 1280 pixels and above.
5. WHEN brand assets are not yet provided, THE System SHALL display defined neutral placeholder branding without broken or missing visual elements.
6. THE Customer_App and Driver_App SHALL meet WCAG 2.1 Level AA contrast ratios for text and interactive elements.

### Requirement 16: Historical Data and Reporting

**User Story:** As an Administrator, I want access to historical delivery and tracking data, so that I can review performance and reconstruct past activity.

#### Acceptance Criteria

1. THE System SHALL retain completed and failed Delivery records for at least 365 days.
2. WHEN an Administrator requests a Delivery's history, THE System SHALL return the ordered Delivery_Status transitions with timestamps.
3. WHEN an Administrator requests a Vehicle's historical track for a specified time range, THE System SHALL return the ordered Location_Pings within that range.
4. WHEN an Administrator requests a summary for a date range, THE System SHALL return the counts of Completed, Failed, and Cancelled Deliveries for that range.
