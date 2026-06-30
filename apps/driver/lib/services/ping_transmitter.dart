//
// Routes outgoing location pings: when online, a ping is sent immediately via
// the injected [PingSink]; when offline, it is buffered in the [PingQueue].
// On reconnect, the buffered pings are flushed in chronological order. The
// transmitter is transport-agnostic so it can be exercised without a network.

import '../models/models.dart';
import 'ping_queue.dart';

/// Sends a ping to the Ingestion_Service. Returns true on a successful send.
typedef PingSink = Future<bool> Function(LocationPing ping);

/// Routes pings to the network when online and buffers them when offline.
class PingTransmitter {
  PingTransmitter({
    required PingSink sink,
    PingQueue? queue,
    bool online = false,
  })  : _sink = sink,
        _queue = queue ?? PingQueue(),
        _online = online;

  final PingSink _sink;
  final PingQueue _queue;
  bool _online;

  bool get isOnline => _online;
  int get queuedCount => _queue.length;

  /// Submit a ping. Sends immediately when online (buffering on send failure),
  /// otherwise buffers it for later flush.
  Future<void> submit(LocationPing ping) async {
    if (!_online) {
      _queue.enqueue(ping);
      return;
    }
    final ok = await _sink(ping);
    if (!ok) {
      _queue.enqueue(ping);
    }
  }

  /// Update connectivity. Transitioning to online flushes the buffer in
  Future<void> setOnline(bool online) async {
    final wasOffline = !_online;
    _online = online;
    if (online && wasOffline) {
      await flush();
    }
  }

  /// Flush the buffered pings to the sink in chronological order. Any ping that
  /// fails to send is re-buffered so it is retried on the next flush.
  Future<void> flush() async {
    if (_queue.isEmpty) return;
    final pending = _queue.drainInOrder();
    final failed = <LocationPing>[];
    for (final ping in pending) {
      final ok = await _sink(ping);
      if (!ok) failed.add(ping);
    }
    if (failed.isNotEmpty) {
      _queue.enqueueAll(failed);
    }
  }
}
