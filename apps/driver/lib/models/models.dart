// Core domain models for the Driver App.
//
// the location ping payload, and route stops) so the app reads consistently
// with the backend.

enum DriverStatus { offline, available, onDelivery, onBreak }

extension DriverStatusWire on DriverStatus {
  /// The wire value used by the backend (e.g. "On_Delivery").
  String get wire => switch (this) {
        DriverStatus.offline => 'Offline',
        DriverStatus.available => 'Available',
        DriverStatus.onDelivery => 'On_Delivery',
        DriverStatus.onBreak => 'On_Break',
      };

  String get label => switch (this) {
        DriverStatus.offline => 'Offline',
        DriverStatus.available => 'Available',
        DriverStatus.onDelivery => 'On delivery',
        DriverStatus.onBreak => 'On break',
      };
}

enum DeliveryStatus {
  created,
  assigned,
  inTransit,
  arrived,
  completed,
  failed,
  cancelled,
}

extension DeliveryStatusWire on DeliveryStatus {
  String get wire => switch (this) {
        DeliveryStatus.created => 'Created',
        DeliveryStatus.assigned => 'Assigned',
        DeliveryStatus.inTransit => 'In_Transit',
        DeliveryStatus.arrived => 'Arrived',
        DeliveryStatus.completed => 'Completed',
        DeliveryStatus.failed => 'Failed',
        DeliveryStatus.cancelled => 'Cancelled',
      };

  String get label => wire.replaceAll('_', ' ');

  bool get isTerminal =>
      this == DeliveryStatus.completed ||
      this == DeliveryStatus.failed ||
      this == DeliveryStatus.cancelled;
}

/// A timestamped location ping produced by the device (contracts PingPayload).
class LocationPing {
  const LocationPing({
    required this.vehicleId,
    required this.lat,
    required this.lng,
    required this.timestamp,
    this.speed,
    this.heading,
    this.battery,
  });

  final String vehicleId;
  final double lat;
  final double lng;

  /// Event time in epoch milliseconds.
  final int timestamp;
  final double? speed;
  final double? heading;
  final double? battery;

  Map<String, dynamic> toJson() => {
        'vehicleId': vehicleId,
        'lat': lat,
        'lng': lng,
        'timestamp': timestamp,
        if (speed != null) 'speed': speed,
        if (heading != null) 'heading': heading,
        if (battery != null) 'battery': battery,
      };
}

/// A single stop on the driver's route. A stop may group several co-located
class RouteStop {
  const RouteStop({
    required this.stopIndex,
    required this.deliveryIds,
    required this.lat,
    required this.lng,
    this.status = DeliveryStatus.assigned,
  });

  final int stopIndex;
  final List<String> deliveryIds;
  final double lat;
  final double lng;
  final DeliveryStatus status;

  RouteStop copyWith({DeliveryStatus? status}) => RouteStop(
        stopIndex: stopIndex,
        deliveryIds: deliveryIds,
        lat: lat,
        lng: lng,
        status: status ?? this.status,
      );
}

/// The ordered route delivered to the Driver App for an accepted assignment.
class DriverRoute {
  const DriverRoute({
    required this.assignmentId,
    required this.stops,
    required this.optimized,
  });

  final String assignmentId;
  final List<RouteStop> stops;
  final bool optimized;
}
