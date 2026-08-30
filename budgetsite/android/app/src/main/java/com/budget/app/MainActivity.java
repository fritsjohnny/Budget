package com.budget.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.budget.plugins.safearea.SafeAreaPlugin;
import com.budget.plugins.notificationreader.NotificationReaderService;
import com.getcapacitor.BridgeActivity;

import androidx.core.view.WindowCompat;

public class MainActivity extends BridgeActivity {
  private static final long NOTIFICATION_INTENT_DISPATCH_DELAY_MS = 600L;
  private final Handler notificationIntentHandler = new Handler(Looper.getMainLooper());

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

    registerPlugin(SafeAreaPlugin.class);
    NotificationReaderService.storePendingNotification(this, getIntent());
    dispatchPendingNotificationIntent(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    setIntent(intent);
    super.onNewIntent(intent);
    NotificationReaderService.storePendingNotification(this, intent);
    dispatchPendingNotificationIntent(intent);
  }

  private void dispatchPendingNotificationIntent(Intent intent) {
    if (intent == null ||
        !NotificationReaderService.ACTION_OPEN_CARD_NOTIFICATION.equals(intent.getAction())) {
      return;
    }

    notificationIntentHandler.postDelayed(
      () -> NotificationReaderService.handleNotificationIntent(intent),
      NOTIFICATION_INTENT_DISPATCH_DELAY_MS
    );
  }
}
