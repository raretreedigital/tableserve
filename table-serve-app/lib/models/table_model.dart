class TableModel {
  final String id;
  final String organizationId;
  final String name;
  final String nfcToken;
  final int capacity;
  final String? location;
  final bool isActive;
  final bool isCovered;

  const TableModel({
    required this.id,
    required this.organizationId,
    required this.name,
    required this.nfcToken,
    required this.capacity,
    this.location,
    required this.isActive,
    this.isCovered = false,
  });

  factory TableModel.fromJson(Map<String, dynamic> json) => TableModel(
        id: json['id'] as String,
        organizationId: json['organizationId'] as String,
        name: json['name'] as String,
        nfcToken: json['nfcToken'] as String? ?? '',
        capacity: json['capacity'] as int? ?? 4,
        location: json['location'] as String?,
        isActive: json['isActive'] as bool? ?? true,
        isCovered: json['isCovered'] as bool? ?? false,
      );
}
