import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../models/waiter_model.dart';
import '../core/constants.dart';

// ── Auth state ────────────────────────────────────────────────────────────────

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final WaiterUser? user;
  final String? error;

  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.error,
  });

  AuthState copyWith({AuthStatus? status, WaiterUser? user, String? error}) =>
      AuthState(
        status: status ?? this.status,
        user: user ?? this.user,
        error: error ?? this.error,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState()) {
    _tryAutoLogin();
  }

  Future<void> _tryAutoLogin() async {
    final token = StorageService.instance.getString(AppConstants.tokenKey);
    if (token == null) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
      return;
    }
    try {
      final me = await ApiService.instance.getMe();
      final user = WaiterUser.fromJson(me);
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      await StorageService.instance.remove(AppConstants.tokenKey);
      state = state.copyWith(status: AuthStatus.unauthenticated);
    }
  }

  Future<String?> signIn(String email, String password) async {
    try {
      final data = await ApiService.instance.signIn(email, password);
      // better-auth returns { token, user } or a session object
      final token = data['token'] as String? ??
          (data['session'] as Map<String, dynamic>?)?['token'] as String?;
      if (token == null) return 'Login failed — no token received.';

      await StorageService.instance.setString(AppConstants.tokenKey, token);

      final me = await ApiService.instance.getMe();
      final user = WaiterUser.fromJson(me);

      if (user.role != 'waiter') {
        await StorageService.instance.remove(AppConstants.tokenKey);
        return 'This app is for waiters only.';
      }

      state = AuthState(status: AuthStatus.authenticated, user: user);
      return null; // success
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['error'] as String?;
      return msg ?? 'Login failed. Check your credentials.';
    } catch (e) {
      return 'Unexpected error: $e';
    }
  }

  Future<void> signOut() async {
    await ApiService.instance.signOut();
    await StorageService.instance.remove(AppConstants.tokenKey);
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Re-fetches /waiter/me to refresh profile & duty status after an update.
  Future<void> refresh() async {
    try {
      final me = await ApiService.instance.getMe();
      final user = WaiterUser.fromJson(me);
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {}
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (_) => AuthNotifier(),
);
