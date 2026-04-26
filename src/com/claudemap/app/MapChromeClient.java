package com.claudemap.app;

import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;

public class MapChromeClient extends WebChromeClient {
    @Override
    public void onGeolocationPermissionsShowPrompt(String origin,
                                                   GeolocationPermissions.Callback callback) {
        callback.invoke(origin, true, false);
    }
}
