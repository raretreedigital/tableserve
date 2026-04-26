import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../features/auth/login_page.dart';
import '../features/home/home_page.dart';
import '../features/orders/orders_page.dart';
import '../features/orders/order_detail_page.dart';
import '../features/orders/edit_order_page.dart';
import '../features/tables/tables_page.dart';
import '../features/profile/profile_page.dart';
import '../models/order_model.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/home',
    redirect: (context, state) {
      final isAuth = authState.status == AuthStatus.authenticated;
      final isUnknown = authState.status == AuthStatus.unknown;
      final isLoginPage = state.matchedLocation == '/login';

      if (isUnknown) return null;
      if (!isAuth && !isLoginPage) return '/login';
      if (isAuth && isLoginPage) return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginPage(),
      ),
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(
            path: '/home',
            builder: (_, __) => const HomePage(),
          ),
          GoRoute(
            path: '/orders',
            builder: (_, __) => const OrdersPage(),
          ),
          GoRoute(
            path: '/tables',
            builder: (_, __) => const TablesPage(),
          ),
          GoRoute(
            path: '/profile',
            builder: (_, __) => const ProfilePage(),
          ),
        ],
      ),
      GoRoute(
        path: '/orders/:id',
        builder: (_, state) => OrderDetailPage(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders/:id/edit',
        builder: (ctx, state) {
          final order = state.extra as OrderModel;
          return EditOrderPage(order: order);
        },
      ),
    ],
  );
});

// ── Main shell with bottom navigation ────────────────────────────────────────

class MainShell extends StatelessWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  int _indexFromPath(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/orders')) return 1;
    if (location.startsWith('/tables')) return 2;
    if (location.startsWith('/profile')) return 3;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final idx = _indexFromPath(context);
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: idx,
        onDestinationSelected: (i) {
          switch (i) {
            case 0: context.go('/home');
            case 1: context.go('/orders');
            case 2: context.go('/tables');
            case 3: context.go('/profile');
          }
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Orders'),
          NavigationDestination(icon: Icon(Icons.table_restaurant_outlined), selectedIcon: Icon(Icons.table_restaurant), label: 'Tables'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
