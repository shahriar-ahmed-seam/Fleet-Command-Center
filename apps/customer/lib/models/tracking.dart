// Customer tracking domain models.
//
// shape so the customer view reads consistently with the backend.

enum DeliveryStatus {
  created,
  assigned,
  inTransit,
  arrived,
  completed,
  failed,
  cancelled,
}

extension DeliveryStatusX on DeliveryStatus {
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

  bool get showsLivePosition =>
      this == DeliveryStatus.inTransit || this == DeliveryStatus.arrived;

  bool get isCompleted => this == DeliveryStatus.completed;
  bool get isCancelled => this == DeliveryStatus.cancelled;
}

/// A live vehicle position for the tracked delivery.
class TrackPosition {
  const TrackPosition({required this.lat, required this.lng, this.timestamp});
  final double lat;
  final double lng;
  final int? timestamp;
}

/// link resolves to exactly one delivery).
class TrackingView {
  const TrackingView({
    required this.deliveryId,
    required this.recipientName,
    required this.destinationAddress,
    required this.status,
    this.position,
    this.arriving = false,
  });

  final String deliveryId;
  final String recipientName;
  final String destinationAddress;
  final DeliveryStatus status;
  final TrackPosition? position;

  final bool arriving;

  TrackingView copyWith({
    DeliveryStatus? status,
    TrackPosition? position,
    bool? arriving,
  }) =>
      TrackingView(
        deliveryId: deliveryId,
        recipientName: recipientName,
        destinationAddress: destinationAddress,
        status: status ?? this.status,
        position: position ?? this.position,
        arriving: arriving ?? this.arriving,
      );
}
