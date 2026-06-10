import { supabaseData } from './supabaseData';
import { supabaseClient } from './supabaseClient';

class NotificationManager {
  constructor() {
    this.swRegistration = null;
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    // VAPID public key would normally come from your environment variables
    this.applicationServerKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  }

  /**
   * Helper to convert Base64 URL safe VAPID string into Uint8Array
   */
  urlB64ToUint8Array(base64String) {
    if (!base64String) {
      throw new Error('VAPID public key is missing');
    }
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Initializes the manager with the active Service Worker registration
   */
  setRegistration(registration) {
    this.swRegistration = registration;
  }

  /**
   * Gets current permission status
   */
  getPermissionStatus() {
    if (!this.isSupported) return 'denied';
    return Notification.permission;
  }

  /**
   * Check if current context is an installed PWA on iOS
   * Note: iOS requires PWA to be installed to home screen for Web Push
   */
  isPushSupportedContext() {
    if (!this.isSupported) return false;
    
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIos) {
      // Check if running in standalone mode (Home Screen PWA)
      const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
      return isStandalone;
    }
    
    // Other platforms generally support push in browser tabs
    return true;
  }

  /**
   * Request permission from user
   */
  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Push notifications are not supported in this browser.');
    }
    
    if (!this.isPushSupportedContext()) {
      throw new Error('Please add this app to your Home Screen to enable notifications.');
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  /**
   * Subscribe user to push notifications and sync to backend
   */
  async subscribeUser(userId) {
    try {
      if (!this.swRegistration) {
        throw new Error('Service Worker is not registered yet.');
      }

      if (this.getPermissionStatus() !== 'granted') {
        const permission = await this.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Notification permission was denied.');
        }
      }

      // See if we have an existing subscription
      let subscription = await this.swRegistration.pushManager.getSubscription();

      // If we don't, subscribe
      if (!subscription) {
        const applicationServerKey = this.urlB64ToUint8Array(this.applicationServerKey);
        subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
      }

      // Sync subscription back to Supabase
      await this.saveSubscriptionToBackend(userId, subscription);
      
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  /**
   * Determine if the user is currently subscribed locally
   */
  async isSubscribed() {
    if (!this.swRegistration) return false;
    const subscription = await this.swRegistration.pushManager.getSubscription();
    return !!subscription;
  }

  /**
   * Save the subscription securely to our database
   */
  async saveSubscriptionToBackend(userId, subscription) {
    try {
      const subJson = subscription.toJSON();
      
      // Upsert into push_subscriptions table
      const { error } = await supabaseClient
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          updated_at: new Date().toISOString(),
          last_used_at: new Date().toISOString()
        }, {
          onConflict: 'user_id, endpoint'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving push subscription locally:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from notifications
   */
  async unsubscribeUser(userId) {
    if (!this.swRegistration) return false;
    
    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        // Unsubscribe locally
        const successful = await subscription.unsubscribe();
        
        if (successful && userId) {
          // Unsubscribe in Backend
          await supabaseClient
            .from('push_subscriptions')
            .delete()
            .match({ user_id: userId, endpoint: endpoint });
        }
        return successful;
      }
    } catch (e) {
      console.error('Error unsubscribing:', e);
    }
    return false;
  }

  /**
   * Test notification with different patterns
   * @param {string} pattern - 'single', 'repeating', or 'custom'
   * @param {Object} options - { count: number, interval: number }
   */
  async testNotification(pattern = 'single', options = {}) {
    try {
      // Request permission if not granted
      if (this.getPermissionStatus() !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Notification permission was denied. Please enable notifications in your browser settings.');
        }
      }

      const { count = 1, interval = 5 } = options;

      if (pattern === 'single') {
        // Send a single test notification
        await this.sendTestNotification('Test Notification', 'This is a single test notification.');
      } else if (pattern === 'repeating') {
        // Send notifications at regular intervals
        for (let i = 0; i < count; i++) {
          await this.sendTestNotification(
            `Test Notification ${i + 1}/${count}`,
            `This is test notification ${i + 1} of ${count}.`
          );
          if (i < count - 1) {
            await new Promise(resolve => setTimeout(resolve, interval * 60 * 1000));
          }
        }
      } else if (pattern === 'custom') {
        // Custom pattern: send notifications at specific intervals
        for (let i = 0; i < count; i++) {
          await this.sendTestNotification(
            `Custom Test ${i + 1}`,
            `Custom notification ${i + 1} sent every ${interval} minutes.`
          );
          if (i < count - 1) {
            await new Promise(resolve => setTimeout(resolve, interval * 60 * 1000));
          }
        }
      }

      return { success: true, message: 'Test notification(s) sent successfully.' };
    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }

  /**
   * Send a local test notification (for immediate feedback)
   */
  async sendTestNotification(title, body) {
    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body: body,
          tag: 'test-notification',
          requireInteraction: true,
          silent: false
        });

        notification.onclick = function() {
          window.focus();
          notification.close();
        };

        console.log('Notification created successfully:', notification);
      } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
      }
    } else {
      console.error('Notification permission not granted');
      throw new Error('Notification permission not granted');
    }
  }
}

export const notificationManager = new NotificationManager();
