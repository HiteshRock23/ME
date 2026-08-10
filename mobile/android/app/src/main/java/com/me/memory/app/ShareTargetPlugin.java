package com.me.memory.app;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Capacitor 6 Plugin to handle Android Sharesheet ACTION_SEND intents.
 * Extracts text and URLs shared from other apps into ME.
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    private JSObject pendingSharePayload = null;
    private String lastProcessedSignature = null;

    @Override
    public void load() {
        super.load();
        if (getActivity() != null && getActivity().getIntent() != null) {
            processIntent(getActivity().getIntent());
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent != null) {
            processIntent(intent);
        }
    }

    public void processIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && type != null && type.startsWith("text/")) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            String sharedTitle = intent.getStringExtra(Intent.EXTRA_TITLE);

            if (sharedText == null || sharedText.trim().isEmpty()) {
                if (sharedTitle != null && !sharedTitle.trim().isEmpty()) {
                    sharedText = sharedTitle;
                } else {
                    return;
                }
            }

            String signature = (sharedTitle != null ? sharedTitle.trim() : "") + "::" + sharedText.trim();
            if (signature.equals(lastProcessedSignature)) {
                // Prevent duplicate processing of identical intent
                return;
            }
            lastProcessedSignature = signature;

            String extractedUrl = extractUrl(sharedText);
            String itemType = (extractedUrl != null && !extractedUrl.isEmpty()) ? "link" : "text";

            JSObject payload = new JSObject();
            payload.put("type", itemType);
            payload.put("text", sharedText.trim());
            payload.put("title", sharedTitle != null ? sharedTitle.trim() : "");
            payload.put("url", extractedUrl != null ? extractedUrl : "");
            payload.put("source", "android_share");
            payload.put("timestamp", System.currentTimeMillis());

            this.pendingSharePayload = payload;

            // Clear intent action so it won't re-fire on lifecycle restarts
            intent.setAction(null);

            // Notify JS listener if active
            notifyListeners("onShareReceived", payload, true);
        }
    }

    private String extractUrl(String text) {
        if (text == null || text.isEmpty()) return null;
        Matcher matcher = Pattern.compile("https?://[^\\s]+", Pattern.CASE_INSENSITIVE).matcher(text);
        if (matcher.find()) {
            return matcher.group();
        }
        return null;
    }

    @PluginMethod
    public void getPendingShare(PluginCall call) {
        JSObject ret = new JSObject();
        if (pendingSharePayload != null) {
            ret.put("hasShare", true);
            ret.put("share", pendingSharePayload);
            pendingSharePayload = null; // Consume once
        } else {
            ret.put("hasShare", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void clearPendingShare(PluginCall call) {
        pendingSharePayload = null;
        JSObject ret = new JSObject();
        ret.put("cleared", true);
        call.resolve(ret);
    }
}
