class AppConstants {
  AppConstants._();

  // ── Change this to your backend URL ──────────────────────────────────────────
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/api', // iOS Simulator → localhost
  );

  // Auth endpoints (better-auth)
  static const String signInPath = '/auth/sign-in/email';
  static const String signOutPath = '/auth/sign-out';

  // Waiter endpoints
  static const String waiterMe = '/waiter/me';
  static const String waiterOrders = '/waiter/orders';
  static const String waiterTables = '/waiter/tables';

  // Storage keys
  static const String tokenKey = 'waiter_session_token';
  static const String userKey = 'waiter_user';

  // Polling
  static const Duration pollInterval = Duration(seconds: 15);

  // Notification channel
  static const String notifChannelId = 'new_orders';
  static const String notifChannelName = 'New Orders';
}
