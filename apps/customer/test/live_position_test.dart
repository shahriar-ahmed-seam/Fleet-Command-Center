//
// position update is reflected in the tracking view immediately (well within
// the 5-second budget), and is suppressed once the delivery completes.
import 'package:flutter_test/flutter_test.dart';
import 'package:fleet_customer_app/models/tracking.dart';
import 'package:fleet_customer_app/state/tracking_state.dart';

TrackingView _view(DeliveryStatus status) => TrackingView(
      deliveryId: 'DLV-1',
      recipientName: 'Grace',
      destinationAddress: '1 Main St',
      status: status,
    );

void main() {
  test('In_Transit delivery reflects streamed position updates', () {
    final state = TrackingState(initial: _view(DeliveryStatus.inTransit));

    final sw = Stopwatch()..start();
    state.onPosition(const TrackPosition(lat: 47.6062, lng: -122.3321));
    sw.stop();

    expect(state.view!.position, isNotNull);
    expect(state.view!.position!.lat, closeTo(47.6062, 1e-9));
    expect(sw.elapsed, lessThan(const Duration(seconds: 5)));

    // A subsequent update replaces the position.
    state.onPosition(const TrackPosition(lat: 47.61, lng: -122.34));
    expect(state.view!.position!.lng, closeTo(-122.34, 1e-9));
  });

  test('position is suppressed once the delivery is completed', () {
    final state = TrackingState(initial: _view(DeliveryStatus.inTransit));
    state.onPosition(const TrackPosition(lat: 47.6, lng: -122.3));
    expect(state.view!.position, isNotNull);

    state.onStatus(DeliveryStatus.completed);
    expect(state.view!.status, DeliveryStatus.completed);
    expect(state.view!.position, isNull);

    // Further position updates are ignored after completion.
    state.onPosition(const TrackPosition(lat: 47.7, lng: -122.4));
    expect(state.view!.position, isNull);
  });
}
