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

  override addListener(
    eventName: 'notificationReceived',
    listenerFunc: (payload: NotificationPayload) => void
  ): Promise<import('./definitions').PluginListenerHandle> & import('./definitions').PluginListenerHandle {
    console.warn('notificationReceived listener not supported on web');
    const handle = {
      remove: async () => {},
    };
    const promise = Promise.resolve(handle) as Promise<import('./definitions').PluginListenerHandle> & import('./definitions').PluginListenerHandle;
    Object.assign(promise, handle);
    return promise;
  }
}
