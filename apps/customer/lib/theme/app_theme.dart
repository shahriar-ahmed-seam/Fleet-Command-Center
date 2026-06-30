import 'package:flutter/material.dart';

import 'fleet_tokens.dart';

/// A dark, on-brand [ThemeData] derived from the Fleet design tokens.
ThemeData buildCustomerTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: FleetColors.bg,
    colorScheme: base.colorScheme.copyWith(
      primary: FleetColors.primary,
      secondary: FleetColors.accent,
      surface: FleetColors.surface,
      error: FleetColors.danger,
      onPrimary: FleetColors.bg,
      onSurface: FleetColors.text,
    ),
    cardTheme: CardThemeData(
      color: FleetColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(FleetRadius.card),
        side: const BorderSide(color: FleetColors.border),
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: FleetColors.surface,
      foregroundColor: FleetColors.text,
      elevation: 0,
      centerTitle: false,
    ),
    textTheme: base.textTheme.apply(
      bodyColor: FleetColors.text,
      displayColor: FleetColors.text,
    ),
  );
}
