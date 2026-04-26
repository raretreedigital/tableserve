class OrderItemModel {
  final String id;
  final String orderId;
  final String menuItemId;
  final String menuItemName;
  final int quantity;
  final String unitPrice;
  final String totalPrice;
  final String? notes;

  const OrderItemModel({
    required this.id,
    required this.orderId,
    required this.menuItemId,
    required this.menuItemName,
    required this.quantity,
    required this.unitPrice,
    required this.totalPrice,
    this.notes,
  });

  factory OrderItemModel.fromJson(Map<String, dynamic> json) => OrderItemModel(
        id: json['id'] as String,
        orderId: json['orderId'] as String? ?? '',
        menuItemId: json['menuItemId'] as String? ?? '',
        menuItemName: json['menuItemName'] as String? ?? json['menuItem']?['name'] ?? '',
        quantity: json['quantity'] as int,
        unitPrice: json['unitPrice'] as String,
        totalPrice: json['totalPrice'] as String? ?? '0',
        notes: json['notes'] as String?,
      );

  double get unitPriceDouble => double.tryParse(unitPrice) ?? 0;
  double get totalPriceDouble => double.tryParse(totalPrice) ?? 0;
}

class OrderModel {
  final String id;
  final String organizationId;
  final String? tableId;
  final String? tableName;
  final String? customerName;
  final String status;
  final String subtotal;
  final String taxAmount;
  final String serviceCharge;
  final String totalAmount;
  final String? notes;
  final String? editableUntil;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<OrderItemModel> items;
  final Map<String, dynamic>? table;

  const OrderModel({
    required this.id,
    required this.organizationId,
    this.tableId,
    this.tableName,
    this.customerName,
    required this.status,
    required this.subtotal,
    required this.taxAmount,
    required this.serviceCharge,
    required this.totalAmount,
    this.notes,
    this.editableUntil,
    required this.createdAt,
    required this.updatedAt,
    this.items = const [],
    this.table,
    this.isAutoAssigned = false,
  });

  final bool isAutoAssigned;

  factory OrderModel.fromJson(Map<String, dynamic> json) => OrderModel(
        id: json['id'] as String,
        organizationId: json['organizationId'] as String,
        tableId: json['tableId'] as String?,
        tableName: json['tableName'] as String?,
        customerName: json['customerName'] as String?,
        status: json['status'] as String,
        subtotal: json['subtotal'] as String,
        taxAmount: json['taxAmount'] as String,
        serviceCharge: json['serviceCharge'] as String? ?? '0',
        totalAmount: json['totalAmount'] as String,
        notes: json['notes'] as String?,
        editableUntil: json['editableUntil'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
        items: (json['items'] as List<dynamic>?)
                ?.map((e) => OrderItemModel.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        table: json['table'] as Map<String, dynamic>?,
        isAutoAssigned: json['isAutoAssigned'] as bool? ?? false,
      );

  double get totalAmountDouble => double.tryParse(totalAmount) ?? 0;

  bool get isEditable {
    if (editableUntil == null) return false;
    return DateTime.now().isBefore(DateTime.parse(editableUntil!));
  }

  bool get isActive =>
      ['pending', 'confirmed', 'preparing', 'ready'].contains(status);

  OrderModel copyWith({String? status}) => OrderModel(
        id: id,
        organizationId: organizationId,
        tableId: tableId,
        tableName: tableName,
        customerName: customerName,
        status: status ?? this.status,
        subtotal: subtotal,
        taxAmount: taxAmount,
        serviceCharge: serviceCharge,
        totalAmount: totalAmount,
        notes: notes,
        editableUntil: editableUntil,
        createdAt: createdAt,
        updatedAt: updatedAt,
        items: items,
        table: table,
      );
}
