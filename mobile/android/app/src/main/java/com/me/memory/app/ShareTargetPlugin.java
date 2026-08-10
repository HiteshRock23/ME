package com.me.memory.app;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
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
        Logger.debug("[ShareTarget]", "ShareTargetPlugin loaded");
        if (getActivity() != null && getActivity().getIntent() != null) {
            processIntent(getActivity().getIntent());
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        Logger.debug("[ShareTarget]", "handleOnNewIntent received");
        if (intent != null) {
            processIntent(intent);
        }
    }

    public void processIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        Logger.debug("[ShareTarget]", "processIntent action=" + action + " type=" + type);

        if (Intent.ACTION_SEND.equals(action) && type != null && type.startsWith("text/")) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            String sharedTitle = intent.getStringExtra(Intent.EXTRA_TITLE);

            Logger.debug("[ShareTarget]", "ACTION_SEND received text=" + sharedText + " title=" + sharedTitle);

            if (sharedText == null || sharedText.trim().isEmpty()) {
                if (sharedTitle != null && !sharedTitle.trim().isEmpty()) {
                    sharedText = sharedTitle;
                } else {
                    Logger.debug("[ShareTarget]", "Empty shared content, ignoring intent");
                    return;
                }
            }

            String signature = (sharedTitle != null ? sharedTitle.trim() : "") + "::" + sharedText.trim();
            if (signature.equals(lastProcessedSignature)) {
                Logger.debug("[ShareTarget]", "Duplicate intent signature ignored: " + signature);
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
            Logger.debug("[ShareTarget]", "Stored pendingSharePayload: " + payload.toString());

            // Clear intent action so it won't re-fire on lifecycle restarts
            intent.setAction(null);

            // Notify JS listener if active
            Logger.debug("[ShareTarget]", "Emitting onShareReceived to JS listeners");
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
            Logger.debug("[ShareTarget]", "getPendingShare: Returning pending share payload");
            ret.put("hasShare", true);
            ret.put("share", pendingSharePayload);
            pendingSharePayload = null; // Consume once
        } else {
            Logger.debug("[ShareTarget]", "getPendingShare: No pending share payload");
            ret.put("hasShare", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void clearPendingShare(PluginCall call) {
        Logger.debug("[ShareTarget]", "clearPendingShare called");
        pendingSharePayload = null;
        JSObject ret = new JSObject();
        ret.put("cleared", true);
        call.resolve(ret);
    }
}
