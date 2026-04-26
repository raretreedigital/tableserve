import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  static final NotificationService instance = NotificationService._();
  NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialised = false;

  Future<void> init() async {
    if (_initialised) return;

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwin = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    await _plugin.initialize(
      const InitializationSettings(android: android, iOS: darwin),
    );

    // Create Android notification channel
    const channel = AndroidNotificationChannel(
      'new_orders',
      'New Orders',
      description: 'Alerts for new orders at your assigned tables.',
      importance: Importance.high,
      playSound: true,
    );

    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    _initialised = true;
  }

  Future<void> showNewOrder({
    required String orderId,
    required String tableName,
    required String total,
  }) async {
    await _plugin.show(
      orderId.hashCode,
      '🍽️ New Order — $tableName',
      'Total: $total',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'new_orders',
          'New Orders',
          channelDescription: 'Alerts for new orders at your assigned tables.',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
    );
  }
}
