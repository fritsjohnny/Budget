package com.fritsjohnny.budgetnotifier;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import android.util.Log;

public class DailyNotificationWorker extends Worker {

  private static final String CHANNEL_ID = "budget_channel";

  public DailyNotificationWorker(@NonNull Context context, @NonNull WorkerParameters params) {
    super(context, params);
  }

  @NonNull
  @Override
  public Result doWork() {
    Log.d("BudgetNotifier", ">>>>> doWork executado!");
    showNotification("Lembrete", "Você tem contas para revisar hoje!");
    return Result.success();
  }

  private void showNotification(String title, String message) {
    NotificationManager notificationManager = (NotificationManager) getApplicationContext()
        .getSystemService(Context.NOTIFICATION_SERVICE);

    // Cria canal para Android 8+
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
          CHANNEL_ID,
          "Notificações do Budget",
          NotificationManager.IMPORTANCE_HIGH // <= este é o ponto
      );
      notificationManager.createNotificationChannel(channel);
    }

    NotificationCompat.Builder builder = new NotificationCompat.Builder(getApplicationContext(), CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentTitle(title)
        .setContentText(message)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setDefaults(NotificationCompat.DEFAULT_ALL) // som + vibração
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setAutoCancel(true);

    notificationManager.notify(1, builder.build());
  }
}
