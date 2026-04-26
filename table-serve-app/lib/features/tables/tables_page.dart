import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/tables_provider.dart';
import '../../providers/orders_provider.dart';
import '../../models/table_model.dart';
import '../../models/order_model.dart';
import 'package:go_router/go_router.dart';

class TablesPage extends ConsumerWidget {
  const TablesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tablesAsync = ref.watch(tablesProvider);
    final ordersAsync = ref.watch(ordersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Tables'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(tablesProvider);
              ref.read(ordersProvider.notifier).refresh();
            },
          ),
        ],
      ),
      body: tablesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (tables) {
          if (tables.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.table_restaurant_outlined, size: 48, color: Color(0xFF9CA3AF)),
                  SizedBox(height: 12),
                  Text('No tables assigned.', style: TextStyle(color: Color(0xFF6B7280))),
                  SizedBox(height: 4),
                  Text('Ask your manager to assign you to tables.',
                      style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                ],
              ),
            );
          }

          final orders = ordersAsync.valueOrNull ?? [];

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: tables.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (ctx, i) {
              final table = tables[i];
              final tableOrders = orders.where((o) => o.tableId == table.id && o.isActive).toList();
              return _TableCard(
                table: table,
                activeOrders: tableOrders,
                onOrderTap: (id) => ctx.push('/orders/$id'),
              );
            },
          );
        },
      ),
    );
  }
}

class _TableCard extends StatelessWidget {
  final TableModel table;
  final List<OrderModel> activeOrders;
  final void Function(String id) onOrderTap;

  const _TableCard({required this.table, required this.activeOrders, required this.onOrderTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final hasPending = activeOrders.any((o) => o.status == 'pending');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: hasPending ? const Color(0xFFFEF3C7) : cs.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.table_restaurant,
                    color: hasPending ? const Color(0xFFD97706) : cs.primary,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(table.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          if (table.isCovered) ...
                            [
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.orange[100],
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.swap_horiz, size: 10, color: Colors.orange[700]),
                                    const SizedBox(width: 3),
                                    Text('Covering', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: Colors.orange[700])),
                                  ],
                                ),
                              ),
                            ],
                        ],
                      ),
                      if (table.location != null)
                        Text(table.location!, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                    ],
                  ),
                ),
                _CapacityBadge(capacity: table.capacity),
              ],
            ),

            if (activeOrders.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Divider(height: 1),
              const SizedBox(height: 10),
              ...activeOrders.map((o) => InkWell(
                    onTap: () => onOrderTap(o.id),
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          _StatusDot(o.status),
                          const SizedBox(width: 8),
                          Text(
                            '${o.items.length} item${o.items.length != 1 ? 's' : ''}',
                            style: const TextStyle(fontSize: 13),
                          ),
                          const Spacer(),
                          Text(
                            '\$${o.totalAmountDouble.toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.chevron_right, size: 16, color: Color(0xFF9CA3AF)),
                        ],
                      ),
                    ),
                  )),
            ] else ...[
              const SizedBox(height: 10),
              const Text('No active orders', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
            ],
          ],
        ),
      ),
    );
  }
}

class _CapacityBadge extends StatelessWidget {
  final int capacity;
  const _CapacityBadge({required this.capacity});

  @override
  Widget build(BuildContext context) => Row(
        children: [
          const Icon(Icons.people_outline, size: 14, color: Color(0xFF9CA3AF)),
          const SizedBox(width: 3),
          Text('$capacity', style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
        ],
      );
}

class _StatusDot extends StatelessWidget {
  final String status;
  const _StatusDot(this.status);

  Color get _color => switch (status) {
        'pending'   => const Color(0xFF6B7280),
        'confirmed' => const Color(0xFF3B82F6),
        'preparing' => const Color(0xFFF59E0B),
        'ready'     => const Color(0xFF10B981),
        _           => const Color(0xFF9CA3AF),
      };

  @override
  Widget build(BuildContext context) => Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(color: _color, shape: BoxShape.circle),
      );
}
