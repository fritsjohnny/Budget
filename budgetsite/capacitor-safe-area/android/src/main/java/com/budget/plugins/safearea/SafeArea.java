package com.budget.plugins.safearea;

import android.app.Activity;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import android.webkit.WebView;
import android.view.WindowManager;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.budget.plugins.safearea.AppearanceConfig;

public class SafeArea {
    private final Activity activity;
    private final WebView webView;
    public int offset = 0;
    private boolean appearanceUpdatedInListener = false;
    private boolean decorFitsSystemWindowsNegated = false;

    public SafeArea(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    public void enable(boolean updateInsets, AppearanceConfig appearanceConfig) {
        View decorView = activity.getWindow().getDecorView().getRootView();

        decorView.setOnApplyWindowInsetsListener((v, insets) -> {
            updateInsets();
            if (!appearanceUpdatedInListener) {
                updateAppearance(appearanceConfig);
                appearanceUpdatedInListener = true;
            }
            return v.onApplyWindowInsets(insets);
        });

        resetDecorFitsSystemWindows();
        updateAppearance(appearanceConfig);

        if (updateInsets) {
            updateInsets();
        }
    }

    public void disable(AppearanceConfig appearanceConfig) {
        activity.runOnUiThread(() -> {
            WindowCompat.setDecorFitsSystemWindows(activity.getWindow(), true);
            activity.getWindow().getDecorView().getRootView().setOnApplyWindowInsetsListener(null);
            resetProperties();
            updateAppearance(appearanceConfig);
        });
    }

    public void resetDecorFitsSystemWindows() {
        decorFitsSystemWindowsNegated = false;
    }

    private void updateAppearance(AppearanceConfig config) {
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());

            controller.setAppearanceLightStatusBars("dark".equals(config.statusBarContent));
            controller.setAppearanceLightNavigationBars("dark".equals(config.navigationBarContent));

            if (config.customColorsForSystemBars) {
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                window.setStatusBarColor(Color.parseColor(config.statusBarColor));
                window.setNavigationBarColor(Color.parseColor(config.navigationBarColor));
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            }
        });
    }

    private void updateInsets() {
        activity.runOnUiThread(() -> {
            if (!decorFitsSystemWindowsNegated) {
                decorFitsSystemWindowsNegated = true;
                WindowCompat.setDecorFitsSystemWindows(activity.getWindow(), false);
            }

            WindowInsetsCompat windowInsets = ViewCompat.getRootWindowInsets(activity.getWindow().getDecorView());
            Insets systemBarsInsets = (windowInsets != null) ? windowInsets.getInsets(WindowInsetsCompat.Type.systemBars()) : Insets.NONE;
            Insets imeInsets = (windowInsets != null) ? windowInsets.getInsets(WindowInsetsCompat.Type.ime()) : Insets.NONE;

            float density = activity.getResources().getDisplayMetrics().density;

            setProperty("top", Math.round(systemBarsInsets.top / density) + offset);
            setProperty("left", Math.round(systemBarsInsets.left / density));
            if (imeInsets.bottom > 0) {
                setProperty("bottom", 0);
            } else {
                setProperty("bottom", Math.round(systemBarsInsets.bottom / density) + offset);
            }
            setProperty("right", Math.round(systemBarsInsets.right / density));

            int navBarHeight = systemBarsInsets.bottom;
            int imeHeight = Math.max(imeInsets.bottom - navBarHeight, navBarHeight);
            int statusBarHeight = systemBarsInsets.top;

            activity.getWindow().getDecorView().setPadding(0, statusBarHeight, 0, imeHeight);
        });
    }

    private void resetProperties() {
        setProperty("top", 0);
        setProperty("left", 0);
        setProperty("bottom", 0);
        setProperty("right", 0);
    }

    private void setProperty(String position, int size) {
        activity.runOnUiThread(() -> {
            String js = String.format(
                "javascript:document.querySelector(':root')?.style.setProperty('--safe-area-inset-%s', 'max(env(safe-area-inset-%s), %dpx)');void(0);",
                position, position, size
            );
            webView.loadUrl(js);
        });
    }

    public void setOffset(int offset) {
        this.offset = offset;
    }
}
