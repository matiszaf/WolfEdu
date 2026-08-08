package pl.wolfedu.console;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.SetOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class ConsoleBridge {
    private final WebView webView;
    private final FirebaseAuth auth = FirebaseAuth.getInstance();
    private final FirebaseFirestore db = FirebaseFirestore.getInstance("default");

    private ListenerRegistration schoolsListener;
    private ListenerRegistration adminsListener;
    private DocumentSnapshot adminProfile;

    public ConsoleBridge(WebView webView) {
        this.webView = webView;
        auth.addAuthStateListener(a -> handleAuthState(a.getCurrentUser()));
    }

    @JavascriptInterface
    public void login(String email, String password) {
        String e = email == null ? "" : email.trim();
        String p = password == null ? "" : password;
        if (e.isEmpty() || p.length() < 6) {
            emitError("Wpisz poprawny e-mail i hasło.");
            return;
        }
        auth.signInWithEmailAndPassword(e, p)
                .addOnFailureListener(err -> emitError(friendly(err.getMessage())));
    }

    @JavascriptInterface
    public void logout() {
        stopListeners();
        auth.signOut();
    }

    @JavascriptInterface
    public void requestState() {
        handleAuthState(auth.getCurrentUser());
    }

    @JavascriptInterface
    public void requestEnvironment() {
        FirebaseUser user = auth.getCurrentUser();
        JSONObject o = new JSONObject();
        try {
            android.content.pm.PackageInfo info =
                    webView.getContext().getPackageManager().getPackageInfo(
                            webView.getContext().getPackageName(), 0
                    );

            o.put(
                    "consoleVersion",
                    info.versionName == null ? "unknown" : info.versionName
            );

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                o.put("consoleVersionCode", info.getLongVersionCode());
            } else {
                o.put("consoleVersionCode", info.versionCode);
            }
            o.put("uid", user == null ? "" : user.getUid());
            o.put("email", user == null ? "" : value(user.getEmail()));
            o.put("role", adminProfile == null ? "" : value(adminProfile.getString("role")));
            o.put("firestoreDatabase", "default");
        } catch (Exception ignored) {}
        evaluate("window.consoleEnvironment && window.consoleEnvironment(" + o + ")");
    }

    @JavascriptInterface
    public void requestReleaseInfo() {
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(
                    "https://raw.githubusercontent.com/matiszaf/WolfEdu-Releases/main/version.json?t="
                    + System.currentTimeMillis()
                );
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.setUseCaches(false);
                connection.setRequestProperty("Cache-Control", "no-cache");

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) throw new Exception("HTTP " + status);

                StringBuilder body = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(connection.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) body.append(line);
                }

                JSONObject payload = new JSONObject(body.toString());
                evaluate("window.consoleReleaseInfo && window.consoleReleaseInfo(" + payload + ")");
            } catch (Exception err) {
                evaluate("window.consoleReleaseError && window.consoleReleaseError(" + js(friendly(err.getMessage())) + ")");
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }


    @JavascriptInterface
    public void requestReleaseRequests() {
        db.collection("releaseRequests")
                .get()
                .addOnSuccessListener(snapshot -> {
                    JSONArray arr = new JSONArray();

                    for (DocumentSnapshot d : snapshot.getDocuments()) {
                        JSONObject o = new JSONObject();
                        try {
                            o.put("id", d.getId());
                            put(o, "versionName", d.get("versionName"));
                            put(o, "changelog", d.get("changelog"));
                            put(o, "mandatory", d.get("mandatory"));
                            put(o, "source", d.get("source"));

                            if (d.getTimestamp("createdAt") != null) {
                                o.put(
                                    "createdAtMillis",
                                    d.getTimestamp("createdAt").toDate().getTime()
                                );
                            } else {
                                o.put("createdAtMillis", 0);
                            }
                        } catch (Exception ignored) {}

                        arr.put(o);
                    }

                    evaluate(
                        "window.consoleReleaseRequests && window.consoleReleaseRequests("
                        + arr + ")"
                    );
                })
                .addOnFailureListener(err ->
                    evaluate(
                        "window.consoleReleaseQueueError && window.consoleReleaseQueueError("
                        + js(friendly(err.getMessage())) + ")"
                    )
                );
    }

    @JavascriptInterface
    public void createReleaseRequest(
            String versionName,
            String changelog,
            boolean mandatory
    ) {
        FirebaseUser user = auth.getCurrentUser();

        if (user == null || adminProfile == null) {
            emitError("Brak aktywnej sesji Console.");
            return;
        }

        String role = value(adminProfile.getString("role"));
        if (!"creator".equals(role)) {
            emitError("Tylko creator może publikować aktualizacje WolfEdu.");
            return;
        }

        String version = versionName == null ? "" : versionName.trim();
        String notes = changelog == null ? "" : changelog.trim();

        if (!version.matches("^[0-9]+\\.[0-9]+\\.[0-9]+$")) {
            emitError("Wersja musi mieć format X.Y.Z, np. 0.11.7.");
            return;
        }

        if (notes.isEmpty()) {
            emitError("Changelog nie może być pusty.");
            return;
        }

        if (notes.length() > 2000) {
            emitError("Changelog może mieć maksymalnie 2000 znaków.");
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("versionName", version);
        payload.put("changelog", notes);
        payload.put("mandatory", mandatory);
        payload.put("source", "console");
        payload.put("createdAt", FieldValue.serverTimestamp());

        db.collection("releaseRequests")
                .document(version)
                .set(payload)
                .addOnSuccessListener(done -> {
                    evaluate(
                        "window.consoleReleaseQueued && window.consoleReleaseQueued("
                        + js(version) + ")"
                    );
                    requestReleaseRequests();
                })
                .addOnFailureListener(err -> emitError(friendly(err.getMessage())));
    }

    @JavascriptInterface
    public void setSchoolStatus(String schoolId, String status) {
        setSchoolStatusDetailed(schoolId, status, "");
    }

    @JavascriptInterface
    public void setSchoolStatusDetailed(String schoolId, String status, String reason) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || adminProfile == null || schoolId == null || schoolId.isBlank()) return;

        String clean = status == null ? "" : status.trim().toLowerCase();
        if (!clean.equals("active") && !clean.equals("suspended") && !clean.equals("maintenance")) {
            emitError("Nieprawidłowy status szkoły.");
            return;
        }

        String cleanReason = reason == null ? "" : reason.trim();

        Map<String, Object> payload = new HashMap<>();
        payload.put("systemStatus", clean);
        payload.put("systemStatusReason", clean.equals("active") ? "" : cleanReason);
        payload.put("systemStatusUpdatedAt", FieldValue.serverTimestamp());
        payload.put("systemStatusUpdatedBy", user.getUid());
        payload.put("systemStatusUpdatedByEmail", value(user.getEmail()));

        db.collection("schools").document(schoolId)
                .set(payload, SetOptions.merge())
                .addOnSuccessListener(done -> {
                    String label = clean.equals("active")
                            ? "Szkoła została aktywowana."
                            : clean.equals("maintenance")
                            ? "Włączono tryb konserwacji szkoły."
                            : "Szkoła została zawieszona.";
                    emitMessage(label);
                })
                .addOnFailureListener(err -> emitError(friendly(err.getMessage())));
    }

    @JavascriptInterface
    public void addSystemAdmin(String uid, String email, String role) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || adminProfile == null) return;

        String cleanUid = uid == null ? "" : uid.trim();
        String cleanEmail = email == null ? "" : email.trim();
        String cleanRole = role == null ? "admin" : role.trim().toLowerCase();

        if (cleanUid.isEmpty()) {
            emitError("UID jest wymagany.");
            return;
        }
        if (!(cleanRole.equals("admin") || cleanRole.equals("creator"))) {
            emitError("Nieprawidłowa rola systemowa.");
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("uid", cleanUid);
        payload.put("email", cleanEmail);
        payload.put("role", cleanRole);
        payload.put("createdBy", user.getUid());
        payload.put("createdAt", FieldValue.serverTimestamp());

        db.collection("systemAdmins").document(cleanUid)
                .set(payload, SetOptions.merge())
                .addOnSuccessListener(done -> emitMessage("Administrator systemowy został dodany."))
                .addOnFailureListener(err -> emitError(friendly(err.getMessage())));
    }

    @JavascriptInterface
    public void updateSystemAdminRole(String uid, String role) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || adminProfile == null || uid == null || uid.isBlank()) return;

        String cleanRole = role == null ? "" : role.trim().toLowerCase();
        if (!(cleanRole.equals("admin") || cleanRole.equals("creator"))) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("role", cleanRole);
        payload.put("updatedBy", user.getUid());
        payload.put("updatedAt", FieldValue.serverTimestamp());

        db.collection("systemAdmins").document(uid)
                .set(payload, SetOptions.merge())
                .addOnFailureListener(err -> emitError(friendly(err.getMessage())));
    }

    @JavascriptInterface
    public void removeSystemAdmin(String uid) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || adminProfile == null || uid == null || uid.isBlank()) return;

        if (uid.equals(user.getUid())) {
            emitError("Nie możesz usunąć własnego dostępu z Console.");
            return;
        }

        db.collection("systemAdmins").document(uid).delete()
                .addOnSuccessListener(done -> emitMessage("Dostęp systemowy został usunięty."))
                .addOnFailureListener(err -> emitError(friendly(err.getMessage())));
    }

    private void handleAuthState(FirebaseUser user) {
        stopListeners();

        if (user == null) {
            adminProfile = null;
            evaluate("window.consoleAuth && window.consoleAuth(false,'','')");
            return;
        }

        DocumentReference ref = db.collection("systemAdmins").document(user.getUid());
        ref.get()
                .addOnSuccessListener(snapshot -> {
                    if (!snapshot.exists()) {
                        adminProfile = null;
                        evaluate("window.consoleDenied && window.consoleDenied(" + js(value(user.getEmail())) + ")");
                        return;
                    }

                    adminProfile = snapshot;
                    String role = value(snapshot.getString("role"));
                    evaluate("window.consoleAuth && window.consoleAuth(true," + js(value(user.getEmail())) + "," + js(role) + ")");
                    attachListeners();
                })
                .addOnFailureListener(err -> emitError(friendly(err.getMessage())));
    }

    private void attachListeners() {
        stopListeners();

        schoolsListener = db.collection("schools").addSnapshotListener((snapshot, error) -> {
            if (error != null) {
                emitError(friendly(error.getMessage()));
                return;
            }
            JSONArray arr = new JSONArray();
            if (snapshot != null) {
                for (DocumentSnapshot d : snapshot.getDocuments()) {
                    JSONObject o = new JSONObject();
                    try {
                        o.put("id", d.getId());
                        put(o, "name", d.get("name"));
                        put(o, "city", d.get("city"));
                        put(o, "type", d.get("type"));
                        put(o, "schoolYear", d.get("schoolYear"));
                        put(o, "ownerUid", d.get("ownerUid"));
                        put(o, "systemStatus", d.get("systemStatus"));
                        put(o, "systemStatusReason", d.get("systemStatusReason"));
                        put(o, "systemStatusUpdatedBy", d.get("systemStatusUpdatedBy"));
                        put(o, "systemStatusUpdatedByEmail", d.get("systemStatusUpdatedByEmail"));
                        put(o, "systemStatusUpdatedAt", d.get("systemStatusUpdatedAt"));
                        put(o, "address", d.get("address"));
                        put(o, "email", d.get("email"));
                        put(o, "phone", d.get("phone"));
                    } catch (Exception ignored) {}
                    arr.put(o);
                }
            }
            evaluate("window.consoleSchools && window.consoleSchools(" + arr + ")");
        });

        adminsListener = db.collection("systemAdmins").addSnapshotListener((snapshot, error) -> {
            if (error != null) {
                emitError(friendly(error.getMessage()));
                return;
            }
            JSONArray arr = new JSONArray();
            if (snapshot != null) {
                for (DocumentSnapshot d : snapshot.getDocuments()) {
                    JSONObject o = new JSONObject();
                    try {
                        o.put("id", d.getId());
                        put(o, "uid", d.get("uid"));
                        put(o, "email", d.get("email"));
                        put(o, "role", d.get("role"));
                    } catch (Exception ignored) {}
                    arr.put(o);
                }
            }
            evaluate("window.consoleAdmins && window.consoleAdmins(" + arr + ")");
        });
    }

    private void stopListeners() {
        if (schoolsListener != null) {
            schoolsListener.remove();
            schoolsListener = null;
        }
        if (adminsListener != null) {
            adminsListener.remove();
            adminsListener = null;
        }
    }

    private void put(JSONObject o, String key, Object value) throws Exception {
        o.put(key, value == null ? "" : value);
    }

    private String value(String v) {
        return v == null ? "" : v;
    }

    private String friendly(String message) {
        if (message == null || message.isBlank()) return "Wystąpił błąd.";
        return message;
    }

    private void emitError(String message) {
        evaluate("window.consoleError && window.consoleError(" + js(message) + ")");
    }

    private void emitMessage(String message) {
        evaluate("window.consoleMessage && window.consoleMessage(" + js(message) + ")");
    }

    private String js(String value) {
        return JSONObject.quote(value == null ? "" : value);
    }

    private void evaluate(String script) {
        webView.post(() -> webView.evaluateJavascript(script, null));
    }
}
