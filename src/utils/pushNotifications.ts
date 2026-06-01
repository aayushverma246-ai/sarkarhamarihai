import { Capacitor } from '@capacitor/core';
import { api } from '../api';

export async function initNativePushNotifications() {
  // STRICT GUARD: Push notifications are only applicable for mobile native platforms (Android/iOS)
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    if (!PushNotifications || typeof PushNotifications.checkPermissions !== 'function') {
      console.warn('[Push] PushNotifications plugin is not available or registered.');
      return;
    }

    // 1. Check current permission status
    let permStatus;
    try {
      permStatus = await PushNotifications.checkPermissions();
    } catch (permErr) {
      console.warn('[Push] checkPermissions failed, skipping registration:', permErr);
      return;
    }

    if (permStatus && permStatus.receive === 'prompt') {
      // 2. Request explicit push permission from the user
      try {
        permStatus = await PushNotifications.requestPermissions();
      } catch (reqErr) {
        console.warn('[Push] requestPermissions failed:', reqErr);
        return;
      }
    }

    if (!permStatus || permStatus.receive !== 'granted') {
      console.warn('[Push] User denied or skipped push notification permissions.');
      return;
    }

    // 3. Register device to APNs/FCM gateways
    await PushNotifications.register();

    // 4. Handle successful registration token
    await PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] Registration succeeded. Token:', token.value);
      try {
        // Securely upload FCM token to your backend database
        await api.registerDeviceToken({
          token: token.value,
          deviceType: Capacitor.getPlatform()
        });
        console.log('[Push] Device token successfully registered with backend.');
      } catch (err) {
        console.error('[Push] Failed to register token with backend:', err);
      }
    });

    // 5. Handle registration failures
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration failed with error:', error);
    });

    // 6. Handle action / click events when user taps a banner on their lockscreen
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] User acted on lockscreen notification:', action);
      const jobId = action.notification.data?.jobId;
      if (jobId) {
        // Navigate directly to the corresponding exam syllabus details
        window.location.href = `/jobs/${jobId}`;
      } else {
        window.location.href = '/notifications';
      }
    });

  } catch (err) {
    console.error('[Push] Failed to initialize push notification plugin:', err);
  }
}
