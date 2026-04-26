import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/orders_provider.dart';
import '../../models/order_model.dart';
import 'widgets/status_chip.dart';

class OrderDetailPage extends ConsumerWidget {
  final String orderId;
  const OrderDetailPage({super.key, required this.orderId});

  static const _nextStatus = {
    'pending':   'confirmed',
    'confirmed': 'preparing',
    'preparing': 'ready',
    'ready':     'served',
  };

  static const _nextLabel = {
    'pending':   'Confirm Order',
    'confirmed': 'Start Preparing',
    'preparing': 'Mark Ready',
    'ready':     'Mark Served',
  };


  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(orderDetailProvider(orderId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Order Details'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(orderDetailProvider(orderId)),
          ),
        ],
      ),
      body: orderAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (order) => _Body(order: order, orderId: orderId),
      ),
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  final OrderModel order;
  final String orderId;
  const _Body({required this.order, required this.orderId});

  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  bool _updating = false;

  String _fmt(double v) => '\$${v.toStringAsFixed(2)}';

  Future<void> _updateStatus(String newStatus) async {
    setState(() => _updating = true);
    try {
      await ref.read(ordersProvider.notifier).updateStatus(widget.orderId, newStatus);
      ref.invalidate(orderDetailProvider(widget.orderId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _cancel() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel Order?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('No')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cancel Order'),
          ),
        ],
      ),
    );
    if (ok == true) await _updateStatus('cancelled');
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final nextStatus = OrderDetailPage._nextStatus[order.status];
    final nextLabel = OrderDetailPage._nextLabel[order.status];
    final cs = Theme.of(context).colorScheme;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Header card
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        order.tableName ?? 'Table',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                      ),
                    ),
                    StatusChip(status: order.status),
                  ],
                ),
                const SizedBox(height: 8),
                _InfoRow(Icons.tag, 'Order ID', order.id.substring(0, 8).toUpperCase()),
                if (order.customerName != null)
                  _InfoRow(Icons.person_outline, 'Customer', order.customerName!),
                _InfoRow(Icons.schedule, 'Placed', _formatTime(order.createdAt)),
                if (order.notes != null)
                  _InfoRow(Icons.notes, 'Note', order.notes!),
              ],
            ),
          ),
        ),

        const SizedBox(height: 12),

        // Items
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Items', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                const SizedBox(height: 12),
                ...order.items.map((item) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              color: cs.primary.withAlpha(25),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            alignment: Alignment.center,
                            child: Text('${item.quantity}',
                                style: TextStyle(fontWeight: FontWeight.bold, color: cs.primary, fontSize: 13)),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.menuItemName, style: const TextStyle(fontWeight: FontWeight.w500)),
                                if (item.notes != null)
                                  Text(item.notes!, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                              ],
                            ),
                          ),
                          Text(_fmt(item.totalPriceDouble),
                              style: const TextStyle(fontWeight: FontWeight.w500)),
                        ],
                      ),
                    )),
                const Divider(),
                _TotalRow('Subtotal', _fmt(double.tryParse(order.subtotal) ?? 0), false),
                if ((double.tryParse(order.taxAmount) ?? 0) > 0)
                  _TotalRow('Tax', _fmt(double.tryParse(order.taxAmount) ?? 0), false),
                if ((double.tryParse(order.serviceCharge) ?? 0) > 0)
                  _TotalRow('Service', _fmt(double.tryParse(order.serviceCharge) ?? 0), false),
                const SizedBox(height: 4),
                _TotalRow('Total', _fmt(order.totalAmountDouble), true),
              ],
            ),
          ),
        ),

        const SizedBox(height: 16),

        // Action buttons
        if (order.status != 'cancelled' && order.status != 'served') ...[
          if (nextStatus != null)
            ElevatedButton.icon(
              onPressed: _updating ? null : () => _updateStatus(nextStatus),
              icon: _updating
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.arrow_forward),
              label: Text(nextLabel!),
            ),

          const SizedBox(height: 10),

          // Edit button (if pending/confirmed)
          if (['pending', 'confirmed'].contains(order.status))
            OutlinedButton.icon(
              onPressed: () => context.push('/orders/${order.id}/edit', extra: order),
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Edit Items'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),

          const SizedBox(height: 10),

          // Cancel
          if (order.status == 'pending')
            OutlinedButton.icon(
              onPressed: _updating ? null : _cancel,
              icon: const Icon(Icons.cancel_outlined),
              label: const Text('Cancel Order'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red,
                side: const BorderSide(color: Colors.red),
                minimumSize: const Size(double.infinity, 52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
        ],
      ],
    );
  }

  String _formatTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    return '${diff.inHours}h ${diff.inMinutes % 60}m ago';
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Row(
          children: [
            Icon(icon, size: 15, color: const Color(0xFF9CA3AF)),
            const SizedBox(width: 6),
            Text('$label: ', style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
            Expanded(child: Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500))),
          ],
        ),
      );
}

class _TotalRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  const _TotalRow(this.label, this.value, this.bold);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal, fontSize: bold ? 15 : 13)),
            Text(value, style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal, fontSize: bold ? 15 : 13)),
          ],
        ),
      );
}
