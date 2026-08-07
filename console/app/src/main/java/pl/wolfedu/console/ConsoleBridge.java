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

public class ConsoleBridge {
    private final WebView webView;
    private final FirebaseAuth auth = FirebaseAuth.getInstance();
    private final FirebaseFirestore db = FirebaseFirestore.getInstance();

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
    public void setSchoolStatus(String schoolId, String status) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || adminProfile == null || schoolId == null || schoolId.isBlank()) return;

        String clean = status == null ? "" : status.trim().toLowerCase();
        if (!clean.equals("active") && !clean.equals("suspended")) {
            emitError("Nieprawidłowy status szkoły.");
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("systemStatus", clean);
        payload.put("systemStatusUpdatedAt", FieldValue.serverTimestamp());
        payload.put("systemStatusUpdatedBy", user.getUid());

        db.collection("schools").document(schoolId)
                .set(payload, SetOptions.merge())
                .addOnSuccessListener(done -> emitMessage("Zmieniono status szkoły."))
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
