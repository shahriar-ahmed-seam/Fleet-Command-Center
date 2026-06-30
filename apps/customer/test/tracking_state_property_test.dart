// state.
//
// tracking view shows the current status; when Completed it shows a completion
// state and hides the live position; when Cancelled it shows the cancellation
// state. Runs >= 100 randomized iterations over status sequences.
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:fleet_customer_app/models/tracking.dart';
import 'package:fleet_customer_app/state/tracking_state.dart';

const int _iterations = 200;

TrackingView _seed() => const TrackingView(
      deliveryId: 'DLV-1',
      recipientName: 'Test Recipient',
      destinationAddress: '1 Main St',
      status: DeliveryStatus.created,
    );

void main() {
  test('Property 30: tracking view reflects delivery state', () {
    final rng = Random(98765);
    final statuses = DeliveryStatus.values;

    for (var i = 0; i < _iterations; i++) {
      final state = TrackingState(initial: _seed());

      // Always have a position fed in at some point.
      state.onStatus(DeliveryStatus.inTransit);
      state.onPosition(const TrackPosition(lat: 47.6, lng: -122.3));

      final steps = 1 + rng.nextInt(6);
      var last = DeliveryStatus.inTransit;
      for (var s = 0; s < steps; s++) {
        last = statuses[rng.nextInt(statuses.length)];
        state.onStatus(last);
      }

      final view = state.view!;

      expect(view.status, equals(last));

      if (last.isCompleted) {
        expect(view.position, isNull);
      }

      expect(view.status.isCompleted, equals(last == DeliveryStatus.completed));
      expect(view.status.isCancelled, equals(last == DeliveryStatus.cancelled));

      // 4) Live position only ever surfaces in position-showing states.
      if (view.position != null) {
        expect(view.status.showsLivePosition, isTrue);
      }
    }
  });
}
