// and chronological.
//
// the queue holds at most maxSize pings, retains the most recent maxSize in
// chronological order (dropping the oldest when full), and on flush transmits
// the queued pings in chronological order. Runs >= 100 randomized iterations.
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:fleet_driver_app/models/models.dart';
import 'package:fleet_driver_app/services/ping_queue.dart';

const int _iterations = 200;

LocationPing _ping(int ts) =>
    LocationPing(vehicleId: 'V', lat: 47.6, lng: -122.3, timestamp: ts);

void main() {
  test('Property 13: offline queue is bounded and chronological', () {
    final rng = Random(1357);

    for (var i = 0; i < _iterations; i++) {
      // Small cap so the bound is exercised frequently.
      final cap = 1 + rng.nextInt(50);
      final count = rng.nextInt(300);
      final queue = PingQueue(maxSize: cap);

      // Insertion order with arbitrary (possibly out-of-order) timestamps.
      final inserted = <LocationPing>[];
      for (var k = 0; k < count; k++) {
        final p = _ping(rng.nextInt(100000));
        inserted.add(p);
        queue.enqueue(p);
      }

      // 1) Never exceeds the bound.
      expect(queue.length, lessThanOrEqualTo(cap));
      expect(queue.length, equals(min(count, cap)));

      // 2) Retains the most recent `cap` by insertion (oldest dropped).
      final expectedRetained = inserted.length <= cap
          ? inserted
          : inserted.sublist(inserted.length - cap);
      expect(
        queue.pings.map((p) => p.timestamp).toList(),
        equals(expectedRetained.map((p) => p.timestamp).toList()),
      );

      // 3) Flush drains everything in chronological order.
      final drained = queue.drainInOrder();
      expect(queue.isEmpty, isTrue);
      for (var k = 1; k < drained.length; k++) {
        expect(drained[k].timestamp,
            greaterThanOrEqualTo(drained[k - 1].timestamp));
      }
      // Flush returns exactly the retained set.
      expect(drained.length, equals(expectedRetained.length));
    }
  });
}
