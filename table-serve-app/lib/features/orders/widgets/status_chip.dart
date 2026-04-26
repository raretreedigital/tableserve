import 'package:flutter/material.dart';
import '../../../core/theme.dart';

class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip({super.key, required this.status});

  String get _label => switch (status) {
        'pending'   => 'Pending',
        'confirmed' => 'Confirmed',
        'preparing' => 'Preparing',
        'ready'     => 'Ready',
        'served'    => 'Served',
        'cancelled' => 'Cancelled',
        _           => status,
      };

  @override
  Widget build(BuildContext context) {
    final color = AppTheme.statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withAlpha(25),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(80)),
      ),
      child: Text(
        _label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
