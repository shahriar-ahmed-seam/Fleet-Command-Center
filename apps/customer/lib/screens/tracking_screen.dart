import 'package:flutter/material.dart';

import '../models/tracking.dart';
import '../state/tracking_state.dart';
import '../theme/fleet_tokens.dart';
import '../widgets/brand_hero.dart';

class TrackingScreen extends StatelessWidget {
  const TrackingScreen({super.key, required this.state, this.heroImageUrl});

  final TrackingState state;
  final String? heroImageUrl;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ListenableBuilder(
        listenable: state,
        builder: (context, _) {
          return ListView(
            children: [
              BrandHero(imageUrl: heroImageUrl),
              Padding(
                padding: const EdgeInsets.all(20),
                child: _body(context),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _body(BuildContext context) {
    if (state.loading) {
      return const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()));
    }
    if (state.error != null) {
      return _Notice(
        icon: Icons.link_off,
        color: FleetColors.danger,
        title: 'Link not available',
        message: state.error!,
      );
    }
    final v = state.view;
    if (v == null) {
      return const _Notice(
        icon: Icons.local_shipping_outlined,
        color: FleetColors.textMuted,
        title: 'No delivery',
        message: 'Open a tracking link to follow your delivery.',
      );
    }

    if (v.status.isCancelled) {
      return _Notice(
        icon: Icons.cancel_outlined,
        color: FleetColors.textMuted,
        title: 'Delivery cancelled',
        message: 'Delivery ${v.deliveryId} has been cancelled.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _StatusHeader(view: v),
        const SizedBox(height: 16),
        if (v.arriving && !v.status.isCompleted) ...[
          _Banner(
            color: FleetColors.warning,
            icon: Icons.notifications_active_outlined,
            text: 'Your driver is arriving now.',
          ),
          const SizedBox(height: 16),
        ],
        if (v.status.isCompleted)
          _Notice(
            icon: Icons.check_circle_outline,
            color: FleetColors.success,
            title: 'Delivered',
            message: 'Delivery ${v.deliveryId} was completed. Thank you!',
          )
        else if (v.status.showsLivePosition && v.position != null)
          _LivePositionCard(position: v.position!)
        else
          _Notice(
            icon: Icons.schedule,
            color: FleetColors.info,
            title: 'Preparing your delivery',
            message: 'Live tracking starts once your driver is on the way.',
          ),
        const SizedBox(height: 16),
        _DetailCard(view: v),
      ],
    );
  }
}

class _StatusHeader extends StatelessWidget {
  const _StatusHeader({required this.view});
  final TrackingView view;

  @override
  Widget build(BuildContext context) {
    final color = deliveryStatusColor[view.status.wire] ?? FleetColors.textMuted;
    return Row(
      children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 10),
        Text(view.status.label,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: color)),
      ],
    );
  }
}

class _LivePositionCard extends StatelessWidget {
  const _LivePositionCard({required this.position});
  final TrackPosition position;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.my_location, size: 18, color: FleetColors.info),
                SizedBox(width: 8),
                Text('Driver location', style: TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              height: 140,
              decoration: BoxDecoration(
                color: FleetColors.surfaceAlt,
                borderRadius: BorderRadius.circular(FleetRadius.control),
                border: Border.all(color: FleetColors.border),
              ),
              alignment: Alignment.center,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.location_on, color: FleetColors.primary, size: 32),
                  const SizedBox(height: 6),
                  Text('${position.lat.toStringAsFixed(5)}, ${position.lng.toStringAsFixed(5)}',
                      style: const TextStyle(color: FleetColors.textMuted, fontSize: 13)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailCard extends StatelessWidget {
  const _DetailCard({required this.view});
  final TrackingView view;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _row('Delivery', view.deliveryId),
            const SizedBox(height: 8),
            _row('Recipient', view.recipientName),
            const SizedBox(height: 8),
            _row('Destination', view.destinationAddress),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(label, style: const TextStyle(color: FleetColors.textMuted, fontSize: 13)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 14))),
        ],
      );
}

class _Banner extends StatelessWidget {
  const _Banner({required this.color, required this.icon, required this.text});
  final Color color;
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(FleetRadius.control),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({
    required this.icon,
    required this.color,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final Color color;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(icon, color: color, size: 40),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: FleetColors.textMuted, fontSize: 14)),
          ],
        ),
      ),
    );
  }
}
