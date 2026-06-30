//
// Resolves a tracking link to a single delivery and keeps the view current
// from streamed status, position, and arrival updates. Live position is only

import 'package:flutter/foundation.dart';

import '../models/tracking.dart';

class TrackingState extends ChangeNotifier {
  TrackingState({TrackingView? initial}) : _view = initial;

  TrackingView? _view;
  TrackingView? get view => _view;

  bool _loading = false;
  bool get loading => _loading;

  String? _error;
  String? get error => _error;

  /// [resolver] performs the lookup (REST in a real app); a null result means
  /// the link is invalid.
  Future<void> resolveLink(
    String linkToken,
    Future<TrackingView?> Function(String token) resolver,
  ) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final resolved = await resolver(linkToken);
      if (resolved == null) {
        _error = 'This tracking link is not valid.';
      } else {
        _view = resolved;
      }
    } catch (_) {
      _error = 'Unable to load tracking details.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Apply a streamed delivery status change. Live position is retained only
  /// while the status shows it; entering any non-showing state (including
  /// stale location.
  void onStatus(DeliveryStatus status) {
    final v = _view;
    if (v == null) return;
    _view = TrackingView(
      deliveryId: v.deliveryId,
      recipientName: v.recipientName,
      destinationAddress: v.destinationAddress,
      status: status,
      position: status.showsLivePosition ? v.position : null,
      arriving: v.arriving,
    );
    notifyListeners();
  }

  /// Apply a streamed live position. Ignored unless the delivery is in a state
  void onPosition(TrackPosition position) {
    final v = _view;
    if (v == null || !v.status.showsLivePosition) return;
    _view = v.copyWith(position: position);
    notifyListeners();
  }

  void onArriving() {
    final v = _view;
    if (v == null) return;
    _view = v.copyWith(arriving: true);
    notifyListeners();
  }
}
