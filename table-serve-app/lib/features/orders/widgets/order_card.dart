import 'package:flutter/material.dart';
import '../../../models/order_model.dart';
import 'status_chip.dart';
import 'package:timeago/timeago.dart' as timeago;

class OrderCard extends StatelessWidget {
  final OrderModel order;
  final VoidCallback? onTap;

  const OrderCard({super.key, required this.order, this.onTap});

  @override
  Widget build(BuildContext context) {
    final waitMin = DateTime.now().difference(order.createdAt).inMinutes;
    final isUrgent = order.status == 'pending' && waitMin >= 5;

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Text(
                          order.tableName ?? 'Table',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        if (order.isAutoAssigned) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.orange[50],
                              borderRadius: BorderRadius.circular(5),
                              border: Border.all(color: Colors.orange.shade200),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.swap_horiz, size: 10, color: Colors.orange[700]),
                                const SizedBox(width: 3),
                                Text('Auto', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.orange[700])),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  StatusChip(status: order.status),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.receipt_outlined, size: 14, color: Color(0xFF9CA3AF)),
                  const SizedBox(width: 4),
                  Text(
                    '${order.items.length} item${order.items.length != 1 ? 's' : ''}',
                    style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13),
                  ),
                  const SizedBox(width: 16),
                  const Icon(Icons.attach_money, size: 14, color: Color(0xFF9CA3AF)),
                  Text(
                    order.totalAmountDouble.toStringAsFixed(2),
                    style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13),
                  ),
                  const Spacer(),
                  if (isUrgent)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('Urgent',
                          style: TextStyle(color: Color(0xFFEF4444), fontSize: 11, fontWeight: FontWeight.w600)),
                    )
                  else
                    Text(
                      timeago.format(order.createdAt),
                      style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
                    ),
                ],
              ),
              if (order.customerName != null) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.person_outline, size: 13, color: Color(0xFF9CA3AF)),
                    const SizedBox(width: 4),
                    Text(order.customerName!, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
