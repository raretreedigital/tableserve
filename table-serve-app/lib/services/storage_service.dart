import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  static StorageService? _instance;
  SharedPreferences? _prefs;

  StorageService._();

  static StorageService get instance {
    _instance ??= StorageService._();
    return _instance!;
  }

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  SharedPreferences get _p {
    if (_prefs == null) throw StateError('StorageService not initialised — call init() first.');
    return _prefs!;
  }

  Future<void> setString(String key, String value) => _p.setString(key, value);
  String? getString(String key) => _p.getString(key);
  Future<void> remove(String key) => _p.remove(key);
  Future<void> clear() => _p.clear();
}
