import { tokens, colors } from './tokens.js';
import { statusColors } from './status.js';

/** '#RRGGBB' → Dart `Color(0xFFRRGGBB)`. */
function dartColor(hex: string): string {
  const rgb = hex.replace('#', '').toUpperCase();
  return `Color(0xFF${rgb})`;
}

/** Lower-camelCase a Pascal_Snake status key for a Dart identifier/map key. */
function statusKey(status: string): string {
  return status; // keep wire value as the map key for direct lookup
}

function dartShadow(s: { x: number; y: number; blur: number; color: string; alpha: number }): string {
  const rgb = s.color.replace('#', '').toUpperCase();
  const alphaHex = Math.round(s.alpha * 255)
    .toString(16)
    .toUpperCase()
    .padStart(2, '0');
  return (
    `BoxShadow(color: Color(0x${alphaHex}${rgb}), ` +
    `offset: Offset(${s.x}, ${s.y}), blurRadius: ${s.blur})`
  );
}

export function toDart(): string {
  const L: string[] = [];
  L.push('// AUTO-GENERATED from @fleet/design-tokens. Do not edit by hand.');
  L.push("import 'package:flutter/material.dart';");
  L.push('');

  // Colors
  L.push('/// Semantic color tokens.');
  L.push('class FleetColors {');
  L.push('  FleetColors._();');
  for (const [name, value] of Object.entries(tokens.colors)) {
    L.push(`  static const Color ${name} = ${dartColor(value)};`);
  }
  L.push('}');
  L.push('');

  // Typography
  L.push('/// Typography tokens: families, 1.25 type scale, weights, line heights.');
  L.push('class FleetTypography {');
  L.push('  FleetTypography._();');
  L.push(`  static const String fontSans = ${JSON.stringify(tokens.typography.fontSans)};`);
  L.push(`  static const String fontMono = ${JSON.stringify(tokens.typography.fontMono)};`);
  L.push('  static const Map<String, double> fontSize = {');
  for (const [name, value] of Object.entries(tokens.typography.fontSize)) {
    L.push(`    '${name}': ${value.toFixed(1)},`);
  }
  L.push('  };');
  L.push('  static const Map<String, int> fontWeight = {');
  for (const [name, value] of Object.entries(tokens.typography.fontWeight)) {
    L.push(`    '${name}': ${value},`);
  }
  L.push('  };');
  L.push('  static const Map<String, double> lineHeight = {');
  for (const [name, value] of Object.entries(tokens.typography.lineHeight)) {
    L.push(`    '${name}': ${value.toFixed(2)},`);
  }
  L.push('  };');
  L.push('}');
  L.push('');

  // Spacing
  L.push('/// Spacing scale on a 4px base grid.');
  L.push('class FleetSpacing {');
  L.push('  FleetSpacing._();');
  L.push('  static const Map<String, double> values = {');
  for (const [name, value] of Object.entries(tokens.spacing)) {
    L.push(`    '${name}': ${value.toFixed(1)},`);
  }
  L.push('  };');
  L.push('}');
  L.push('');

  // Radius
  L.push('/// Border-radius tokens.');
  L.push('class FleetRadius {');
  L.push('  FleetRadius._();');
  for (const [name, value] of Object.entries(tokens.radius)) {
    L.push(`  static const double ${name} = ${value.toFixed(1)};`);
  }
  L.push('}');
  L.push('');

  // Shadows
  L.push('/// Elevation/shadow tokens as Flutter BoxShadow lists.');
  L.push('class FleetShadows {');
  L.push('  FleetShadows._();');
  for (const [name, value] of Object.entries(tokens.shadows)) {
    L.push(`  static const List<BoxShadow> ${name} = [${dartShadow(value)}];`);
  }
  L.push('}');
  L.push('');

  // Status colors → resolved Color via FleetColors
  L.push('/// Driver_Status → color (mirrors web --status-driver-*).');
  L.push('const Map<String, Color> driverStatusColor = {');
  for (const [status, token] of Object.entries(statusColors.driver)) {
    L.push(`  '${statusKey(status)}': FleetColors.${token},`);
  }
  L.push('};');
  L.push('');
  L.push('/// Delivery_Status → color (mirrors web --status-delivery-*).');
  L.push('const Map<String, Color> deliveryStatusColor = {');
  for (const [status, token] of Object.entries(statusColors.delivery)) {
    L.push(`  '${statusKey(status)}': FleetColors.${token},`);
  }
  L.push('};');
  L.push('');

  // Reference colors object so generators stay aligned if tokens change shape.
  void colors;
  return L.join('\n');
}
