import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../providers/orders_provider.dart';
import '../../core/theme.dart';
import '../orders/widgets/order_card.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  @override
  void initState() {
    super.initState();
    // Start polling for new orders
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(ordersProvider.notifier).startPolling();
    });
  }

  @override
  void dispose() {
    ref.read(ordersProvider.notifier).stopPolling();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final ordersAsync = ref.watch(ordersProvider);
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Hello, ${user?.name.split(' ').first ?? 'Waiter'} 👋',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            if (user?.assignment.organizationName != null)
              Text(user!.assignment.organizationName!,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.read(ordersProvider.notifier).refresh(),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(ordersProvider.notifier).refresh(),
        child: ordersAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.wifi_off, size: 48, color: Color(0xFF9CA3AF)),
                const SizedBox(height: 12),
                Text('$e', textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF6B7280))),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () => ref.read(ordersProvider.notifier).refresh(),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (orders) {
            final pending = orders.where((o) => o.status == 'pending').length;
            final preparing = orders.where((o) => o.status == 'preparing' || o.status == 'confirmed').length;
            final ready = orders.where((o) => o.status == 'ready').length;
            final urgent = orders.where((o) =>
                o.status == 'pending' &&
                DateTime.now().difference(o.createdAt).inMinutes >= 5).length;

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Stats row
                Row(
                  children: [
                    _StatCard(label: 'Pending', value: '$pending', color: AppTheme.statusColor('pending'), icon: Icons.hourglass_top),
                    const SizedBox(width: 10),
                    _StatCard(label: 'Preparing', value: '$preparing', color: AppTheme.statusColor('preparing'), icon: Icons.soup_kitchen_outlined),
                    const SizedBox(width: 10),
                    _StatCard(label: 'Ready', value: '$ready', color: AppTheme.statusColor('ready'), icon: Icons.check_circle_outline),
                  ],
                ),

                if (urgent > 0) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 20),
                        const SizedBox(width: 8),
                        Text('$urgent order${urgent > 1 ? 's' : ''} waiting 5+ minutes',
                            style: const TextStyle(color: Color(0xFFB91C1C), fontWeight: FontWeight.w600, fontSize: 13)),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Active Orders', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    TextButton(
                      onPressed: () => context.go('/orders'),
                      child: const Text('See all'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                if (orders.isEmpty)
                  const _EmptyOrders()
                else
                  ...orders.take(5).map((o) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: OrderCard(
                          order: o,
                          onTap: () => context.push('/orders/${o.id}'),
                        ),
                      )),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  const _StatCard({required this.label, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
          decoration: BoxDecoration(
            color: color.withAlpha(20),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withAlpha(60)),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 6),
              Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
              Text(label, style: TextStyle(fontSize: 11, color: color.withAlpha(180))),
            ],
          ),
        ),
      );
}

class _EmptyOrders extends StatelessWidget {
  const _EmptyOrders();

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(40),
        alignment: Alignment.center,
        child: Column(
          children: [
            const Icon(Icons.check_circle_outline, size: 48, color: Color(0xFF10B981)),
            const SizedBox(height: 12),
            Text('All clear!', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            const Text('No active orders at your tables.', style: TextStyle(color: Color(0xFF6B7280))),
          ],
        ),
      );
}
