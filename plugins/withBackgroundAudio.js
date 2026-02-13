const { withInfoPlist, withAndroidManifest } = require('expo/config-plugins');

/**
 * Custom Expo config plugin: enables background audio recording on iOS and Android.
 *
 * iOS:
 * - UIBackgroundModes → 'audio' so recording continues when app is backgrounded
 * - NSMicrophoneUsageDescription is set in app.json; we ensure it exists
 * - AVAudioSession category is configured at runtime in app code (expo-av)
 *
 * Android:
 * - RECORD_AUDIO and FOREGROUND_SERVICE permissions
 * - Foreground service type for microphone (Android 14+ FOREGROUND_SERVICE_MICROPHONE)
 * - Notification channel for the foreground service
 * - Service declaration so the app can run recording in foreground service mode
 */
function withBackgroundAudioIOS(config) {
  return withInfoPlist(config, (config) => {
    const plist = config.modResults;

    // Required for background audio recording on iOS
    if (!plist.UIBackgroundModes) {
      plist.UIBackgroundModes = [];
    }
    if (!plist.UIBackgroundModes.includes('audio')) {
      plist.UIBackgroundModes.push('audio');
    }

    // Microphone usage description (fallback if not in app.json)
    if (!plist.NSMicrophoneUsageDescription) {
      plist.NSMicrophoneUsageDescription =
        'This app needs microphone access to record meetings and generate transcripts.';
    }

    return config;
  });
}

function withBackgroundAudioAndroid(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const mainApplication = manifest.manifest?.application?.[0];

    if (!mainApplication) return config;

    // 1. Add permissions: RECORD_AUDIO, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MICROPHONE (API 34+)
    const permissions = manifest.manifest['uses-permission'] || [];
    const requiredPermissions = [
      'android.permission.RECORD_AUDIO',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.POST_NOTIFICATIONS', // Android 13+ for notification channel
    ];

    for (const perm of requiredPermissions) {
      if (!permissions.some((p) => p.$?.['android:name'] === perm)) {
        permissions.push({ $: { 'android:name': perm } });
      }
    }
    manifest.manifest['uses-permission'] = permissions;

    // 2. Add foreground service inside <application>
    const services = mainApplication.service || [];
    const serviceName = 'com.meetingnotes.app.RecordingForegroundService';
    if (!services.some((s) => s.$?.['android:name'] === serviceName)) {
      mainApplication.service = [
        ...services,
        {
          $: {
            'android:name': serviceName,
            'android:enabled': 'true',
            'android:exported': 'false',
            'android:foregroundServiceType': 'microphone',
          },
        },
      ];
    }

    return config;
  });
}

function withBackgroundAudio(config) {
  config = withBackgroundAudioIOS(config);
  config = withBackgroundAudioAndroid(config);
  return config;
}

module.exports = withBackgroundAudio;
