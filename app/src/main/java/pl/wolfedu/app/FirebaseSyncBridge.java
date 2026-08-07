package pl.wolfedu.app;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.SetOptions;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

public final class FirebaseSyncBridge {
    private final WebView webView;
    private final FirebaseAuth auth;
    private final FirebaseFirestore firestore;
    private ListenerRegistration listener;

    public FirebaseSyncBridge(WebView webView) {
        this.webView = webView;
        this.auth = FirebaseAuth.getInstance();
        this.firestore = FirebaseFirestore.getInstance("default");
        auth.addAuthStateListener(ignored -> emitAuthState());
    }

    @JavascriptInterface
    public void register(String email, String password) {
        auth.createUserWithEmailAndPassword(email.trim(), password)
                .addOnSuccessListener(result -> {
                    emitAuthState();
                    emitStatus("Połączono", "Konto utworzone. Synchronizacja jest aktywna.", "online");
                })
                .addOnFailureListener(error -> emitError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void login(String email, String password) {
        auth.signInWithEmailAndPassword(email.trim(), password)
                .addOnSuccessListener(result -> {
                    emitAuthState();
                    emitStatus("Połączono", "Zalogowano. Dane będą synchronizowane.", "online");
                })
                .addOnFailureListener(error -> emitError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void logout() {
        stopListener();
        auth.signOut();
        emitAuthState();
        emitStatus("Wylogowano", "Dane pozostają na tym telefonie.", "offline");
    }

    @JavascriptInterface
    public void syncData(String json, long updatedAt) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null) {
            emitStatus("Tylko lokalnie", "Zaloguj się, aby synchronizować.", "offline");
            return;
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("json", json);
        payload.put("updatedAt", updatedAt);
        payload.put("uid", user.getUid());
        payload.put("email", user.getEmail());
        emitStatus("Synchronizowanie…", "Wysyłanie zmian do chmury.", "syncing");
        document(user).set(payload, SetOptions.merge())
                .addOnSuccessListener(unused -> emitStatus("Zsynchronizowano", "Wszystkie zmiany są w chmurze.", "online"))
                .addOnFailureListener(error -> emitStatus("Oczekuje", friendly(error.getMessage()), "pending"));
    }

    @JavascriptInterface
    public void requestRemoteData() {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null) {
            emitAuthState();
            return;
        }
        startListener(user);
        document(user).get()
                .addOnSuccessListener(snapshot -> {
                    if (snapshot.exists()) {
                        String json = snapshot.getString("json");
                        Long updatedAt = snapshot.getLong("updatedAt");
                        if (json != null) emitRemote(json, updatedAt == null ? 0L : updatedAt);
                    } else {
                        emitStatus("Gotowe", "To konto nie ma jeszcze kopii w chmurze.", "online");
                    }
                })
                .addOnFailureListener(error -> emitStatus("Tryb offline", friendly(error.getMessage()), "pending"));
    }

    private DocumentReference document(FirebaseUser user) {
        return firestore.collection("users").document(user.getUid()).collection("wolfedu").document("main");
    }

    private void startListener(FirebaseUser user) {
        stopListener();
        listener = document(user).addSnapshotListener((snapshot, error) -> {
            if (error != null) {
                emitStatus("Oczekuje", friendly(error.getMessage()), "pending");
                return;
            }
            if (snapshot != null && snapshot.exists()) {
                String json = snapshot.getString("json");
                Long updatedAt = snapshot.getLong("updatedAt");
                if (json != null) emitRemote(json, updatedAt == null ? 0L : updatedAt);
            }
        });
    }

    private void stopListener() {
        if (listener != null) {
            listener.remove();
            listener = null;
        }
    }

    private void emitAuthState() {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null) {
            stopListener();
            call("window.wolfSyncAuth(false,'')");
        } else {
            startListener(user);
            call("window.wolfSyncAuth(true," + JSONObject.quote(user.getEmail() == null ? "" : user.getEmail()) + ")");
        }
    }

    private void emitRemote(String json, long updatedAt) {
        call("window.wolfSyncRemote(" + JSONObject.quote(json) + "," + updatedAt + ")");
    }

    private void emitError(String message) {
        call("window.wolfSyncError(" + JSONObject.quote(message) + ")");
    }

    private void emitStatus(String title, String detail, String state) {
        call("window.wolfSyncStatus(" + JSONObject.quote(title) + "," + JSONObject.quote(detail) + "," + JSONObject.quote(state) + ")");
    }

    private void call(String javascript) {
        webView.post(() -> webView.evaluateJavascript(javascript, null));
    }

    private String friendly(String raw) {
        if (raw == null || raw.isBlank()) return "Nie udało się połączyć z chmurą.";
        String text = raw.replace("An internal error has occurred. [", "").replace("]", "");
        if (text.contains("password is invalid") || text.contains("INVALID_LOGIN_CREDENTIALS")) return "Nieprawidłowy e-mail lub hasło.";
        if (text.contains("email address is already in use")) return "Konto z tym adresem już istnieje.";
        if (text.contains("badly formatted")) return "Wpisz poprawny adres e-mail.";
        if (text.contains("at least 6 characters")) return "Hasło musi mieć co najmniej 6 znaków.";
        if (text.contains("network error") || text.contains("client is offline") || text.contains("UNAVAILABLE")) return "Brak połączenia z WolfCloud. Dane lokalne są bezpieczne; synchronizacja wznowi się automatycznie.";
        return text;
    }
}
