import 'package:flutter/material.dart';

import '../models/models.dart';
import '../state/driver_state.dart';
import '../theme/fleet_tokens.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.state});

  final DriverState state;

  // A demo route the driver can accept when none is assigned yet.
  DriverRoute get _demoRoute => const DriverRoute(
        assignmentId: 'ASN-1',
        optimized: true,
        stops: [
          RouteStop(stopIndex: 0, deliveryIds: ['DLV-1001'], lat: 47.6062, lng: -122.3321),
          RouteStop(stopIndex: 1, deliveryIds: ['DLV-1002'], lat: 47.6131, lng: -122.3367),
          RouteStop(stopIndex: 2, deliveryIds: ['DLV-1003'], lat: 47.6175, lng: -122.3289),
        ],
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Fleet Driver · ${state.driverId ?? ''}'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: state.signOut,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _AvailabilityCard(state: state),
          const SizedBox(height: 16),
          if (state.route == null)
            _NoRouteCard(onAccept: () => state.startAssignment(_demoRoute))
          else
            _RouteCard(state: state),
        ],
      ),
    );
  }
}

class _AvailabilityCard extends StatelessWidget {
  const _AvailabilityCard({required this.state});
  final DriverState state;

  @override
  Widget build(BuildContext context) {
    final selectable = [
      DriverStatus.available,
      DriverStatus.onBreak,
      DriverStatus.offline,
    ];
    final color = driverStatusColor[state.status.wire] ?? FleetColors.textMuted;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Text('Status: ${state.status.label}',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 12),
            if (state.status == DriverStatus.onDelivery)
              const Text('On an active delivery — status is managed automatically.',
                  style: TextStyle(color: FleetColors.textMuted, fontSize: 13))
            else
              Wrap(
                spacing: 8,
                children: [
                  for (final s in selectable)
                    ChoiceChip(
                      label: Text(s.label),
                      selected: state.status == s,
                      onSelected: (_) => state.setAvailability(s),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class _NoRouteCard extends StatelessWidget {
  const _NoRouteCard({required this.onAccept});
  final VoidCallback onAccept;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('No active assignment',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            const Text('When dispatch assigns you a route it appears here.',
                style: TextStyle(color: FleetColors.textMuted, fontSize: 13)),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onAccept,
              icon: const Icon(Icons.play_arrow),
              label: const Text('Accept demo route'),
            ),
          ],
        ),
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  const _RouteCard({required this.state});
  final DriverState state;

  @override
  Widget build(BuildContext context) {
    final route = state.route!;
    final active = state.activeStop;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Route ${route.assignmentId}',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(route.optimized ? 'Optimized' : 'Unoptimized',
                    style: const TextStyle(color: FleetColors.textMuted, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 12),
            for (final stop in route.stops) _StopTile(stop: stop, isActive: stop == active),
            const SizedBox(height: 12),
            if (active != null) _StopActions(state: state, stop: active)
            else
              const Text('Route complete 🎉',
                  style: TextStyle(color: FleetColors.success, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

class _StopTile extends StatelessWidget {
  const _StopTile({required this.stop, required this.isActive});
  final RouteStop stop;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    final color = deliveryStatusColor[stop.status.wire] ?? FleetColors.textMuted;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isActive ? FleetColors.surfaceAlt : Colors.transparent,
        borderRadius: BorderRadius.circular(FleetRadius.control),
        border: Border.all(color: isActive ? FleetColors.primary : FleetColors.border),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: FleetColors.surfaceAlt,
            child: Text('${stop.stopIndex + 1}',
                style: const TextStyle(color: FleetColors.text, fontSize: 13)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(stop.deliveryIds.join(', '),
                    style: const TextStyle(fontWeight: FontWeight.w500)),
                Text('${stop.lat.toStringAsFixed(4)}, ${stop.lng.toStringAsFixed(4)}',
                    style: const TextStyle(color: FleetColors.textMuted, fontSize: 12)),
              ],
            ),
          ),
          _StatusPill(label: stop.status.label, color: color),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(FleetRadius.pill),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}

class _StopActions extends StatelessWidget {
  const _StopActions({required this.state, required this.stop});
  final DriverState state;
  final RouteStop stop;

  @override
  Widget build(BuildContext context) {
    final s = stop.status;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        OutlinedButton.icon(
          onPressed: () => _openNavigation(context, stop),
          icon: const Icon(Icons.navigation_outlined),
          label: const Text('Navigate to stop'),
        ),
        const SizedBox(height: 8),
        if (s == DeliveryStatus.assigned)
          FilledButton(onPressed: state.startCurrentStop, child: const Text('Start delivery'))
        else if (s == DeliveryStatus.inTransit)
          FilledButton(onPressed: state.arriveCurrentStop, child: const Text('Mark arrived'))
        else if (s == DeliveryStatus.arrived)
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: state.completeCurrentStop,
                  child: const Text('Complete'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: state.failCurrentStop,
                  child: const Text('Failed'),
                ),
              ),
            ],
          ),
      ],
    );
  }

  void _openNavigation(BuildContext context, RouteStop stop) {
    // A real app launches the platform maps URL; here we surface guidance.
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Navigating to ${stop.lat.toStringAsFixed(4)}, ${stop.lng.toStringAsFixed(4)}')),
    );
  }
}
