// TESTE2
package com.budget.plugins.notificationreader;

import android.content.pm.ResolveInfo;
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

import java.util.List;

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
        if (sbn == null || sbn.getNotification() == null)
          continue;

        JSObject notif = new JSObject();
        notif.put("package", sbn.getPackageName());

        CharSequence titleChar = sbn.getNotification().extras.getCharSequence("android.title");
        CharSequence textChar = sbn.getNotification().extras.getCharSequence("android.text");

        notif.put("title", titleChar != null ? titleChar.toString() : "");
        notif.put("text", textChar != null ? textChar.toString() : "");

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
        packageName  = parts[0];
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
      packageName  = appPackageName;
      activityName = null; // ✅ Correção fundamental!
      Log.d(TAG, "[openApp] Nome recebido é apenas o package: " + packageName);
    }

    PackageManager pm = getActivity().getPackageManager();

    // 1. Tentativa com getLaunchIntentForPackage
    Log.d(TAG, "[openApp] Tentando getLaunchIntentForPackage...");
    Intent launchIntent = pm.getLaunchIntentForPackage(packageName);
    if (launchIntent != null) {
      Log.d(TAG, "[openApp] → getLaunchIntentForPackage retornou intent válida:");
      Log.d(TAG, "[openApp] → Intent = " + launchIntent.toString());
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getActivity().startActivity(launchIntent);
      Log.d(TAG, "[openApp] → Aplicativo iniciado com sucesso via getLaunchIntent.");
      call.resolve();
      return;
    } else {
      Log.w(TAG, "[openApp] → getLaunchIntentForPackage retornou null.");
    }

    // 2. Fallback automático: procurar activity MAIN/LAUNCHER
    Log.d(TAG, "[openApp] Tentando fallback com queryIntentActivities...");
    Intent intent = new Intent(Intent.ACTION_MAIN, null);
    intent.addCategory(Intent.CATEGORY_LAUNCHER);
    List<ResolveInfo> apps = pm.queryIntentActivities(intent, 0);

    for (ResolveInfo resolveInfo : apps) {
      if (resolveInfo.activityInfo.packageName.equals(packageName)) {
        String mainActivity = resolveInfo.activityInfo.name;
        Log.d(TAG, "[openApp] → MAIN/LAUNCHER encontrada:");
        Log.d(TAG, "[openApp] → package: " + packageName);
        Log.d(TAG, "[openApp] → activity: " + mainActivity);

        Intent fallbackIntent = new Intent();
        fallbackIntent.setComponent(new android.content.ComponentName(packageName, mainActivity));
        fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(fallbackIntent);
        Log.d(TAG, "[openApp] → Aplicativo iniciado com sucesso via fallback.");
        call.resolve();
        return;
      }
    }

    Log.w(TAG, "[openApp] Nenhuma MAIN/LAUNCHER encontrada via queryIntentActivities para: " + packageName);

    // 3. Tentativa final: abrir activity diretamente se explicitamente fornecida
    if (isExplicitActivity && activityName != null) {
      Log.d(TAG, "[openApp] Tentando iniciar activity diretamente: " + activityName);
      try {
        Intent directIntent = new Intent();
        directIntent.setComponent(new android.content.ComponentName(packageName, activityName));
        directIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(directIntent);
        Log.d(TAG, "[openApp] → Aplicativo iniciado com sucesso via activity direta.");
        call.resolve();
        return;
      } catch (Exception e) {
        Log.e(TAG, "[openApp] Erro ao iniciar activity direta: " + activityName, e);
      }
    }

    Log.e(TAG, "[openApp] Todas as tentativas falharam para abrir: " + appPackageName);
    call.reject("Não foi possível abrir o aplicativo: " + appPackageName);
  }
}
