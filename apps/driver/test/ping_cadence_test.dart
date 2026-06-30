//
// transmits a ping at least every 10 seconds; an offline queue flush completes
// well within the 60-second budget.
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fleet_driver_app/models/models.dart';
import 'package:fleet_driver_app/services/ping_queue.dart';
import 'package:fleet_driver_app/services/ping_transmitter.dart';
import 'package:fleet_driver_app/state/driver_state.dart';

void main() {
  test('active assignment transmits pings at <= 10s cadence', () {
    fakeAsync((async) {
      final sent = <LocationPing>[];
      final transmitter = PingTransmitter(
        sink: (p) async {
          sent.add(p);
          return true;
        },
        online: true,
      );
      final state = DriverState(transmitter: transmitter);
      // Avoid awaits inside fakeAsync; signIn resolves synchronously enough.
      state.signIn('driver@example.com', 'pw');

      const route = DriverRoute(
        assignmentId: 'ASN-1',
        optimized: true,
        stops: [
          RouteStop(stopIndex: 0, deliveryIds: ['D1'], lat: 47.6, lng: -122.3),
        ],
      );
      state.startAssignment(route); // emits an immediate ping + starts timer

      async.elapse(const Duration(seconds: 30));

      // Initial ping + one every 10s over 30s => at least 4 pings.
      expect(sent.length, greaterThanOrEqualTo(4));
      // The configured cadence ceiling is <= 10 seconds.
      expect(state.pingInterval.inSeconds, lessThanOrEqualTo(10));

      state.dispose();
    });
  });

  test('offline flush drains a full queue well within 60s', () async {
    final sent = <LocationPing>[];
    final transmitter = PingTransmitter(
      sink: (p) async {
        sent.add(p);
        return true;
      },
      online: false,
    );

    // Fill the queue to capacity while offline.
    for (var i = 0; i < kMaxOfflinePings; i++) {
      await transmitter.submit(
        LocationPing(vehicleId: 'V', lat: 47.6, lng: -122.3, timestamp: i),
      );
    }
    expect(transmitter.queuedCount, kMaxOfflinePings);

    final sw = Stopwatch()..start();
    await transmitter.setOnline(true); // triggers flush in chronological order
    sw.stop();

    expect(transmitter.queuedCount, 0);
    expect(sent.length, kMaxOfflinePings);
    // Chronological order preserved on flush.
    for (var i = 1; i < sent.length; i++) {
      expect(sent[i].timestamp, greaterThanOrEqualTo(sent[i - 1].timestamp));
    }
    expect(sw.elapsed, lessThan(const Duration(seconds: 60)));
  });
}
