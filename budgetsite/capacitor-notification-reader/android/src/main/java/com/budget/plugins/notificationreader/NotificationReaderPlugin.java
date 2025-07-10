// TESTE
package com.budget.plugins.notificationreader;

import android.os.Build;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.content.Intent;
import android.content.pm.PackageManager;

import androidx.annotation.RequiresApi;

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

  @RequiresApi(api = Build.VERSION_CODES.N)
  @PluginMethod
  public void openApp(PluginCall call) {
    String appPackageName = call.getString("package");

    if (appPackageName == null || appPackageName.isEmpty()) {
      call.reject("AppPackageName não informado");
      return;
    }

    // Se tiver "." mais de uma vez (ex: com.mercadopago.wallet.splash.SplashActivity), divide:
    String packageName;
    String activityName = null;

    if (appPackageName.contains("/") || appPackageName.chars().filter(ch -> ch == '.').count() > 2) {
      int lastDot = appPackageName.lastIndexOf('.');
      int secondLastDot = appPackageName.substring(0, lastDot).lastIndexOf('.');

      if (secondLastDot > 0) {
        packageName = appPackageName.substring(0, secondLastDot);
        activityName = appPackageName.substring(0, lastDot) + "." + appPackageName.substring(lastDot + 1);
      } else {
        call.reject("Formato inválido para AppPackageName");
        return;
      }
    } else {
      packageName = appPackageName;
    }

    PackageManager pm = getActivity().getPackageManager();

    // Primeira tentativa: getLaunchIntentForPackage
    if (activityName == null) {
      Intent intent = pm.getLaunchIntentForPackage(packageName);
      if (intent != null) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(intent);
        call.resolve();
        return;
      }
    }

    // Segunda tentativa: usar activity diretamente se fornecida
    if (activityName != null) {
      try {
        Intent directIntent = new Intent();
        directIntent.setComponent(new android.content.ComponentName(packageName, activityName));
        directIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(directIntent);
        call.resolve();
        return;
      } catch (Exception e) {
        Log.e(TAG, "Erro ao iniciar activity direta: " + activityName, e);
      }
    }

    call.reject("Não foi possível abrir o aplicativo: " + appPackageName);
  }
}
