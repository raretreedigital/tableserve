import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';
import '../models/table_model.dart';

final tablesProvider = FutureProvider<List<TableModel>>((ref) async {
  final raw = await ApiService.instance.getTables();
  return raw.map((e) => TableModel.fromJson(e as Map<String, dynamic>)).toList();
});
