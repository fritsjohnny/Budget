package com.budget.plugins.notificationreader;

import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.annotation.CapacitorPlugin;

import androidx.annotation.RequiresApi;

import android.content.Intent;
import android.content.pm.PackageManager;

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
        JSObject payload = NotificationReaderService.createPayload(sbn);

        if (payload != null) {
          notifications.put(payload);
        }
      }

      JSObject result = new JSObject();
      result.put("notifications", notifications);
      call.resolve(result);

    } catch (Exception e) {
      call.reject("Erro ao buscar notificações: " + e.getMessage());
    }
  }

  @PluginMethod
  public void getPendingNotification(PluginCall call) {
    JSObject result = new JSObject();
    JSObject notification = NotificationReaderService.getPendingNotification(
      getActivity().getApplicationContext(),
      getActivity().getIntent()
    );

    if (notification != null) {
      result.put("notification", notification);
    }

    call.resolve(result);
  }

  @PluginMethod
  public void repostNotifications(PluginCall call) {
    try {
      JSArray payloads = call.getArray("notifications", new JSArray());
      Context context = getActivity().getApplicationContext();
      NotificationReaderService.clearCardNotifications(context);

      for (int index = 0; index < payloads.length(); index++) {
        org.json.JSONObject source = payloads.getJSONObject(index);
        JSObject payload = new JSObject();
        payload.put("package", source.optString("package", ""));
        payload.put("title", source.optString("title", ""));
        payload.put("text", source.optString("text", ""));
        payload.put("receivedAt", source.optLong("receivedAt", System.currentTimeMillis()));
        NotificationReaderService.repostCardNotification(context, payload);
      }

      call.resolve();
    } catch (Exception error) {
      call.reject("Erro ao republicar notificações: " + error.getMessage());
    }
  }

  @PluginMethod
  public void clearPendingNotification(PluginCall call) {
    NotificationReaderService.clearPendingNotification(
      getActivity().getApplicationContext(),
      getActivity().getIntent()
    );
    call.resolve();
  }

  @PluginMethod
  public void addListener(PluginCall call) {
    call.resolve();
  }

  public void emitNotification(JSObject payload) {
    notifyListeners("notificationReceived", payload);
  }

  public void emitNotificationOpened(JSObject payload) {
    notifyListeners("cardNotificationOpened", payload, true);

    final String payloadJson = payload.toString();
    getActivity().runOnUiThread(() -> {
      if (getBridge() == null || getBridge().getWebView() == null) return;

      getBridge().getWebView().evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('native-card-notification-opened',{detail:" +
          payloadJson +
          "}));",
        null
      );
    });
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
      Log.w(TAG, "[openApp] AppPackageName não informado.");
      call.reject("AppPackageName não informado");
      return;
    }

    Log.d(TAG, "[openApp] Valor recebido: " + appPackageName);

    String packageName;
    String activityName;
    boolean isExplicitActivity = appPackageName.contains("/");

    if (isExplicitActivity) {
      String[] parts = appPackageName.split("/");
      if (parts.length == 2) {
        packageName = parts[0];
        activityName = parts[1].startsWith(".") ? parts[0] + parts[1] : parts[1];

        Log.d(TAG, "[openApp] Detecção: pacote + activity explícitos:");
        Log.d(TAG, "[openApp] → packageName  = " + packageName);
        Log.d(TAG, "[openApp] → activityName = " + activityName);
      } else {
        Log.w(TAG, "[openApp] Formato inválido para nome completo: " + appPackageName);
        call.reject("Formato inválido para AppPackageName");
        return;
      }
    } else {
      packageName = appPackageName;
      activityName = null;
      Log.d(TAG, "[openApp] Nome recebido é apenas o package: " + packageName);
    }

    PackageManager pm = getActivity().getPackageManager();

    Log.d(TAG, "[openApp] Tentando getLaunchIntentForPackage...");
    Intent launchIntent = pm.getLaunchIntentForPackage(packageName);
    if (launchIntent != null) {
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getActivity().startActivity(launchIntent);
      Log.d(TAG, "[openApp] → Aplicativo iniciado via getLaunchIntent.");
      JSObject result = new JSObject();
      result.put("status", "success");
      result.put("method", "getLaunchIntent");
      result.put("package", packageName);
      result.put("activity", launchIntent.getComponent() != null ? launchIntent.getComponent().getClassName() : null);
      call.resolve(result);
      return;
    }

    if (isExplicitActivity && activityName != null) {
      Log.d(TAG, "[openApp] Tentando iniciar activity diretamente: " + activityName);
      try {
        Intent directIntent = new Intent();
        directIntent.setComponent(new ComponentName(packageName, activityName));
        directIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(directIntent);

        JSObject result = new JSObject();
        result.put("status", "success");
        result.put("method", "direct");
        result.put("package", packageName);
        result.put("activity", activityName);
        call.resolve(result);
        return;
      } catch (Exception e) {
        Log.e(TAG, "[openApp] Erro ao iniciar activity direta: " + activityName, e);
      }
    }

    Log.e(TAG, "[openApp] Todas as tentativas falharam para abrir: " + appPackageName);
    call.reject("Não foi possível abrir o aplicativo: " + appPackageName);
  }
}
