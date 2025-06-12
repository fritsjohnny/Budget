package com.budget.plugins.safearea;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.budget.plugins.safearea.SafeArea;

import org.json.JSONObject;

@CapacitorPlugin(name = "SafeArea")
public class SafeAreaPlugin extends Plugin {

    private SafeArea implementation = null;

    @Override
    public void load() {
        implementation = new SafeArea(getActivity(), getBridge().getWebView());

        JSONObject configJSON = getConfig().getConfigJSON();
        boolean enabled = configJSON.optBoolean("enabled", false);

        if (enabled) {
            implementation.setOffset(configJSON.optInt("offset", 0));
            implementation.enable(false, new AppearanceConfig(configJSON));
        }
    }

    @Override
    protected void handleOnPause() {
        if (implementation != null) {
            implementation.resetDecorFitsSystemWindows();
        }
        super.handleOnPause();
    }

    @PluginMethod(returnType = PluginMethod.RETURN_NONE)
    public void enable(PluginCall call) {
        JSONObject jsonObject = call.getObject("config");

        if (jsonObject.has("offset")) {
            implementation.setOffset(jsonObject.optInt("offset", 0));
        }

        AppearanceConfig appearanceConfig = new AppearanceConfig(jsonObject);
        implementation.enable(true, appearanceConfig);

        call.resolve();
    }

    @PluginMethod(returnType = PluginMethod.RETURN_NONE)
    public void disable(PluginCall call) {
        AppearanceConfig appearanceConfig = new AppearanceConfig(call.getObject("config"));
        implementation.disable(appearanceConfig);
        call.resolve();
    }
}
