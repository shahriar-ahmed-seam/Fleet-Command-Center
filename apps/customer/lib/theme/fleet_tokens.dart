import 'package:flutter/material.dart';

class FleetColors {
  FleetColors._();
  static const Color bg = Color(0xFF0F1419);
  static const Color surface = Color(0xFF1A2230);
  static const Color surfaceAlt = Color(0xFF232E40);
  static const Color border = Color(0xFF2E3A4E);
  static const Color text = Color(0xFFE8EDF4);
  static const Color textMuted = Color(0xFF9AA7B8);
  static const Color primary = Color(0xFF3B82F6);
  static const Color primaryHover = Color(0xFF2E6FD6);
  static const Color accent = Color(0xFF14B8A6);
  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFEF4444);
  static const Color info = Color(0xFF38BDF8);
}

/// Typography tokens: families, 1.25 type scale, weights, line heights.
class FleetTypography {
  FleetTypography._();
  static const String fontSans = "\"Inter\", system-ui, sans-serif";
  static const String fontMono = "\"JetBrains Mono\", monospace";
  static const Map<String, double> fontSize = {
    'xs': 12.0,
    'sm': 14.0,
    'base': 16.0,
    'lg': 20.0,
    'xl': 25.0,
    '2xl': 31.0,
    '3xl': 39.0,
  };
  static const Map<String, int> fontWeight = {
    'body': 400,
    'medium': 500,
    'semibold': 600,
    'emphasis': 700,
  };
  static const Map<String, double> lineHeight = {
    'body': 1.50,
    'heading': 1.20,
  };
}

/// Spacing scale on a 4px base grid.
class FleetSpacing {
  FleetSpacing._();
  static const Map<String, double> values = {
    '1': 4.0,
    '2': 8.0,
    '3': 12.0,
    '4': 16.0,
    '5': 24.0,
    '6': 32.0,
    '7': 48.0,
    '8': 64.0,
  };
}

/// Border-radius tokens.
class FleetRadius {
  FleetRadius._();
  static const double control = 6.0;
  static const double card = 10.0;
  static const double modal = 16.0;
  static const double pill = 9999.0;
}

/// Elevation/shadow tokens as Flutter BoxShadow lists.
class FleetShadows {
  FleetShadows._();
  static const List<BoxShadow> sm = [BoxShadow(color: Color(0x4D000000), offset: Offset(0, 1), blurRadius: 2)];
  static const List<BoxShadow> md = [BoxShadow(color: Color(0x59000000), offset: Offset(0, 4), blurRadius: 12)];
  static const List<BoxShadow> lg = [BoxShadow(color: Color(0x73000000), offset: Offset(0, 12), blurRadius: 32)];
}

const Map<String, Color> driverStatusColor = {
  'Offline': FleetColors.danger,
  'Available': FleetColors.success,
  'On_Delivery': FleetColors.info,
  'On_Break': FleetColors.warning,
};

const Map<String, Color> deliveryStatusColor = {
  'Created': FleetColors.textMuted,
  'Assigned': FleetColors.accent,
  'In_Transit': FleetColors.info,
  'Arrived': FleetColors.warning,
  'Completed': FleetColors.success,
  'Failed': FleetColors.danger,
  'Cancelled': FleetColors.textMuted,
};

