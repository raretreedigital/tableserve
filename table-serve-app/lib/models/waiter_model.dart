class WaiterUser {
  final String id;
  final String name;
  final String email;
  final String role;
  final WaiterAssignment assignment;
  final List<dynamic> assignedTables;

  const WaiterUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.assignment,
    required this.assignedTables,
  });

  factory WaiterUser.fromJson(Map<String, dynamic> json) => WaiterUser(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        role: json['role'] as String,
        assignment: WaiterAssignment.fromJson(
          json['assignment'] as Map<String, dynamic>,
        ),
        assignedTables: json['assignedTables'] as List<dynamic>? ?? [],
      );
}

class WaiterAssignment {
  final String id;
  final String organizationId;
  final String? organizationName;
  final List<String> tableIds;
  final bool isActive;
  final String dutyStatus;

  const WaiterAssignment({
    required this.id,
    required this.organizationId,
    this.organizationName,
    required this.tableIds,
    required this.isActive,
    this.dutyStatus = 'on_duty',
  });

  factory WaiterAssignment.fromJson(Map<String, dynamic> json) => WaiterAssignment(
        id: json['id'] as String,
        organizationId: json['organizationId'] as String,
        organizationName: json['organizationName'] as String?,
        tableIds:
            (json['tableIds'] as List<dynamic>?)?.map((e) => e as String).toList() ?? [],
        isActive: json['isActive'] as bool? ?? true,
        dutyStatus: json['dutyStatus'] as String? ?? 'on_duty',
      );
}
