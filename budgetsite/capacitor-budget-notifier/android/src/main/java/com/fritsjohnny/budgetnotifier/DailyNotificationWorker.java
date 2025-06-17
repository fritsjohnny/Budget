package com.fritsjohnny.budgetnotifier;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.text.NumberFormat;

public class DailyNotificationWorker extends Worker {
  private static final String TAG = "BudgetNotifier";
  private static final String CHANNEL_ID = "budget_channel";

  public DailyNotificationWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
    super(context, workerParams);
  }

  @NonNull
  @Override
  public Result doWork() {
    Log.d(TAG, ">>>>> doWork executado!");

    Context context = getApplicationContext();
    android.content.SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);

    String token = prefs.getString("auth_token", null);
    String baseUrl = prefs.getString("api_base_url", null);

    if (token == null || baseUrl == null) {
      Log.e(TAG, "Token ou baseUrl ausente no Preferences");
      return Result.failure();
    }

    try {
      URI uri = new URI(baseUrl + "/expenses/Notify?daysAhead=3");
      URL url = uri.toURL();
      HttpURLConnection connection = (HttpURLConnection) url.openConnection();
      connection.setRequestMethod("GET");
      connection.setRequestProperty("Authorization", "Bearer " + token);
      connection.setConnectTimeout(5000);
      connection.setReadTimeout(5000);

      int responseCode = connection.getResponseCode();
      Log.d(TAG, "Código da resposta: " + responseCode);

      if (responseCode != 200) {
        return Result.failure();
      }

      BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
      StringBuilder response = new StringBuilder();

      String line;

      while ((line = reader.readLine()) != null) {
        response.append(line);
      }

      reader.close();

      JSONArray expenses = new JSONArray(response.toString());

      Date today = new Date();

      SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
      SimpleDateFormat dateFormatter = new SimpleDateFormat("dd/MM/yyyy", Locale.forLanguageTag("pt-BR"));

      NumberFormat currencyFormatter = NumberFormat.getCurrencyInstance(Locale.getDefault());
      currencyFormatter.setMaximumFractionDigits(2);
      currencyFormatter.setMinimumFractionDigits(2);

      for (int i = 0; i < expenses.length(); i++) {
        JSONObject expense = expenses.getJSONObject(i);
        String description = expense.getString("description");
        double toPay = expense.getDouble("toPay");
        String dueDateStr = expense.getString("dueDate");

        Date dueDate = format.parse(dueDateStr);
        long diff = dueDate.getTime() - today.getTime();
        long diffDays = diff / (1000 * 60 * 60 * 24);

        String title;
        if (diffDays < 0) {
          title = "Despesa vencida";
        } else if (diffDays == 0) {
          title = "Despesa vence hoje";
        } else {
          title = "Despesa a vencer em " + diffDays + " dia" + (diffDays > 1 ? "s" : "");
        }

        String body = "🧾 " + description +
            "\n💸 " + currencyFormatter.format(toPay) +
            "\n🗓️ " + dateFormatter.format(dueDate);

        showNotification(title, body);
      }

      return Result.success();

    } catch (Exception e) {
      Log.e(TAG, "Erro ao buscar despesas ou agendar notificações", e);
      return Result.failure();
    }
  }

  private void showNotification(String title, String message) {
    NotificationManager notificationManager = (NotificationManager) getApplicationContext()
        .getSystemService(Context.NOTIFICATION_SERVICE);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
          CHANNEL_ID,
          "Notificações do Budget",
          NotificationManager.IMPORTANCE_HIGH);
      notificationManager.createNotificationChannel(channel);
    }

    Intent intent = getApplicationContext().getPackageManager()
        .getLaunchIntentForPackage(getApplicationContext().getPackageName());
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);

    PendingIntent pendingIntent = PendingIntent.getActivity(
        getApplicationContext(),
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    NotificationCompat.Builder builder = new NotificationCompat.Builder(getApplicationContext(), CHANNEL_ID)
        .setSmallIcon(R.mipmap.ic_budget_notification)
        .setContentTitle(title)
        .setContentText(message)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setDefaults(NotificationCompat.DEFAULT_ALL)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)
        .setStyle(new NotificationCompat.BigTextStyle().bigText(message));

    notificationManager.notify((int) System.currentTimeMillis(), builder.build());
  }
}
