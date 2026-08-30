package com.budget.plugins.notificationreader;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.getcapacitor.JSObject;

public class NotificationReaderService extends NotificationListenerService {

  public static final String ACTION_OPEN_CARD_NOTIFICATION = "com.budget.app.OPEN_CARD_NOTIFICATION";
  public static final String EXTRA_NOTIFICATION_PACKAGE = "notification_package";
  public static final String EXTRA_NOTIFICATION_TITLE = "notification_title";
  public static final String EXTRA_NOTIFICATION_TEXT = "notification_text";
  public static final String EXTRA_NOTIFICATION_RECEIVED_AT = "notification_received_at";

  private static final String TAG = "NotificationReaderService";
  private static final String CHANNEL_ID = "card-detection";
  private static final String CHANNEL_NAME = "Compras detectadas";
  private static final int NOTIFICATION_ID_SEED = 1400000000;
  private static final String PENDING_PREFERENCES_NAME = "notification_reader_pending";
  private static final String PENDING_PACKAGE_KEY = "package";
  private static final String PENDING_TITLE_KEY = "title";
  private static final String PENDING_TEXT_KEY = "text";
  private static final String PENDING_RECEIVED_AT_KEY = "receivedAt";

  private static NotificationReaderPlugin pluginInstance;
  private static NotificationReaderService serviceInstance;

  public static void registerPlugin(NotificationReaderPlugin plugin) {
    pluginInstance = plugin;
  }

  public static boolean isPluginLoaded() {
    return pluginInstance != null;
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
    JSObject payload = createPayload(sbn);

    if (payload == null) return;

    String packageName = payload.optString("package", "");
    String title = payload.optString("title", "");
    String text = payload.optString("text", "");

    if (!isSupportedCardNotification(packageName, title, text)) return;

    if (pluginInstance != null) {
      pluginInstance.emitNotification(payload);
    }

    showCardNotification(this, payload);
  }

  public static JSObject createPayload(StatusBarNotification sbn) {
    if (sbn == null || sbn.getNotification() == null) return null;

    CharSequence titleChar = sbn.getNotification().extras.getCharSequence("android.title");
    CharSequence textChar = sbn.getNotification().extras.getCharSequence("android.text");

    JSObject payload = new JSObject();
    payload.put("package", sbn.getPackageName());
    payload.put("title", titleChar != null ? titleChar.toString() : "");
    payload.put("text", textChar != null ? textChar.toString() : "");
    payload.put(
      "receivedAt",
      sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis()
    );

    return payload;
  }

  public static JSObject getPendingNotification(Intent intent) {
    return getPendingNotificationFromIntent(intent);
  }

  public static JSObject getPendingNotification(Context context, Intent intent) {
    JSObject fromIntent = getPendingNotificationFromIntent(intent);
    if (fromIntent != null) return fromIntent;

    if (context == null) return null;

    android.content.SharedPreferences preferences = context.getSharedPreferences(
      PENDING_PREFERENCES_NAME,
      Context.MODE_PRIVATE
    );
    String packageName = preferences.getString(PENDING_PACKAGE_KEY, null);
    String text = preferences.getString(PENDING_TEXT_KEY, null);

    if (packageName == null || text == null) return null;

    JSObject payload = new JSObject();
    payload.put("package", packageName);
    payload.put("title", preferences.getString(PENDING_TITLE_KEY, ""));
    payload.put("text", text);
    payload.put(
      "receivedAt",
      preferences.getLong(PENDING_RECEIVED_AT_KEY, System.currentTimeMillis())
    );

    return payload;
  }

  public static void storePendingNotification(Context context, Intent intent) {
    JSObject payload = getPendingNotificationFromIntent(intent);
    if (context == null || payload == null) return;

    context.getSharedPreferences(PENDING_PREFERENCES_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(PENDING_PACKAGE_KEY, payload.optString("package", ""))
      .putString(PENDING_TITLE_KEY, payload.optString("title", ""))
      .putString(PENDING_TEXT_KEY, payload.optString("text", ""))
      .putLong(PENDING_RECEIVED_AT_KEY, payload.optLong("receivedAt", System.currentTimeMillis()))
      .apply();
  }

  private static JSObject getPendingNotificationFromIntent(Intent intent) {
    if (intent == null || !ACTION_OPEN_CARD_NOTIFICATION.equals(intent.getAction())) {
      return null;
    }

    String packageName = intent.getStringExtra(EXTRA_NOTIFICATION_PACKAGE);
    String title = intent.getStringExtra(EXTRA_NOTIFICATION_TITLE);
    String text = intent.getStringExtra(EXTRA_NOTIFICATION_TEXT);

    if (packageName == null || text == null) return null;

    JSObject payload = new JSObject();
    payload.put("package", packageName);
    payload.put("title", title != null ? title : "");
    payload.put("text", text);
    payload.put("receivedAt", intent.getLongExtra(
      EXTRA_NOTIFICATION_RECEIVED_AT,
      System.currentTimeMillis()
    ));

    return payload;
  }

  public static void clearCardNotifications(Context context) {
    Context notificationContext = serviceInstance != null ? serviceInstance : context;
    if (notificationContext == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;

    NotificationManager manager = (NotificationManager) notificationContext.getSystemService(
      Context.NOTIFICATION_SERVICE
    );
    if (manager == null) return;

    StatusBarNotification[] activeNotifications = serviceInstance != null
      ? serviceInstance.getActiveNotifications()
      : manager.getActiveNotifications();

    for (StatusBarNotification sbn : activeNotifications) {
      boolean samePackage = notificationContext.getPackageName().equals(sbn.getPackageName());
      boolean sameChannel = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
        CHANNEL_ID.equals(sbn.getNotification().getChannelId());

      if (samePackage && sameChannel) {
        manager.cancel(sbn.getId());
      }
    }
  }

  public static void repostCardNotification(Context context, JSObject payload) {
    Context notificationContext = serviceInstance != null ? serviceInstance : context;
    if (notificationContext == null) {
      Log.w(TAG, "Contexto indisponível para republicação.");
      return;
    }

    showCardNotification(notificationContext, payload);
  }

  public static void clearPendingNotification(Intent intent) {
    if (intent == null) return;

    intent.removeExtra(EXTRA_NOTIFICATION_PACKAGE);
    intent.removeExtra(EXTRA_NOTIFICATION_TITLE);
    intent.removeExtra(EXTRA_NOTIFICATION_TEXT);
    intent.removeExtra(EXTRA_NOTIFICATION_RECEIVED_AT);

    if (ACTION_OPEN_CARD_NOTIFICATION.equals(intent.getAction())) {
      intent.setAction(null);
    }
  }

  public static void clearPendingNotification(Context context, Intent intent) {
    clearPendingNotification(intent);

    if (context != null) {
      context.getSharedPreferences(PENDING_PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit()
        .clear()
        .apply();
    }
  }

  public static void handleNotificationIntent(Intent intent) {
    JSObject payload = getPendingNotification(intent);

    if (payload != null && pluginInstance != null) {
      pluginInstance.emitNotificationOpened(payload);
    }
  }

  private boolean isSupportedCardNotification(String packageName, String title, String text) {
    String normalizedPackage = packageName.toLowerCase();
    String normalizedTitle = title.toLowerCase();
    String normalizedText = text.toLowerCase();

    boolean hasAmount = normalizedText.contains("r$");

    return (normalizedPackage.contains("picpay") && hasAmount) ||
      (normalizedPackage.contains("c6") && hasAmount) ||
      (normalizedPackage.equals("com.nu.production") && hasAmount) ||
      (normalizedTitle.contains("cashback") && hasAmount) ||
      (normalizedTitle.contains("crédito") && normalizedText.contains("no valor de r$")) ||
      normalizedText.contains("cartao amazon") ||
      normalizedText.contains("cartão amazon");
  }

  private static void showCardNotification(Context context, JSObject payload) {
    try {
      NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

      if (manager == null || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N &&
          !manager.areNotificationsEnabled())) {
        Log.w(TAG, "Notificações do Budget estão desativadas no Android.");
        return;
      }

      createNotificationChannel(manager);

      String packageName = payload.optString("package", "");
      String title = payload.optString("title", "");
      String text = payload.optString("text", "");
      long receivedAt = payload.optLong("receivedAt", System.currentTimeMillis());

      Intent launcherIntent = context.getPackageManager().getLaunchIntentForPackage(
        context.getPackageName()
      );

      if (launcherIntent == null || launcherIntent.getComponent() == null) {
        Log.w(TAG, "Não foi possível localizar a Activity principal do BudgetApp.");
        return;
      }

      Intent notificationIntent = new Intent();
      notificationIntent.setComponent(launcherIntent.getComponent());
      notificationIntent.setAction(ACTION_OPEN_CARD_NOTIFICATION);
      notificationIntent.putExtra(EXTRA_NOTIFICATION_PACKAGE, packageName);
      notificationIntent.putExtra(EXTRA_NOTIFICATION_TITLE, title);
      notificationIntent.putExtra(EXTRA_NOTIFICATION_TEXT, text);
      notificationIntent.putExtra(EXTRA_NOTIFICATION_RECEIVED_AT, receivedAt);
      notificationIntent.addFlags(
        Intent.FLAG_ACTIVITY_CLEAR_TOP |
        Intent.FLAG_ACTIVITY_SINGLE_TOP
      );

      int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
      }

      int requestCode = (text + "|" + receivedAt).hashCode() & 0x7fffffff;
      if (requestCode == 0) requestCode = NOTIFICATION_ID_SEED;

      PendingIntent pendingIntent = PendingIntent.getActivity(
        context,
        requestCode,
        notificationIntent,
        pendingIntentFlags
      );

      String contentText = text.isEmpty() ? title : text;
      if (contentText.length() > 160) {
        contentText = contentText.substring(0, 157) + "...";
      }

      Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ? new Notification.Builder(context, CHANNEL_ID)
        : new Notification.Builder(context);

      builder
        .setSmallIcon(context.getApplicationInfo().icon != 0
          ? context.getApplicationInfo().icon
          : android.R.drawable.ic_dialog_info)
        .setContentTitle("Compra detectada")
        .setContentText(contentText)
        .setStyle(new Notification.BigTextStyle().bigText(contentText))
        .setWhen(receivedAt)
        .setShowWhen(true)
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)
        .setPriority(Notification.PRIORITY_HIGH);

      manager.notify(requestCode, builder.build());
    } catch (SecurityException error) {
      Log.e(TAG, "Sem permissão para exibir a notificação do Budget.", error);
    } catch (Exception error) {
      Log.e(TAG, "Erro ao exibir notificação de compra detectada.", error);
    }
  }

  private static void createNotificationChannel(NotificationManager manager) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_HIGH
    );
    channel.setDescription("Notificações de compras identificadas nos aplicativos de cartão.");
    manager.createNotificationChannel(channel);
  }

  public static StatusBarNotification[] fetchActiveNotifications() {
    if (serviceInstance != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      return serviceInstance.getActiveNotifications();
    }

    return null;
  }
}
