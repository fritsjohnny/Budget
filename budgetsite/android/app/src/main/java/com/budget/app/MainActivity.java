package com.budget.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import androidx.core.view.WindowCompat;
import com.budget.plugins.safearea.SafeAreaPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Faz o conteúdo respeitar status/navigation bars
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    registerPlugin(SafeAreaPlugin.class);
  }
}
