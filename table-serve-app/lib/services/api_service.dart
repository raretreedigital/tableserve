import 'package:dio/dio.dart';
import '../core/constants.dart';
import '../services/storage_service.dart';

class ApiService {
  static ApiService? _instance;
  late final Dio _dio;

  ApiService._() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    // Attach session token to every request
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = StorageService.instance.getString(AppConstants.tokenKey);
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (error, handler) {
          // 401 → token expired / invalid — caller handles redirect
          return handler.next(error);
        },
      ),
    );
  }

  static ApiService get instance {
    _instance ??= ApiService._();
    return _instance!;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> signIn(String email, String password) async {
    final res = await _dio.post(
      AppConstants.signInPath,
      data: {'email': email, 'password': password},
    );
    return res.data as Map<String, dynamic>;
  }

  Future<void> signOut() async {
    try {
      await _dio.post(AppConstants.signOutPath);
    } catch (_) {}
  }

  // ── Waiter ───────────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getMe() async {
    final res = await _dio.get(AppConstants.waiterMe);
    return res.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> getOrders({String? status}) async {
    final res = await _dio.get(
      AppConstants.waiterOrders,
      queryParameters: status != null ? {'status': status} : null,
    );
    return res.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> getOrder(String id) async {
    final res = await _dio.get('${AppConstants.waiterOrders}/$id');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateOrderStatus(String id, String status) async {
    final res = await _dio.patch(
      '${AppConstants.waiterOrders}/$id/status',
      data: {'status': status},
    );
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> editOrder(
    String id, {
    required List<Map<String, dynamic>> items,
    String? notes,
  }) async {
    final res = await _dio.patch(
      '${AppConstants.waiterOrders}/$id',
      data: {'items': items, if (notes != null) 'notes': notes},
    );
    return res.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> getTables() async {
    final res = await _dio.get(AppConstants.waiterTables);
    return res.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> updateDutyStatus(String dutyStatus) async {
    final res = await _dio.patch(
      '${AppConstants.baseUrl}/api/waiter/me/duty-status',
      data: {'dutyStatus': dutyStatus},
    );
    return res.data as Map<String, dynamic>;
  }
}
