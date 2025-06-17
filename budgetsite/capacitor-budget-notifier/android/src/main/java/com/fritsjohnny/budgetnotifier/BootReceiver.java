package com.fritsjohnny.budgetnotifier;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

public class BootReceiver extends BroadcastReceiver {

    private static final String WORK_NAME = "DailyExpenseNotification";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d("BudgetNotifier", "BootReceiver acionado: " + intent.getAction());

        PeriodicWorkRequest workRequest = new PeriodicWorkRequest.Builder(
                DailyNotificationWorker.class,
                24, TimeUnit.HOURS)
                .setInitialDelay(10, TimeUnit.SECONDS) // ou 5s pra teste
                .setConstraints(new Constraints.Builder().build())
                .build();

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.REPLACE,
                workRequest
        );
    }
}
