package com.fritsjohnny.budgetnotifier;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;
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
import java.text.NumberFormat;
import java.util.Date;
import java.util.Locale;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

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

    Log.d(TAG, "Limpando notificações antigas...");
    limparDiasAntigos();
    Log.d(TAG, "Notificações antigas limpas.");

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
        Log.e(TAG, "Erro ao buscar despesas: Código de resposta " + responseCode);
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

        if (dueDateStr == null || dueDateStr.isEmpty()) {
          Log.w(TAG, "Data de vencimento ausente para a despesa: " + description);
          continue;
        }

        Date dueDate = format.parse(dueDateStr);
        // Zera hora, minuto, segundo e millis de ambas as datas
        SimpleDateFormat dayFormatter = new SimpleDateFormat("yyyyMMdd", Locale.getDefault());
        Date cleanToday = dayFormatter.parse(dayFormatter.format(today));
        Date cleanDueDate = dayFormatter.parse(dayFormatter.format(dueDate));

        long diff = cleanDueDate.getTime() - cleanToday.getTime();
        long diffDays = diff / (1000 * 60 * 60 * 24);

        String title;
        if (diffDays < 0) {
          if (diffDays == -1) {
            title = "Despesa venceu ontem";
          } else {
            title = "Despesa vencida há " + Math.abs(diffDays) + " dias";
          }
        } else if (diffDays == 0) {
          title = "Despesa vence hoje";
        } else {
          title = "Despesa a vencer em " + diffDays + " dia" + (diffDays > 1 ? "s" : "");
        }

        String body = "🧾 " + description +
            "\n💸 " + currencyFormatter.format(toPay) +
            "\n🗓️ " + dateFormatter.format(dueDate);

        SimpleDateFormat keyFormatter = new SimpleDateFormat("yyyyMMdd", Locale.getDefault());
        String dataHoje = keyFormatter.format(today);
        String dataVenc = keyFormatter.format(dueDate);

        // Gera um ID numérico consistente a partir da string única
        int expenseId = expense.getInt("id");

        String uniqueKey = expenseId + "_" + dataVenc + "_" + dataHoje;
        Log.d(TAG, "Chave única da notificação: " + uniqueKey);

        // Evita notificação duplicada no mesmo dia
        if (foiNotificacaoExibidaHoje(uniqueKey)) {
          Log.d(TAG, "🔁 Notificação já exibida hoje: " + uniqueKey);
          continue;
        }

        int notificationId = uniqueKey.hashCode();
        Log.d(TAG, "🔔 Exibindo notificação: " + title + " - ID: " + notificationId);
        showNotification(title, body, notificationId);
        Log.d(TAG, "Notificação exibida: " + title + " - ID: " + notificationId);
        marcarNotificacaoComoExibidaHoje(uniqueKey);
        Log.d(TAG, "Notificação marcada como exibida: " + uniqueKey);
      }

      return Result.success();

    } catch (Exception e) {
      Log.e(TAG, "Erro ao buscar despesas ou agendar notificações", e);
      return Result.failure();
    }
  }

  private void showNotification(String title, String message, int notificationId) {
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

    notificationManager.notify(notificationId, builder.build());
  }

  private boolean foiNotificacaoExibidaHoje(String key) {
    SharedPreferences prefs = getApplicationContext().getSharedPreferences("NotificacoesExibidas",
        Context.MODE_PRIVATE);

    String hoje = new SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(new Date());

    return prefs.getStringSet(hoje, new HashSet<>()).contains(key);
  }

  private void marcarNotificacaoComoExibidaHoje(String key) {
    SharedPreferences prefs = getApplicationContext().getSharedPreferences("NotificacoesExibidas",
        Context.MODE_PRIVATE);

    String hoje = new SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(new Date());

    Set<String> exibidas = new HashSet<>(prefs.getStringSet(hoje, new HashSet<>()));

    exibidas.add(key);

    prefs.edit().putStringSet(hoje, exibidas).apply();
  }

  private void limparDiasAntigos() {
    SharedPreferences prefs = getApplicationContext().getSharedPreferences("NotificacoesExibidas",
        Context.MODE_PRIVATE);
    String hoje = new SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(new Date());

    Map<String, ?> todas = prefs.getAll();
    for (String key : todas.keySet()) {
      if (!key.equals(hoje)) {
        prefs.edit().remove(key).apply();
      }
    }
  }

}
