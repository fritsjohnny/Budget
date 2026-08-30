package com.budget.plugins.notificationreader;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

public class NotificationClickActivity extends Activity {

  private static final long NOTIFICATION_EVENT_DELAY_MS = 600L;
  private final Handler handler = new Handler(Looper.getMainLooper());

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    Intent notificationIntent = getIntent();

    if (NotificationReaderService.isPluginLoaded()) {
      handler.postDelayed(
        () -> NotificationReaderService.handleNotificationIntent(notificationIntent),
        NOTIFICATION_EVENT_DELAY_MS
      );
      handler.postDelayed(this::finish, NOTIFICATION_EVENT_DELAY_MS + 200L);
      return;
    }

    Intent launcherIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());

    if (launcherIntent == null || launcherIntent.getComponent() == null) {
      finish();
      return;
    }

    Intent launchIntent = new Intent();
    launchIntent.setComponent(launcherIntent.getComponent());
    launchIntent.setAction(NotificationReaderService.ACTION_OPEN_CARD_NOTIFICATION);
    launchIntent.putExtra(
      NotificationReaderService.EXTRA_NOTIFICATION_PACKAGE,
      notificationIntent.getStringExtra(
        NotificationReaderService.EXTRA_NOTIFICATION_PACKAGE
      )
    );
    launchIntent.putExtra(
      NotificationReaderService.EXTRA_NOTIFICATION_TITLE,
      notificationIntent.getStringExtra(
        NotificationReaderService.EXTRA_NOTIFICATION_TITLE
      )
    );
    launchIntent.putExtra(
      NotificationReaderService.EXTRA_NOTIFICATION_TEXT,
      notificationIntent.getStringExtra(
        NotificationReaderService.EXTRA_NOTIFICATION_TEXT
      )
    );
    launchIntent.putExtra(
      NotificationReaderService.EXTRA_NOTIFICATION_RECEIVED_AT,
      notificationIntent.getLongExtra(
        NotificationReaderService.EXTRA_NOTIFICATION_RECEIVED_AT,
        System.currentTimeMillis()
      )
    );
    launchIntent.addFlags(
      Intent.FLAG_ACTIVITY_CLEAR_TOP |
      Intent.FLAG_ACTIVITY_SINGLE_TOP
    );

    startActivity(launchIntent);
    finish();
  }
}
