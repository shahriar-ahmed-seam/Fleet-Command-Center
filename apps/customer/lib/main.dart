//
// Resolves a tracking link to a single delivery and renders the live tracking
// view (status, live position while In_Transit, arrival notice, and
// completion/cancellation states), themed from the shared Fleet design tokens.
import 'package:flutter/material.dart';

import 'models/tracking.dart';
import 'screens/tracking_screen.dart';
import 'state/tracking_state.dart';
import 'theme/app_theme.dart';

void main() {
  final state = TrackingState();
  // In a real deployment the link token comes from the deep link / URL; here we
  // resolve a demo delivery so the app renders meaningfully.
  state.resolveLink('demo-token', _demoResolver);
  runApp(CustomerApp(state: state));
}

Future<TrackingView?> _demoResolver(String token) async {
  await Future<void>.delayed(const Duration(milliseconds: 300));
  return const TrackingView(
    deliveryId: 'DLV-1001',
    recipientName: 'Grace Holloway',
    destinationAddress: '1201 3rd Ave, Seattle, WA',
    status: DeliveryStatus.inTransit,
    position: TrackPosition(lat: 47.6062, lng: -122.3321),
  );
}

class CustomerApp extends StatelessWidget {
  const CustomerApp({super.key, required this.state});

  final TrackingState state;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Fleet Tracking',
      debugShowCheckedModeBanner: false,
      theme: buildCustomerTheme(),
      home: TrackingScreen(state: state),
    );
  }
}
