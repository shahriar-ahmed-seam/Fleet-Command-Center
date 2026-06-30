//
// Displays operator-provided hero imagery when supplied; otherwise renders a
// tokened gradient placeholder so the hero slot is never broken.
import 'package:flutter/material.dart';

import '../theme/fleet_tokens.dart';

class BrandHero extends StatelessWidget {
  const BrandHero({super.key, this.imageUrl, this.title = 'Track your delivery'});

  /// Operator-provided hero image; when null a gradient placeholder is shown.
  final String? imageUrl;
  final String title;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 160,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (imageUrl != null && imageUrl!.isNotEmpty)
            Image.network(
              imageUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const _GradientPlaceholder(),
            )
          else
            const _GradientPlaceholder(),
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, FleetColors.bg],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Align(
              alignment: Alignment.bottomLeft,
              child: Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: FleetColors.primary,
                      borderRadius: BorderRadius.circular(FleetRadius.control),
                    ),
                    alignment: Alignment.center,
                    child: const Text('F',
                        style: TextStyle(
                            color: FleetColors.bg, fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(width: 10),
                  Text(title,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GradientPlaceholder extends StatelessWidget {
  const _GradientPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [FleetColors.primary, FleetColors.accent],
        ),
      ),
    );
  }
}
