package com.budget.plugins.notificationreader;

import android.os.Build;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.getcapacitor.JSObject;

public class NotificationReaderService extends NotificationListenerService {

  private static final String TAG = "NotificationReaderService";

  private static NotificationReaderPlugin pluginInstance;
  private static NotificationReaderService serviceInstance;

  public static void registerPlugin(NotificationReaderPlugin plugin) {
    pluginInstance = plugin;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    serviceInstance = this;
    Log.d(TAG, "Serviço criado");
  }

  @Override
  public void onListenerConnected() {
    super.onListenerConnected();
    serviceInstance = this;
    Log.d(TAG, "Listener conectado");
  }

  @Override
  public void onNotificationPosted(StatusBarNotification sbn) {
    if (sbn == null || sbn.getNotification() == null) return;

    String packageName = sbn.getPackageName();
    CharSequence titleChar = sbn.getNotification().extras.getCharSequence("android.title");
    CharSequence textChar  = sbn.getNotification().extras.getCharSequence("android.text");

    String title = titleChar != null ? titleChar.toString() : "";
    String text  = textChar  != null ? textChar.toString()  : "";

    if (pluginInstance != null) {
      JSObject payload = new JSObject();
      payload.put("package", packageName);
      payload.put("title", title);
      payload.put("text", text);
      pluginInstance.emitNotification(payload);
    }
  }

  public static StatusBarNotification[] fetchActiveNotifications() {
    if (serviceInstance != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      return serviceInstance.getActiveNotifications();
    }
    return null;
  }
}
