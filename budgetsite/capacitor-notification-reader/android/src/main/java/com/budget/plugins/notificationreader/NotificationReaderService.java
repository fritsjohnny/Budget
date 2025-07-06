package com.budget.plugins.notificationreader;

import android.app.Notification;
import android.os.Build;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import androidx.annotation.RequiresApi;

import org.json.JSONArray;
import org.json.JSONObject;

public class NotificationReaderService extends NotificationListenerService {

    private static NotificationListener notificationListener;
    private static NotificationReaderService notificationServiceInstance;

    public interface NotificationListener {
        void onNotificationReceived(String appName, String title, String text);
    }

    public static void setNotificationListener(NotificationListener listener) {
        notificationListener = listener;
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        notificationServiceInstance = this;
        Log.d("NotificationReader", "Listener conectado");
    }

    @Override
    public void onCreate() {
        super.onCreate();
        notificationServiceInstance = this;
        Log.d("NotificationReader", "Serviço criado");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;

        String packageName = sbn.getPackageName();
        CharSequence titleChar = sbn.getNotification().extras.getCharSequence("android.title");
        CharSequence textChar = sbn.getNotification().extras.getCharSequence("android.text");

        String title = titleChar != null ? titleChar.toString() : "";
        String text = textChar != null ? textChar.toString() : "";

        if (notificationListener != null) {
            notificationListener.onNotificationReceived(packageName, title, text);
        }
    }

    public static JSONArray getCurrentNotifications() {
        JSONArray notifications = new JSONArray();

        if (notificationServiceInstance == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return notifications;
        }

        try {
            StatusBarNotification[] active = notificationServiceInstance.getActiveNotifications();

            for (StatusBarNotification sbn : active) {
                Notification n = sbn.getNotification();
                if (n == null) continue;

                CharSequence titleChar = n.extras.getCharSequence("android.title");
                CharSequence textChar = n.extras.getCharSequence("android.text");

                String title = titleChar != null ? titleChar.toString() : "";
                String text = textChar != null ? textChar.toString() : "";

                JSONObject json = new JSONObject();
                json.put("package", sbn.getPackageName());
                json.put("title", title);
                json.put("text", text);

                notifications.put(json);
            }
        } catch (Exception e) {
            Log.e("NotificationReader", "Erro ao obter notificações ativas", e);
        }

        return notifications;
    }
}
