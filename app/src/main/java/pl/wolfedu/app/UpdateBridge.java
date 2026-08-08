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
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

public final class UpdateBridge {
    private static final String UPDATE_MANIFEST_URL =
            "https://raw.githubusercontent.com/matiszaf/WolfEdu-Releases/main/version.json";

    private static final long CHECK_WATCHDOG_SECONDS = 12L;
    private static final long DOWNLOAD_WATCHDOG_MINUTES = 5L;

    private final Activity activity;
    private final WebView webView;
    private final ExecutorService networkExecutor = Executors.newFixedThreadPool(2);
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final DownloadManager downloadManager;
    private final AtomicLong checkGeneration = new AtomicLong(0L);

    private long pendingDownloadId = -1L;
    private ScheduledFuture<?> downloadTimeoutFuture;
    private boolean receiverRegistered = false;

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
            if (id != pendingDownloadId) return;
            cancelDownloadTimeout();
            handleDownloadFinished(id);
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
            payload.put("versionName", currentVersionName());
            payload.put("versionCode", currentVersionCode());
        } catch (Exception ignored) {}
        emit("wolfOtaNativeVersion", payload);
    }

    /**
     * Celowo bez argumentów. JS bridge w OTA v2 ma najprostszy możliwy kontrakt:
     * klik -> checkForUpdates() -> jeden callback JSON.
     */
    @JavascriptInterface
    public void checkForUpdates() {
        final long generation = checkGeneration.incrementAndGet();
        final AtomicBoolean finished = new AtomicBoolean(false);
        final AtomicReference<HttpURLConnection> connectionRef = new AtomicReference<>(null);

        ScheduledFuture<?> watchdog = scheduler.schedule(() -> {
            if (generation != checkGeneration.get()) return;
            if (!finished.compareAndSet(false, true)) return;

            HttpURLConnection c = connectionRef.get();
            if (c != null) {
                try { c.disconnect(); } catch (Exception ignored) {}
            }

            emitCheckError(
                    "Przekroczono czas sprawdzania aktualizacji.",
                    currentVersionName(),
                    currentVersionCode()
            );
        }, CHECK_WATCHDOG_SECONDS, TimeUnit.SECONDS);

        networkExecutor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(UPDATE_MANIFEST_URL + "?t=" + System.currentTimeMillis());
                connection = (HttpURLConnection) url.openConnection();
                connectionRef.set(connection);

                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.setUseCaches(false);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "WolfEdu/" + currentVersionName());

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

                if (remoteName.isBlank() || remoteCode <= 0L) {
                    throw new IllegalStateException("Manifest aktualizacji ma nieprawidłową wersję.");
                }
                if (!apkUrl.startsWith("https://")) {
                    throw new IllegalStateException("Manifest aktualizacji ma nieprawidłowy adres APK.");
                }

                if (generation != checkGeneration.get()) return;
                if (!finished.compareAndSet(false, true)) return;
                watchdog.cancel(false);

                JSONObject result = new JSONObject();
                result.put("ok", true);
                result.put("available", remoteCode > currentVersionCode());
                result.put("currentVersionName", currentVersionName());
                result.put("currentVersionCode", currentVersionCode());
                result.put("versionName", remoteName);
                result.put("versionCode", remoteCode);
                result.put("apkUrl", apkUrl);
                result.put("changelog", changelog);
                result.put("mandatory", mandatory);
                result.put("message", "");
                emit("wolfOtaCheckResult", result);

            } catch (Exception e) {
                if (generation != checkGeneration.get()) return;
                if (!finished.compareAndSet(false, true)) return;
                watchdog.cancel(false);
                emitCheckError(friendly(e), currentVersionName(), currentVersionCode());
            } finally {
                if (connection != null) {
                    try { connection.disconnect(); } catch (Exception ignored) {}
                }
            }
        });
    }

    @JavascriptInterface
    public void downloadAndInstall(String apkUrl) {
        activity.runOnUiThread(() -> {
            try {
                if (apkUrl == null || apkUrl.isBlank() || !apkUrl.startsWith("https://")) {
                    emitDownload("error", "Nieprawidłowy adres APK.");
                    return;
                }

                if (pendingDownloadId > 0L) {
                    try { downloadManager.remove(pendingDownloadId); } catch (Exception ignored) {}
                    pendingDownloadId = -1L;
                }
                cancelDownloadTimeout();

                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(apkUrl));
                request.setTitle("WolfEdu — aktualizacja");
                request.setDescription("Pobieranie aktualizacji WolfEdu");
                request.setMimeType("application/vnd.android.package-archive");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setAllowedOverMetered(true);
                request.setAllowedOverRoaming(false);
                request.setDestinationInExternalFilesDir(
                        activity,
                        Environment.DIRECTORY_DOWNLOADS,
                        "WolfEdu-update-" + System.currentTimeMillis() + ".apk"
                );

                pendingDownloadId = downloadManager.enqueue(request);
                final long downloadId = pendingDownloadId;

                downloadTimeoutFuture = scheduler.schedule(
                        () -> handleDownloadTimeout(downloadId),
                        DOWNLOAD_WATCHDOG_MINUTES,
                        TimeUnit.MINUTES
                );

                emitDownload("downloading", "Pobieranie aktualizacji…");
            } catch (Exception e) {
                emitDownload("error", friendly(e));
            }
        });
    }

    public void onResume() {
        long id = pendingDownloadId;
        if (id <= 0L || !canInstallPackages()) return;

        DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
        try (Cursor cursor = downloadManager.query(query)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                if (index >= 0 && cursor.getInt(index) == DownloadManager.STATUS_SUCCESSFUL) {
                    cancelDownloadTimeout();
                    installDownloadedApk(id);
                }
            }
        } catch (Exception ignored) {}
    }

    public void destroy() {
        checkGeneration.incrementAndGet();
        cancelDownloadTimeout();

        try {
            if (receiverRegistered) activity.unregisterReceiver(downloadReceiver);
        } catch (Exception ignored) {}
        receiverRegistered = false;

        networkExecutor.shutdownNow();
        scheduler.shutdownNow();
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

    private void handleDownloadTimeout(long id) {
        if (id <= 0L || id != pendingDownloadId) return;

        int status = queryDownloadStatus(id);
        if (status == DownloadManager.STATUS_SUCCESSFUL) {
            handleDownloadFinished(id);
            return;
        }

        try { downloadManager.remove(id); } catch (Exception ignored) {}
        if (id == pendingDownloadId) pendingDownloadId = -1L;
        emitDownload("error", "Pobieranie aktualizacji przekroczyło limit 5 minut.");
    }

    private int queryDownloadStatus(long id) {
        DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
        try (Cursor cursor = downloadManager.query(query)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                if (index >= 0) return cursor.getInt(index);
            }
        } catch (Exception ignored) {}
        return DownloadManager.STATUS_FAILED;
    }

    private void handleDownloadFinished(long id) {
        if (id <= 0L || id != pendingDownloadId) return;

        DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
        try (Cursor cursor = downloadManager.query(query)) {
            if (cursor == null || !cursor.moveToFirst()) {
                pendingDownloadId = -1L;
                emitDownload("error", "Nie znaleziono pobranej aktualizacji.");
                return;
            }

            int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            int reasonIndex = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);
            int status = statusIndex >= 0
                    ? cursor.getInt(statusIndex)
                    : DownloadManager.STATUS_FAILED;

            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                emitDownload("downloaded", "Aktualizacja pobrana.");
                requestInstallPermissionOrInstall(id);
            } else {
                int reason = reasonIndex >= 0 ? cursor.getInt(reasonIndex) : -1;
                pendingDownloadId = -1L;
                emitDownload("error", "Pobieranie nie powiodło się (kod " + reason + ").");
            }
        } catch (Exception e) {
            pendingDownloadId = -1L;
            emitDownload("error", friendly(e));
        }
    }

    private void requestInstallPermissionOrInstall(long id) {
        if (canInstallPackages()) {
            installDownloadedApk(id);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            emitDownload(
                    "permission",
                    "Zezwól WolfEdu na instalowanie aplikacji, a potem wróć do WolfEdu."
            );
            Intent settings = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName())
            );
            activity.startActivity(settings);
        } else {
            installDownloadedApk(id);
        }
    }

    private boolean canInstallPackages() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || activity.getPackageManager().canRequestPackageInstalls();
    }

    private void installDownloadedApk(long id) {
        if (id <= 0L || id != pendingDownloadId) return;

        Uri uri = downloadManager.getUriForDownloadedFile(id);
        if (uri == null) {
            pendingDownloadId = -1L;
            emitDownload("error", "Nie można otworzyć pobranego APK.");
            return;
        }

        try {
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(uri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(install);
            emitDownload("installing", "Otwieram instalator Androida…");
            pendingDownloadId = -1L;
        } catch (Exception e) {
            emitDownload("error", friendly(e));
        }
    }

    private void cancelDownloadTimeout() {
        if (downloadTimeoutFuture != null) {
            downloadTimeoutFuture.cancel(false);
            downloadTimeoutFuture = null;
        }
    }

    private void emitCheckError(String message, String currentName, long currentCode) {
        JSONObject result = new JSONObject();
        try {
            result.put("ok", false);
            result.put("available", false);
            result.put("currentVersionName", currentName);
            result.put("currentVersionCode", currentCode);
            result.put("message", message);
        } catch (Exception ignored) {}
        emit("wolfOtaCheckResult", result);
    }

    private void emitDownload(String state, String message) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("state", state);
            payload.put("message", message);
        } catch (Exception ignored) {}
        emit("wolfOtaDownloadResult", payload);
    }

    private void emit(String callback, JSONObject payload) {
        final String script = "window." + callback + " && window." + callback + "(" + payload + ")";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private String friendly(Exception e) {
        if (e == null) return "Nieznany błąd aktualizacji.";
        String type = e.getClass().getSimpleName();
        String message = e.getMessage();
        return message == null || message.isBlank() ? type : type + ": " + message;
    }

    private String currentVersionName() {
        try {
            android.content.pm.PackageInfo info =
                    activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            return info.versionName == null ? "unknown" : info.versionName;
        } catch (Exception e) {
            return "unknown";
        }
    }

    private long currentVersionCode() {
        try {
            android.content.pm.PackageInfo info =
                    activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return info.getLongVersionCode();
            }
            return info.versionCode;
        } catch (Exception e) {
            return 0L;
        }
    }
}
