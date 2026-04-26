import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/order_model.dart';
import '../../providers/orders_provider.dart';

class EditOrderPage extends ConsumerStatefulWidget {
  final OrderModel order;
  const EditOrderPage({super.key, required this.order});

  @override
  ConsumerState<EditOrderPage> createState() => _EditOrderPageState();
}

class _EditOrderPageState extends ConsumerState<EditOrderPage> {
  late List<_EditItem> _items;
  late TextEditingController _notesCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _items = widget.order.items.map((i) => _EditItem(
      menuItemId: i.menuItemId,
      name: i.menuItemName,
      unitPrice: i.unitPriceDouble,
      quantity: i.quantity,
      notes: i.notes ?? '',
    )).toList();
    _notesCtrl = TextEditingController(text: widget.order.notes ?? '');
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  void _changeQty(int idx, int delta) {
    setState(() {
      final next = _items[idx].quantity + delta;
      if (next <= 0) {
        _items.removeAt(idx);
      } else {
        _items[idx] = _items[idx].copyWith(quantity: next);
      }
    });
  }

  double get _newSubtotal =>
      _items.fold(0, (s, i) => s + i.unitPrice * i.quantity);

  Future<void> _save() async {
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Order must have at least one item.')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(ordersProvider.notifier).editOrder(
        widget.order.id,
        items: _items.map((i) => {
          'menuItemId': i.menuItemId,
          'quantity': i.quantity,
          if (i.notes.isNotEmpty) 'notes': i.notes,
        }).toList(),
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Order updated.'), backgroundColor: Colors.green),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Order'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Info banner
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: cs.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: cs.primary, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Editing ${widget.order.tableName ?? 'order'} — modify quantities or notes below.',
                    style: TextStyle(color: cs.primary, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Items
          ...List.generate(_items.length, (i) {
            final item = _items[i];
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(item.name,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        ),
                        Text('\$${item.unitPrice.toStringAsFixed(2)}',
                            style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        // Quantity controls
                        _QtyButton(
                          icon: Icons.remove,
                          onTap: () => _changeQty(i, -1),
                          danger: item.quantity == 1,
                        ),
                        Container(
                          width: 40,
                          alignment: Alignment.center,
                          child: Text('${item.quantity}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        ),
                        _QtyButton(icon: Icons.add, onTap: () => _changeQty(i, 1)),
                        const Spacer(),
                        Text('\$${(item.unitPrice * item.quantity).toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: TextEditingController(text: item.notes)
                        ..selection = TextSelection.collapsed(offset: item.notes.length),
                      onChanged: (v) => setState(() => _items[i] = item.copyWith(notes: v)),
                      decoration: const InputDecoration(
                        hintText: 'Item note (optional)',
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      style: const TextStyle(fontSize: 13),
                    ),
                  ],
                ),
              ),
            );
          }),

          const SizedBox(height: 8),

          // Order notes
          TextField(
            controller: _notesCtrl,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Order note (optional)',
              alignLabelWithHint: true,
            ),
          ),

          const SizedBox(height: 20),

          // New total preview
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF86EFAC)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('New Subtotal', style: TextStyle(fontWeight: FontWeight.w600)),
                Text('\$${_newSubtotal.toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ],
            ),
          ),

          const SizedBox(height: 16),

          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 22, height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
          ),
        ],
      ),
    );
  }
}

class _EditItem {
  final String menuItemId;
  final String name;
  final double unitPrice;
  final int quantity;
  final String notes;

  const _EditItem({
    required this.menuItemId,
    required this.name,
    required this.unitPrice,
    required this.quantity,
    required this.notes,
  });

  _EditItem copyWith({int? quantity, String? notes}) => _EditItem(
        menuItemId: menuItemId,
        name: name,
        unitPrice: unitPrice,
        quantity: quantity ?? this.quantity,
        notes: notes ?? this.notes,
      );
}

class _QtyButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final bool danger;
  const _QtyButton({required this.icon, required this.onTap, this.danger = false});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: danger ? const Color(0xFFFEE2E2) : const Color(0xFFF3F4F6),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: danger ? Colors.red : const Color(0xFF374151)),
        ),
      );
}
