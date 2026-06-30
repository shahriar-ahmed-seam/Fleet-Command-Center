//
// While the device has no connectivity, location pings are buffered locally so
// none are lost. The queue is bounded to [maxSize] (10,000): when full, the
// oldest queued ping is dropped so the most recent pings are retained. On
// flush, queued pings are drained in chronological order (by event timestamp)
// for transmission to the Ingestion_Service.
//
// chronological) and is intentionally free of any I/O.

import '../models/models.dart';

const int kMaxOfflinePings = 10000;

/// A bounded, chronological offline buffer for location pings.
class PingQueue {
  PingQueue({this.maxSize = kMaxOfflinePings})
      : assert(maxSize > 0, 'maxSize must be positive');

  final int maxSize;
  final List<LocationPing> _pings = <LocationPing>[];

  /// Number of pings currently buffered.
  int get length => _pings.length;

  bool get isEmpty => _pings.isEmpty;
  bool get isNotEmpty => _pings.isNotEmpty;

  /// A read-only snapshot of the buffered pings, in insertion order.
  List<LocationPing> get pings => List.unmodifiable(_pings);

  /// Buffer a ping. When the queue is full, the oldest queued ping is dropped
  /// so the buffer never exceeds [maxSize] and keeps the most recent pings
  void enqueue(LocationPing ping) {
    _pings.add(ping);
    if (_pings.length > maxSize) {
      _pings.removeAt(0); // drop the oldest
    }
  }

  /// Buffer several pings, preserving the bound after each insertion.
  void enqueueAll(Iterable<LocationPing> pings) {
    for (final p in pings) {
      enqueue(p);
    }
  }

  /// Drain the queue, returning all buffered pings sorted into chronological
  /// keeps equal-timestamp pings in insertion order.
  List<LocationPing> drainInOrder() {
    final drained = List<LocationPing>.from(_pings);
    drained.sort((a, b) => a.timestamp.compareTo(b.timestamp));
    _pings.clear();
    return drained;
  }

  /// Remove all buffered pings without returning them.
  void clear() => _pings.clear();
}
