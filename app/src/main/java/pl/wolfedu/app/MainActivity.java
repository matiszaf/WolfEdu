package pl.wolfedu.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final int REQUEST_EXPORT_JSON = 501;
    private WebView webView;
    private String pendingExportJson;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.addJavascriptInterface(new FirebaseSyncBridge(webView), "WolfSync");
        webView.addJavascriptInterface(new NativeBridge(), "WolfNative");
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/index.html");
    }

    public final class NativeBridge {
        @JavascriptInterface
        public void exportJson(String json) {
            runOnUiThread(() -> {
                pendingExportJson = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, "wolfedu-kopia.json");
                startActivityForResult(intent, REQUEST_EXPORT_JSON);
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_EXPORT_JSON) return;

        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            callJs("window.wolfNativeExportResult && window.wolfNativeExportResult(false,'Anulowano eksport')");
            pendingExportJson = null;
            return;
        }

        Uri uri = data.getData();
        try (OutputStream out = getContentResolver().openOutputStream(uri)) {
            if (out == null) throw new IllegalStateException("Nie można otworzyć pliku");
            out.write((pendingExportJson == null ? "{}" : pendingExportJson).getBytes(StandardCharsets.UTF_8));
            out.flush();
            callJs("window.wolfNativeExportResult && window.wolfNativeExportResult(true,'Kopia została zapisana')");
        } catch (Exception e) {
            String safe = e.getMessage() == null ? "Błąd zapisu pliku" : e.getMessage().replace("\\", "\\\\").replace("'", "\\'");
            callJs("window.wolfNativeExportResult && window.wolfNativeExportResult(false,'" + safe + "')");
        } finally {
            pendingExportJson = null;
        }
    }

    private void callJs(String code) {
        if (webView != null) webView.post(() -> webView.evaluateJavascript(code, null));
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
