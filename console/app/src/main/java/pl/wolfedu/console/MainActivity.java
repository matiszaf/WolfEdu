package pl.wolfedu.console;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new ConsoleBridge(webView), "WolfConsole");
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (webView != null) {
            webView.post(() ->
                webView.evaluateJavascript(
                    "if(typeof refreshConsoleSelfUpdate==='function'){refreshConsoleSelfUpdate();}",
                    null
                )
            );
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
