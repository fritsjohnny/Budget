export interface NotificationPayload {
  package: string;
  title: string;
  text: string;
}

export interface NotificationReaderPlugin {
  openNotificationAccessSettings(): Promise<void>;

  getActiveNotifications(): Promise<{ notifications: NotificationPayload[] }>;

  addListener(
    eventName: 'notificationReceived',
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
