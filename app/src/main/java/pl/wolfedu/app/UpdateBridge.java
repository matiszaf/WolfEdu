package pl.wolfedu.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class UpdateBridge {
    private static final String UPDATE_MANIFEST_URL =
            "https://wolf-edu.web.app/updates/android/version.json";

    private final Activity activity;
    private final WebView webView;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final DownloadManager downloadManager;

    private long pendingDownloadId = -1L;
    private boolean receiverRegistered = false;

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
            if (id != pendingDownloadId) return;
            handleDownloadFinished();
        }
    };

    public UpdateBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.downloadManager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
        registerReceiver();
    }

    @JavascriptInterface
    public void getCurrentVersion() {
        JSONObject payload = new JSONObject();
        try {
            payload.put("versionName", BuildConfig.VERSION_NAME);
            payload.put("versionCode", BuildConfig.VERSION_CODE);
        } catch (Exception ignored) {}
        call("window.wolfUpdateCurrent && window.wolfUpdateCurrent(" + payload + ")");
    }

    @JavascriptInterface
    public void checkForUpdates(boolean userInitiated) {
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(UPDATE_MANIFEST_URL + "?t=" + System.currentTimeMillis());
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(9000);
                connection.setReadTimeout(9000);
                connection.setUseCaches(false);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "WolfEdu/" + BuildConfig.VERSION_NAME);

                int code = connection.getResponseCode();
                if (code < 200 || code >= 300) {
                    throw new IllegalStateException("Serwer aktualizacji zwrócił HTTP " + code);
                }

                StringBuilder body = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                        connection.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) body.append(line);
                }

                JSONObject remote = new JSONObject(body.toString());
                long remoteCode = remote.optLong("versionCode", 0L);
                String remoteName = remote.optString("versionName", "");
                String apkUrl = remote.optString("apkUrl", "");
                String changelog = remote.optString("changelog", "");
                boolean mandatory = remote.optBoolean("mandatory", false);
                boolean available = remoteCode > BuildConfig.VERSION_CODE && !apkUrl.isBlank();

                JSONObject result = new JSONObject();
                result.put("ok", true);
                result.put("available", available);
                result.put("currentVersionName", BuildConfig.VERSION_NAME);
                result.put("currentVersionCode", BuildConfig.VERSION_CODE);
                result.put("versionName", remoteName);
                result.put("versionCode", remoteCode);
                result.put("apkUrl", apkUrl);
                result.put("changelog", changelog);
                result.put("mandatory", mandatory);
                result.put("userInitiated", userInitiated);
                call("window.wolfUpdateResult && window.wolfUpdateResult(" + result + ")");
            } catch (Exception e) {
                JSONObject result = new JSONObject();
                try {
                    result.put("ok", false);
                    result.put("available", false);
                    result.put("userInitiated", userInitiated);
                    result.put("message", friendly(e));
                } catch (Exception ignored) {}
                call("window.wolfUpdateResult && window.wolfUpdateResult(" + result + ")");
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    @JavascriptInterface
    public void downloadAndInstall(String apkUrl, String versionName) {
        activity.runOnUiThread(() -> {
            try {
                if (apkUrl == null || apkUrl.isBlank() || !apkUrl.startsWith("https://")) {
                    emitDownload("error", "Nieprawidłowy adres APK.");
                    return;
                }

                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(apkUrl));
                request.setTitle("WolfEdu " + (versionName == null ? "aktualizacja" : versionName));
                request.setDescription("Pobieranie aktualizacji WolfEdu");
                request.setMimeType("application/vnd.android.package-archive");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setAllowedOverMetered(true);
                request.setAllowedOverRoaming(false);
                request.setDestinationInExternalFilesDir(
                        activity,
                        Environment.DIRECTORY_DOWNLOADS,
                        "WolfEdu-update.apk"
                );

                pendingDownloadId = downloadManager.enqueue(request);
                emitDownload("downloading", "Pobieranie aktualizacji…");
            } catch (Exception e) {
                emitDownload("error", friendly(e));
            }
        });
    }

    public void onResume() {
        if (pendingDownloadId > 0 && canInstallPackages()) {
            DownloadManager.Query query = new DownloadManager.Query().setFilterById(pendingDownloadId);
            try (Cursor cursor = downloadManager.query(query)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int index = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                    if (index >= 0 && cursor.getInt(index) == DownloadManager.STATUS_SUCCESSFUL) {
                        installDownloadedApk();
                    }
                }
            } catch (Exception ignored) {}
        }
    }

    public void destroy() {
        try {
            if (receiverRegistered) activity.unregisterReceiver(downloadReceiver);
        } catch (Exception ignored) {}
        receiverRegistered = false;
        executor.shutdownNow();
    }

    private void registerReceiver() {
        if (receiverRegistered) return;
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) {
            activity.registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            activity.registerReceiver(downloadReceiver, filter);
        }
        receiverRegistered = true;
    }

    private void handleDownloadFinished() {
        DownloadManager.Query query = new DownloadManager.Query().setFilterById(pendingDownloadId);
        try (Cursor cursor = downloadManager.query(query)) {
            if (cursor == null || !cursor.moveToFirst()) {
                emitDownload("error", "Nie znaleziono pobranej aktualizacji.");
                return;
            }

            int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            int reasonIndex = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);
            int status = statusIndex >= 0 ? cursor.getInt(statusIndex) : DownloadManager.STATUS_FAILED;

            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                emitDownload("downloaded", "Aktualizacja pobrana.");
                requestInstallPermissionOrInstall();
            } else {
                int reason = reasonIndex >= 0 ? cursor.getInt(reasonIndex) : -1;
                emitDownload("error", "Pobieranie nie powiodło się (" + reason + ").");
            }
        } catch (Exception e) {
            emitDownload("error", friendly(e));
        }
    }

    private void requestInstallPermissionOrInstall() {
        if (canInstallPackages()) {
            installDownloadedApk();
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            emitDownload("permission", "Zezwól WolfEdu na instalowanie aplikacji, a potem wróć tutaj.");
            Intent settings = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName())
            );
            activity.startActivity(settings);
        } else {
            installDownloadedApk();
        }
    }

    private boolean canInstallPackages() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || activity.getPackageManager().canRequestPackageInstalls();
    }

    private void installDownloadedApk() {
        if (pendingDownloadId <= 0) return;
        Uri uri = downloadManager.getUriForDownloadedFile(pendingDownloadId);
        if (uri == null) {
            emitDownload("error", "Nie można otworzyć pobranego APK.");
            return;
        }

        try {
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(uri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(install);
            emitDownload("installing", "Otwieram instalator Androida…");
        } catch (Exception e) {
            emitDownload("error", friendly(e));
        }
    }

    private void emitDownload(String state, String message) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("state", state);
            payload.put("message", message);
        } catch (Exception ignored) {}
        call("window.wolfUpdateDownload && window.wolfUpdateDownload(" + payload + ")");
    }

    private String friendly(Exception e) {
        String message = e == null ? null : e.getMessage();
        if (message == null || message.isBlank()) return "Nie udało się połączyć z serwerem aktualizacji.";
        return message;
    }

    private void call(String code) {
        webView.post(() -> webView.evaluateJavascript(code, null));
    }
}
