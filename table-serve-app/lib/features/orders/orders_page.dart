import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/orders_provider.dart';
import '../../models/order_model.dart';
import 'widgets/order_card.dart';

class OrdersPage extends ConsumerStatefulWidget {
  const OrdersPage({super.key});

  @override
  ConsumerState<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends ConsumerState<OrdersPage> {
  String _filter = 'active'; // active | pending | confirmed | preparing | ready | all

  static const _filterOptions = [
    ('active', 'Active'),
    ('pending', 'Pending'),
    ('confirmed', 'Confirmed'),
    ('preparing', 'Preparing'),
    ('ready', 'Ready ✓'),
    ('all', 'All'),
  ];

  List<OrderModel> _applyFilter(List<OrderModel> orders) => switch (_filter) {
        'active' => orders.where((o) => o.isActive).toList(),
        'all'    => orders,
        _        => orders.where((o) => o.status == _filter).toList(),
      };

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(ordersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Orders'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.read(ordersProvider.notifier).refresh(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter chips
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: _filterOptions.map((opt) {
                final (value, label) = opt;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(label),
                    selected: _filter == value,
                    onSelected: (_) => setState(() => _filter = value),
                  ),
                );
              }).toList(),
            ),
          ),

          // List
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(ordersProvider.notifier).refresh(),
              child: ordersAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('$e')),
                data: (allOrders) {
                  final orders = _applyFilter(allOrders);
                  if (orders.isEmpty) {
                    return const Center(
                      child: Text('No orders in this category.',
                          style: TextStyle(color: Color(0xFF9CA3AF))),
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    itemCount: orders.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (ctx, i) => OrderCard(
                      order: orders[i],
                      onTap: () => ctx.push('/orders/${orders[i].id}'),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
