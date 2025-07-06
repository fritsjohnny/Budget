package com.budget.plugins.notificationreader;

import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginMethod;

import org.json.JSONArray;

@CapacitorPlugin(name = "NotificationReader")
public class NotificationReaderPlugin extends Plugin {

    @Override
    public void load() {
        NotificationReaderService.setNotificationListener((packageName, title, text) -> {
            JSObject notification = new JSObject();
            notification.put("package", packageName);
            notification.put("title", title);
            notification.put("text", text);

            notifyListeners("notificationReceived", notification);
        });
    }

    @PluginMethod
    public void openNotificationAccessSettings(PluginCall call) {
        Intent intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getActiveNotifications(PluginCall call) {
    Log.d("NotificationReaderPlugin", "getActiveNotifications chamado");

    List<StatusBarNotification> active = NotificationReaderService.getActiveNotifications();

    if (active == null) {
        Log.w("NotificationReaderPlugin", "Serviço não iniciado ou sem permissões");
        call.reject("Notification service not running or permission not granted.");
        return;
    }

    Log.d("NotificationReaderPlugin", "Notificações ativas recebidas: " + active.size());

    JSArray jsArray = new JSArray();

    for (StatusBarNotification sbn : active) {
        if (sbn == null || sbn.getNotification() == null) {
            Log.w("NotificationReaderPlugin", "Notificação inválida (null)");
            continue;
        }

        String packageName = sbn.getPackageName();
        CharSequence titleChar = sbn.getNotification().extras.getCharSequence("android.title");
        CharSequence textChar = sbn.getNotification().extras.getCharSequence("android.text");

        String title = titleChar != null ? titleChar.toString() : "";
        String text = textChar != null ? textChar.toString() : "";

        Log.d("NotificationReaderPlugin", "→ Notificação");
        Log.d("NotificationReaderPlugin", "  • package: " + packageName);
        Log.d("NotificationReaderPlugin", "  • title:   " + title);
        Log.d("NotificationReaderPlugin", "  • text:    " + text);

        JSObject obj = new JSObject();
        obj.put("package", packageName);
        obj.put("title", title);
        obj.put("text", text);

        jsArray.put(obj);
    }

    JSObject result = new JSObject();
    result.put("notifications", jsArray);

    Log.d("NotificationReaderPlugin", "Notificações preparadas para retorno: " + jsArray.length());

    call.resolve(result);
}

}
