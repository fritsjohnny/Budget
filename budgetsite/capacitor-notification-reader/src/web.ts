import { WebPlugin } from '@capacitor/core';
import type { NotificationPayload, NotificationReaderPlugin } from './definitions';

export class NotificationReaderPluginWeb extends WebPlugin implements NotificationReaderPlugin {
  async openNotificationAccessSettings(): Promise<void> {
    console.warn('openNotificationAccessSettings is not available on web');
  }

  async getActiveNotifications(): Promise<{ notifications: NotificationPayload[] }> {
    console.warn('getActiveNotifications is not available on web');
    return { notifications: [] };
  }

  async getPendingNotification(): Promise<{ notification?: NotificationPayload }> {
    console.warn('getPendingNotification is not available on web');
    return {};
  }

  async repostNotifications(): Promise<void> {
    console.warn('repostNotifications is not available on web');
  }

  async clearPendingNotification(): Promise<void> {
    console.warn('clearPendingNotification is not available on web');
  }

  override addListener(
    eventName: 'notificationReceived' | 'cardNotificationOpened',
    listenerFunc: (payload: NotificationPayload) => void
  ): Promise<import('./definitions').PluginListenerHandle> & import('./definitions').PluginListenerHandle {
    console.warn(`Event ${eventName} is not supported on web`);
    const handle = {
      remove: async () => {},
    };
    const promise = Promise.resolve(handle) as Promise<import('./definitions').PluginListenerHandle> & import('./definitions').PluginListenerHandle;
    Object.assign(promise, handle);
    return promise;
  }
}
