package pl.wolfedu.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.InputStream;
import java.io.File;
import java.io.FileOutputStream;
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

    private final Activity activity;
    private final WebView webView;
    private final ExecutorService networkExecutor = Executors.newFixedThreadPool(2);
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final AtomicLong checkGeneration = new AtomicLong(0L);

    private File pendingApkFile;

    public UpdateBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
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
        if (apkUrl == null
                || apkUrl.isBlank()
                || !apkUrl.startsWith(
                    "https://github.com/matiszaf/WolfEdu-Releases/")) {

            emitDownload("error", "Nieprawidłowy adres APK.");
            return;
        }

        emitDownload("downloading", "Pobieranie aktualizacji…");

        networkExecutor.execute(() -> {
            HttpURLConnection connection = null;

            try {
                URL url = new URL(apkUrl);

                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(true);
                connection.setUseCaches(false);

                int status = connection.getResponseCode();

                if (status < 200 || status >= 300) {
                    throw new IllegalStateException(
                            "Serwer APK zwrócił HTTP " + status
                    );
                }

                File updateDir = new File(
                        activity.getCacheDir(),
                        "updates"
                );

                if (!updateDir.exists() && !updateDir.mkdirs()) {
                    throw new IllegalStateException(
                            "Nie udało się utworzyć katalogu aktualizacji."
                    );
                }

                File apk = new File(
                        updateDir,
                        "WolfEdu-update.apk"
                );

                try (
                    InputStream input = connection.getInputStream();
                    FileOutputStream output = new FileOutputStream(apk)
                ) {
                    byte[] buffer = new byte[8192];
                    int read;

                    while ((read = input.read(buffer)) != -1) {
                        output.write(buffer, 0, read);
                    }

                    output.flush();
                }

                if (!apk.exists() || apk.length() == 0L) {
                    throw new IllegalStateException(
                            "Pobrany plik APK jest pusty."
                    );
                }

                pendingApkFile = apk;

                emitDownload(
                        "downloaded",
                        "Aktualizacja pobrana. Otwieram instalator…"
                );

                activity.runOnUiThread(
                        () -> requestInstallPermissionOrInstall(apk)
                );

            } catch (Exception e) {
                pendingApkFile = null;
                emitDownload("error", friendly(e));
            } finally {
                if (connection != null) {
                    try {
                        connection.disconnect();
                    } catch (Exception ignored) {}
                }
            }
        });
    }

    public void onResume() {
        File apk = pendingApkFile;

        if (apk == null
                || !apk.exists()
                || apk.length() == 0L
                || !canInstallPackages()) {
            return;
        }

        installCachedApk(apk);
    }

    public void destroy() {
        checkGeneration.incrementAndGet();
        networkExecutor.shutdownNow();
        scheduler.shutdownNow();
    }

    private boolean canInstallPackages() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || activity.getPackageManager().canRequestPackageInstalls();
    }

    private void requestInstallPermissionOrInstall(File apk) {
        if (apk == null || !apk.exists() || apk.length() == 0L) {
            pendingApkFile = null;
            emitDownload("error", "Nie znaleziono pobranego APK.");
            return;
        }

        if (canInstallPackages()) {
            installCachedApk(apk);
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
            installCachedApk(apk);
        }
    }

    private void installCachedApk(File apk) {
        try {
            Uri uri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".fileprovider",
                    apk
            );

            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(
                    uri,
                    "application/vnd.android.package-archive"
            );
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            activity.startActivity(install);

            emitDownload(
                    "installing",
                    "Otwieram instalator Androida…"
            );

            pendingApkFile = null;

        } catch (Exception e) {
            emitDownload("error", friendly(e));
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
