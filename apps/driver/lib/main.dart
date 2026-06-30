// Fleet Command Center — Driver App entry point (tasks 19.1, 19.2).
//
// Wires the driver state (auth, availability, active route, ping cadence, and
// the offline ping queue) to the sign-in and home screens, themed from the
// shared Fleet design tokens.
import 'package:flutter/material.dart';

import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'state/driver_state.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(DriverApp(state: DriverState()));
}

class DriverApp extends StatelessWidget {
  const DriverApp({super.key, required this.state});

  final DriverState state;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Fleet Driver',
      debugShowCheckedModeBanner: false,
      theme: buildDriverTheme(),
      home: ListenableBuilder(
        listenable: state,
        builder: (context, _) =>
            state.isSignedIn ? HomeScreen(state: state) : LoginScreen(state: state),
      ),
    );
  }
}
