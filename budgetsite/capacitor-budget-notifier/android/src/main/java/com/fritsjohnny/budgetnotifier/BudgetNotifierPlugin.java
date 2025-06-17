package com.fritsjohnny.budgetnotifier;

import android.content.Context;
import android.util.Log;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;

import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "BudgetNotifierPlugin")
public class BudgetNotifierPlugin extends Plugin {

  private static final String WORK_NAME = "DailyExpenseNotification";

  @Override
  public void load() {
    super.load();
    Log.d("BudgetNotifier", "Plugin carregado. Agendando notificações...");

    Context context = getContext();

    PeriodicWorkRequest workRequest = new PeriodicWorkRequest.Builder(
        DailyNotificationWorker.class,
        24, TimeUnit.HOURS)
        .setInitialDelay(1, TimeUnit.MINUTES) // ajustável para testes
        .setConstraints(new Constraints.Builder().build())
        .build();

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        WORK_NAME,
        ExistingPeriodicWorkPolicy.KEEP,
        workRequest);
  }

  @PluginMethod
  public void schedule(PluginCall call) {
    Context context = getContext();

    PeriodicWorkRequest workRequest = new PeriodicWorkRequest.Builder(
        DailyNotificationWorker.class,
        24, TimeUnit.HOURS)
        .build();

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        WORK_NAME,
        ExistingPeriodicWorkPolicy.REPLACE,
        workRequest);

    JSObject ret = new JSObject();
    ret.put("success", true);
    call.resolve(ret);
  }

  public String echo(String value) {
    return value;
  }

  @PluginMethod
    public void echo(PluginCall call) {
        String value = call.getString("value");

        JSObject ret = new JSObject();
        ret.put("value", value);
        call.resolve(ret);
    }
}
