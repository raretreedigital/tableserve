import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

// Duty status options
const _dutyLabels = {
  'on_duty': 'On Duty',
  'on_leave': 'On Leave',
  'off_shift': 'Off Shift',
};

const _dutyColors = {
  'on_duty': Colors.green,
  'on_leave': Colors.orange,
  'off_shift': Colors.blueGrey,
};

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  bool _updatingDuty = false;

  Future<void> _setDutyStatus(String status) async {
    setState(() => _updatingDuty = true);
    try {
      await ApiService.instance.updateDutyStatus(status);
      // Refresh auth state so dutyStatus is updated
      await ref.read(authProvider.notifier).refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update status: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _updatingDuty = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final user = auth.user;
    final dutyStatus = user?.assignment.dutyStatus ?? 'on_duty';

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Avatar + name
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                  child: Text(
                    (user?.name.isNotEmpty == true) ? user!.name[0].toUpperCase() : 'W',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(user?.name ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                const SizedBox(height: 4),
                Text(user?.email ?? '', style: const TextStyle(color: Color(0xFF6B7280))),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Waiter',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 28),

          // ── Duty Status ────────────────────────────────────────────────────
          const _SectionHeader('Duty Status'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: _dutyColors[dutyStatus] ?? Colors.grey,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _dutyLabels[dutyStatus] ?? dutyStatus,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: _dutyColors[dutyStatus] ?? Colors.grey,
                        ),
                      ),
                      if (_updatingDuty) ...[
                        const SizedBox(width: 12),
                        const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                      ],
                    ],
                  ),
                  if (dutyStatus == 'on_leave')
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        children: [
                          Icon(Icons.info_outline, size: 14, color: Colors.orange[700]),
                          const SizedBox(width: 6),
                          const Expanded(
                            child: Text(
                              'Your tables are being covered by on-duty staff.',
                              style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 14),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'on_duty', label: Text('On Duty'), icon: Icon(Icons.check_circle_outline, size: 16)),
                      ButtonSegment(value: 'on_leave', label: Text('On Leave'), icon: Icon(Icons.beach_access, size: 16)),
                      ButtonSegment(value: 'off_shift', label: Text('Off Shift'), icon: Icon(Icons.bedtime_outlined, size: 16)),
                    ],
                    selected: {dutyStatus},
                    onSelectionChanged: _updatingDuty
                        ? null
                        : (s) => _setDutyStatus(s.first),
                    style: ButtonStyle(
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),

          // Restaurant info
          if (user?.assignment.organizationName != null) ...[
            const _SectionHeader('Restaurant'),
            _InfoTile(
              icon: Icons.restaurant,
              title: user!.assignment.organizationName!,
              subtitle: 'Your organisation',
            ),
            _InfoTile(
              icon: Icons.table_restaurant,
              title: '${user.assignment.tableIds.length} tables assigned',
              subtitle: user.assignment.tableIds.isEmpty ? 'No tables yet' : user.assignment.tableIds.join(', '),
            ),
            const SizedBox(height: 20),
          ],

          // Settings
          const _SectionHeader('Account'),
          Card(
            child: Column(
              children: [
                _SettingsTile(
                  icon: Icons.notifications_outlined,
                  title: 'Notifications',
                  onTap: () {},
                ),
                const Divider(height: 1, indent: 56),
                _SettingsTile(
                  icon: Icons.info_outline,
                  title: 'About',
                  subtitle: 'Table Serve Waiter v1.0.0',
                  onTap: () => showAboutDialog(
                    context: context,
                    applicationName: 'Table Serve',
                    applicationVersion: '1.0.0',
                    applicationLegalese: '© 2025 Table Serve',
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Sign out
          OutlinedButton.icon(
            onPressed: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (_) => AlertDialog(
                  title: const Text('Sign Out?'),
                  content: const Text('You will need to sign in again to use the app.'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                    FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Sign Out')),
                  ],
                ),
              );
              if (ok == true) {
                await ref.read(authProvider.notifier).signOut();
              }

            },
            icon: const Icon(Icons.logout),
            label: const Text('Sign Out'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.red,
              side: const BorderSide(color: Colors.red),
              minimumSize: const Size(double.infinity, 52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 4),
        child: Text(title,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF6B7280))),
      );
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _InfoTile({required this.icon, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: ListTile(
          leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500)),
          subtitle: Text(subtitle, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
        ),
      );
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  const _SettingsTile({required this.icon, required this.title, this.subtitle, this.onTap});

  @override
  Widget build(BuildContext context) => ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.onSurfaceVariant),
        title: Text(title),
        subtitle: subtitle != null ? Text(subtitle!, style: const TextStyle(fontSize: 12)) : null,
        trailing: const Icon(Icons.chevron_right, size: 18),
        onTap: onTap,
      );
}
