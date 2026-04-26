import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../services/api_service.dart';
import '../services/notification_service.dart';
import '../models/order_model.dart';
import '../core/constants.dart';

class OrdersNotifier extends StateNotifier<AsyncValue<List<OrderModel>>> {
  OrdersNotifier() : super(const AsyncValue.loading()) {
    refresh();
  }

  Timer? _pollTimer;
  final Set<String> _knownOrderIds = {};

  void startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(AppConstants.pollInterval, (_) => _poll());
  }

  void stopPolling() => _pollTimer?.cancel();

  Future<void> _poll() async {
    try {
      final orders = await _fetchOrders();
      _notifyNewOrders(orders);
      if (mounted) state = AsyncValue.data(orders);
    } catch (_) {
      // Silent poll failure — don't overwrite existing data
    }
  }

  void _notifyNewOrders(List<OrderModel> orders) {
    for (final order in orders) {
      if (!_knownOrderIds.contains(order.id)) {
        _knownOrderIds.add(order.id);
        if (_knownOrderIds.length > 1) {
          // Skip notification on first load
          NotificationService.instance.showNewOrder(
            orderId: order.id,
            tableName: order.tableName ?? 'Table',
            total: '\$${order.totalAmountDouble.toStringAsFixed(2)}',
          );
        }
      }
    }
  }

  Future<List<OrderModel>> _fetchOrders() async {
    final raw = await ApiService.instance.getOrders();
    return (raw).map((e) => OrderModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    try {
      final orders = await _fetchOrders();
      for (final o in orders) {
        _knownOrderIds.add(o.id);
      }
      if (mounted) state = AsyncValue.data(orders);
    } on DioException catch (e, st) {
      if (mounted) state = AsyncValue.error(e, st);
    }
  }

  Future<void> updateStatus(String orderId, String status) async {
    await ApiService.instance.updateOrderStatus(orderId, status);
    // Optimistic update
    final current = state.valueOrNull ?? [];
    if (mounted) {
      state = AsyncValue.data(
        current.map((o) => o.id == orderId ? o.copyWith(status: status) : o).toList(),
      );
    }
    await refresh();
  }

  Future<void> editOrder(
    String orderId, {
    required List<Map<String, dynamic>> items,
    String? notes,
  }) async {
    await ApiService.instance.editOrder(orderId, items: items, notes: notes);
    await refresh();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}

final ordersProvider =
    StateNotifierProvider<OrdersNotifier, AsyncValue<List<OrderModel>>>(
  (_) => OrdersNotifier(),
);

// Single order detail (refreshed on navigation)
final orderDetailProvider = FutureProvider.family<OrderModel, String>((ref, id) async {
  final raw = await ApiService.instance.getOrder(id);
  return OrderModel.fromJson(raw);
});
