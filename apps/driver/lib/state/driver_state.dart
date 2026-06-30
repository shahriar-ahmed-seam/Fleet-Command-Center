//
// Holds the signed-in driver, availability status, the active route, and the
// current stop, and drives the location-ping cadence. While an assignment is
// active the driver transmits a ping at least every [pingInterval] (<=10s,

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/models.dart';
import '../services/ping_queue.dart';
import '../services/ping_transmitter.dart';

const Duration kPingInterval = Duration(seconds: 10);

class DriverState extends ChangeNotifier {
  DriverState({
    PingTransmitter? transmitter,
    this.pingInterval = kPingInterval,
    this.vehicleId = 'VAN-014',
  }) : transmitter = transmitter ??
            PingTransmitter(
              sink: (_) async => true,
              queue: PingQueue(),
              online: true,
            );

  final PingTransmitter transmitter;
  final Duration pingInterval;
  final String vehicleId;

  String? _driverId;
  String? get driverId => _driverId;
  bool get isSignedIn => _driverId != null;

  DriverStatus _status = DriverStatus.offline;
  DriverStatus get status => _status;

  DriverRoute? _route;
  DriverRoute? get route => _route;

  int _currentStop = 0;
  int get currentStop => _currentStop;

  // Simulated current position (a real app sources this from device GPS).
  double _lat = 47.6062;
  double _lng = -122.3321;
  double get lat => _lat;
  double get lng => _lng;

  Timer? _pingTimer;

  /// here we accept any non-empty pair and move the driver to Available.
  Future<bool> signIn(String email, String password) async {
    if (email.trim().isEmpty || password.isEmpty) return false;
    _driverId = email.trim();
    _status = DriverStatus.available;
    notifyListeners();
    return true;
  }

  void signOut() {
    _stopPinging();
    _driverId = null;
    _status = DriverStatus.offline;
    _route = null;
    _currentStop = 0;
    notifyListeners();
  }

  /// system-driven and not selectable here.
  void setAvailability(DriverStatus next) {
    if (next == DriverStatus.onDelivery) return;
    _status = next;
    if (next != DriverStatus.available) {
      // Leaving availability also pauses an active route's pinging.
      _stopPinging();
    }
    notifyListeners();
  }

  void startAssignment(DriverRoute route) {
    _route = route;
    _currentStop = 0;
    _status = DriverStatus.onDelivery;
    _startPinging();
    notifyListeners();
  }

  RouteStop? get activeStop =>
      _route != null && _currentStop < _route!.stops.length
          ? _route!.stops[_currentStop]
          : null;

  void startCurrentStop() => _setStopStatus(DeliveryStatus.inTransit);

  void arriveCurrentStop() => _setStopStatus(DeliveryStatus.arrived);

  /// Mark the current stop completed → delivery Completed, advance the route
  void completeCurrentStop() {
    _setStopStatus(DeliveryStatus.completed);
    _advance();
  }

  void failCurrentStop() {
    _setStopStatus(DeliveryStatus.failed);
    _advance();
  }

  void _advance() {
    if (_route == null) return;
    if (_currentStop < _route!.stops.length) _currentStop++;
    final allTerminal = _route!.stops.every((s) => s.status.isTerminal);
    if (allTerminal) {
      _status = DriverStatus.available;
      _stopPinging();
    }
    notifyListeners();
  }

  void _setStopStatus(DeliveryStatus status) {
    final r = _route;
    if (r == null || _currentStop >= r.stops.length) return;
    final stops = List<RouteStop>.from(r.stops);
    stops[_currentStop] = stops[_currentStop].copyWith(status: status);
    _route = DriverRoute(
      assignmentId: r.assignmentId,
      stops: stops,
      optimized: r.optimized,
    );
    notifyListeners();
  }

  void _startPinging() {
    _stopPinging();
    _emitPing(); // immediate first ping
    _pingTimer = Timer.periodic(pingInterval, (_) => _emitPing());
  }

  void _stopPinging() {
    _pingTimer?.cancel();
    _pingTimer = null;
  }

  void _emitPing() {
    // Nudge the simulated position so the dashboard trace moves.
    _lat += 0.0004;
    _lng += 0.0005;
    transmitter.submit(LocationPing(
      vehicleId: vehicleId,
      lat: _lat,
      lng: _lng,
      timestamp: DateTime.now().millisecondsSinceEpoch,
    ));
  }

  @override
  void dispose() {
    _stopPinging();
    super.dispose();
  }
}
