package com.budget.plugins.notificationreader;

import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NotificationReaderPlugin")
public class NotificationReaderPlugin extends Plugin {

  private static final String TAG = "NotificationReaderPlugin";

  @Override
  public void load() {
    super.load();
    NotificationReaderService.registerPlugin(this);
    Log.d(TAG, "Plugin carregado e registrado no serviço");
  }

  @PluginMethod
  public void getActiveNotifications(PluginCall call) {
    try {
      StatusBarNotification[] sbns = NotificationReaderService.fetchActiveNotifications();

      if (sbns == null) {
        call.reject("Não foi possível acessar notificações ativas.");
        return;
      }

      JSArray notifications = new JSArray();

      for (StatusBarNotification sbn : sbns) {
        if (sbn == null || sbn.getNotification() == null) continue;

        JSObject notif = new JSObject();
        notif.put("package", sbn.getPackageName());

        CharSequence titleChar = sbn.getNotification().extras.getCharSequence("android.title");
        CharSequence textChar  = sbn.getNotification().extras.getCharSequence("android.text");

        notif.put("title", titleChar != null ? titleChar.toString() : "");
        notif.put("text",  textChar != null ? textChar.toString() : "");

        notifications.put(notif);
      }

      JSObject result = new JSObject();
      result.put("notifications", notifications);
      call.resolve(result);

    } catch (Exception e) {
      call.reject("Erro ao buscar notificações: " + e.getMessage());
    }
  }

  @PluginMethod
  public void addListener(PluginCall call) {
    call.resolve();
  }

  public void emitNotification(JSObject payload) {
    notifyListeners("notificationReceived", payload);
  }

  @Override
  protected void handleOnStart() {
    super.handleOnStart();
    Log.d(TAG, "handleOnStart chamado");
  }
}
