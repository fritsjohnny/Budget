export interface NotificationPayload {
  package: string;
  title: string;
  text: string;
  receivedAt?: number | string;
}

export interface NotificationReaderPlugin {
  openNotificationAccessSettings(): Promise<void>;

  getActiveNotifications(): Promise<{ notifications: NotificationPayload[] }>;

  getPendingNotification(): Promise<{ notification?: NotificationPayload }>;

  clearPendingNotification(): Promise<void>;

  repostNotifications(options: { notifications: NotificationPayload[] }): Promise<void>;

  addListener(
    eventName: 'notificationReceived' | 'cardNotificationOpened',
    listenerFunc: (payload: NotificationPayload) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  openApp(options: OpenAppOptions): Promise<void>;
}

export interface PluginListenerHandle {
  remove: () => Promise<void>;
}

export interface OpenAppOptions {
  package: string;
}
