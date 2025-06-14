package com.fritsjohnny.budgetnotifier;

import android.content.Context;
import android.util.Log;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "BudgetNotifier")
public class BudgetNotifierPlugin extends Plugin {

    private static final String WORK_NAME = "DailyExpenseNotification";

    @Override
    public void load() {
        super.load();
        Log.d("BudgetNotifier", "Plugin carregado. Agendando notificações...");

        Context context = getContext();

        PeriodicWorkRequest workRequest = new PeriodicWorkRequest.Builder(
                DailyNotificationWorker.class,
                24, TimeUnit.HOURS
        )
        .setInitialDelay(1, TimeUnit.MINUTES) // ajustável para testes
        .setConstraints(new Constraints.Builder().build())
        .build();

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
        );
    }

    public String echo(String value) {
        return value;
    }
}
