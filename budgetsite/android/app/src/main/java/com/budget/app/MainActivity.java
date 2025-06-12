package com.budget.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Deixa o Android ajustar as barras de sistema corretamente
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
  }
}
