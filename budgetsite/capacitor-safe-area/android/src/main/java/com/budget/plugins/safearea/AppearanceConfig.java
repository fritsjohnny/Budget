package com.budget.plugins.safearea;

import org.json.JSONObject;

public class AppearanceConfig {
    public boolean customColorsForSystemBars = true;
    public String statusBarColor = "#000000";
    public String statusBarContent = "light";
    public String navigationBarColor = "#000000";
    public String navigationBarContent = "light";

    public AppearanceConfig(JSONObject json) {
        if (json != null) {
            if (json.has("customColorsForSystemBars")) {
                customColorsForSystemBars = json.optBoolean("customColorsForSystemBars", true);
            }
            if (json.has("statusBarColor")) {
                statusBarColor = json.optString("statusBarColor", "#000000");
            }
            if (json.has("statusBarContent")) {
                statusBarContent = json.optString("statusBarContent", "light");
            }
            if (json.has("navigationBarColor")) {
                navigationBarColor = json.optString("navigationBarColor", "#000000");
            }
            if (json.has("navigationBarContent")) {
                navigationBarContent = json.optString("navigationBarContent", "light");
            }
        }
    }
}
