package pl.wolfedu.app;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.QueryDocumentSnapshot;
import com.google.firebase.firestore.SetOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class FirebaseSyncBridge {
    private final WebView webView;
    private final FirebaseAuth auth;
    private final FirebaseFirestore firestore;

    // Legacy WolfSync listener.
    private ListenerRegistration legacyListener;

    // WolfSync 2 / school structure listeners.
    private ListenerRegistration profileListener;
    private ListenerRegistration schoolListener;
    private ListenerRegistration memberListener;
    private ListenerRegistration classesListener;
    private ListenerRegistration subjectsListener;
    private ListenerRegistration teachersListener;
    private ListenerRegistration studentsListener;
    private ListenerRegistration gradesListener;
    private ListenerRegistration tasksListener;
    private ListenerRegistration attendanceListener;
    private ListenerRegistration timetableListener;

    private String activeSchoolId = "";
    private String activeSchoolName = "";
    private String activeRole = "";
    private JSONArray schoolClasses = new JSONArray();
    private JSONArray schoolSubjects = new JSONArray();
    private JSONArray schoolTeachers = new JSONArray();
    private JSONArray schoolStudents = new JSONArray();
    private JSONArray schoolGrades = new JSONArray();
    private JSONArray schoolTasks = new JSONArray();
    private JSONArray schoolAttendance = new JSONArray();
    private JSONArray schoolTimetable = new JSONArray();
    private JSONArray availableSchools = new JSONArray();

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
        stopLegacyListener();
        stopSchoolListeners();
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
        startLegacyListener(user);
        startSchoolSync(user);
        document(user).get()
                .addOnSuccessListener(snapshot -> {
                    if (snapshot.exists()) {
                        String json = snapshot.getString("json");
                        Long updatedAt = snapshot.getLong("updatedAt");
                        if (json != null) emitRemote(json, updatedAt == null ? 0L : updatedAt);
                    } else {
                        emitStatus("Gotowe", "To konto nie ma jeszcze kopii legacy w chmurze.", "online");
                    }
                })
                .addOnFailureListener(error -> emitStatus("Tryb offline", friendly(error.getMessage()), "pending"));
    }

    @JavascriptInterface
    public void requestSchoolData() {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null) {
            emitSchoolState();
            return;
        }
        startSchoolSync(user);
    }

    @JavascriptInterface
    public void addGrade(String studentId, String subjectId, String teacherId, double value, int weight,
                         String category, String comment, String date) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || activeSchoolId == null || activeSchoolId.isBlank()) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("studentId", studentId);
        payload.put("subjectId", subjectId);
        payload.put("teacherId", teacherId);
        payload.put("value", value);
        payload.put("weight", weight);
        payload.put("category", category);
        payload.put("comment", comment);
        payload.put("date", date);
        payload.put("createdBy", user.getUid());
        payload.put("updatedBy", user.getUid());
        payload.put("createdAt", FieldValue.serverTimestamp());
        payload.put("updatedAt", FieldValue.serverTimestamp());
        payload.put("version", 1);

        firestore.collection("schools").document(activeSchoolId).collection("grades").add(payload)
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void deleteGrade(String id) {
        if (activeSchoolId == null || activeSchoolId.isBlank() || id == null || id.isBlank()) return;
        firestore.collection("schools").document(activeSchoolId).collection("grades").document(id).delete()
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void addTask(String classId, String studentId, String subjectId, String teacherId,
                        String title, String type, String note, String due) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || activeSchoolId == null || activeSchoolId.isBlank()) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("classId", classId);
        payload.put("studentId", studentId);
        payload.put("subjectId", subjectId);
        payload.put("teacherId", teacherId);
        payload.put("title", title);
        payload.put("type", type);
        payload.put("note", note);
        payload.put("due", due);
        payload.put("done", false);
        payload.put("createdBy", user.getUid());
        payload.put("updatedBy", user.getUid());
        payload.put("createdAt", FieldValue.serverTimestamp());
        payload.put("updatedAt", FieldValue.serverTimestamp());
        payload.put("version", 1);

        firestore.collection("schools").document(activeSchoolId).collection("tasks").add(payload)
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void setTaskDone(String id, boolean done) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || activeSchoolId == null || activeSchoolId.isBlank() || id == null || id.isBlank()) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("done", done);
        payload.put("updatedBy", user.getUid());
        payload.put("updatedAt", FieldValue.serverTimestamp());
        payload.put("version", FieldValue.increment(1));

        firestore.collection("schools").document(activeSchoolId).collection("tasks").document(id)
                .set(payload, SetOptions.merge())
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void addAttendance(String studentId, String classId, String subjectId, String teacherId,
                              String date, String state, int lesson) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || activeSchoolId == null || activeSchoolId.isBlank()) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("studentId", studentId);
        payload.put("classId", classId);
        payload.put("subjectId", subjectId);
        payload.put("teacherId", teacherId);
        payload.put("date", date);
        payload.put("state", state);
        payload.put("lesson", lesson);
        payload.put("createdBy", user.getUid());
        payload.put("updatedBy", user.getUid());
        payload.put("createdAt", FieldValue.serverTimestamp());
        payload.put("updatedAt", FieldValue.serverTimestamp());
        payload.put("version", 1);

        firestore.collection("schools").document(activeSchoolId).collection("attendance").add(payload)
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void setActiveSchool(String schoolId) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || schoolId == null || schoolId.isBlank()) return;
        Map<String, Object> payload = new HashMap<>();
        payload.put("activeSchoolId", schoolId);
        firestore.collection("users").document(user.getUid())
                .set(payload, SetOptions.merge())
                .addOnFailureListener(error -> emitError(friendly(error.getMessage())));
    }

    private DocumentReference document(FirebaseUser user) {
        return firestore.collection("users").document(user.getUid()).collection("wolfedu").document("main");
    }

    private void startLegacyListener(FirebaseUser user) {
        stopLegacyListener();
        legacyListener = document(user).addSnapshotListener((snapshot, error) -> {
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

    private void startSchoolSync(FirebaseUser user) {
        stopSchoolListeners();
        loadAvailableSchools(user);

        profileListener = firestore.collection("users").document(user.getUid())
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null) {
                        emitSchoolError(friendly(error.getMessage()));
                        return;
                    }
                    String nextSchoolId = snapshot != null && snapshot.exists() ? snapshot.getString("activeSchoolId") : null;
                    if (nextSchoolId == null) nextSchoolId = "";
                    if (!nextSchoolId.equals(activeSchoolId)) {
                        activeSchoolId = nextSchoolId;
                        attachActiveSchoolListeners(user);
                    } else {
                        emitSchoolState();
                    }
                });
    }

    private void loadAvailableSchools(FirebaseUser user) {
        firestore.collection("schools").whereEqualTo("ownerUid", user.getUid()).get()
                .addOnSuccessListener(snapshot -> {
                    JSONArray array = new JSONArray();
                    for (QueryDocumentSnapshot doc : snapshot) {
                        JSONObject o = new JSONObject();
                        try {
                            o.put("id", doc.getId());
                            o.put("name", value(doc.getString("name")));
                            o.put("city", value(doc.getString("city")));
                            o.put("type", value(doc.getString("type")));
                        } catch (Exception ignored) {}
                        array.put(o);
                    }
                    // If current school is a membership rather than owned, keep it selectable too.
                    boolean found = false;
                    for (int i = 0; i < array.length(); i++) {
                        try { if (activeSchoolId.equals(array.getJSONObject(i).optString("id"))) found = true; } catch (Exception ignored) {}
                    }
                    if (!activeSchoolId.isBlank() && !found) {
                        JSONObject current = new JSONObject();
                        try {
                            current.put("id", activeSchoolId);
                            current.put("name", activeSchoolName.isBlank() ? "Aktywna szkoła" : activeSchoolName);
                        } catch (Exception ignored) {}
                        array.put(current);
                    }
                    availableSchools = array;
                    emitSchoolState();
                })
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    private void attachActiveSchoolListeners(FirebaseUser user) {
        stopActiveSchoolListeners();
        activeSchoolName = "";
        activeRole = "";
        schoolClasses = new JSONArray();
        schoolSubjects = new JSONArray();
        schoolTeachers = new JSONArray();
        schoolStudents = new JSONArray();
        schoolGrades = new JSONArray();
        schoolTasks = new JSONArray();
        schoolAttendance = new JSONArray();
        schoolTimetable = new JSONArray();

        if (activeSchoolId.isBlank()) {
            emitSchoolState();
            return;
        }

        DocumentReference schoolRef = firestore.collection("schools").document(activeSchoolId);
        schoolListener = schoolRef.addSnapshotListener((snapshot, error) -> {
            if (error != null) { emitSchoolError(friendly(error.getMessage())); return; }
            activeSchoolName = snapshot != null && snapshot.exists() ? value(snapshot.getString("name")) : "";
            if (snapshot != null && snapshot.exists() && user.getUid().equals(snapshot.getString("ownerUid"))) {
                activeRole = "owner";
            }
            loadAvailableSchools(user);
            emitSchoolState();
        });

        memberListener = schoolRef.collection("members").document(user.getUid()).addSnapshotListener((snapshot, error) -> {
            if (error == null && snapshot != null && snapshot.exists()) {
                String role = snapshot.getString("role");
                if (role != null && !role.isBlank()) activeRole = role;
            }
            emitSchoolState();
        });

        classesListener = schoolRef.collection("classes").addSnapshotListener((snapshot, error) -> {
            if (error != null) { emitSchoolError(friendly(error.getMessage())); return; }
            schoolClasses = snapshotToJson(snapshot == null ? java.util.Collections.emptyList() : snapshot.getDocuments(), new String[]{"name", "profile"});
            emitSchoolState();
        });

        subjectsListener = schoolRef.collection("subjects").addSnapshotListener((snapshot, error) -> {
            if (error != null) { emitSchoolError(friendly(error.getMessage())); return; }
            schoolSubjects = snapshotToJson(snapshot == null ? java.util.Collections.emptyList() : snapshot.getDocuments(), new String[]{"name", "short"});
            emitSchoolState();
        });

        teachersListener = schoolRef.collection("teachers").addSnapshotListener((snapshot, error) -> {
            if (error != null) { emitSchoolError(friendly(error.getMessage())); return; }
            schoolTeachers = snapshotToJson(snapshot == null ? java.util.Collections.emptyList() : snapshot.getDocuments(), new String[]{"name", "email", "title"});
            emitSchoolState();
        });

        studentsListener = schoolRef.collection("students").addSnapshotListener((snapshot, error) -> {
            if (error != null) { emitSchoolError(friendly(error.getMessage())); return; }
            JSONArray array = new JSONArray();
            if (snapshot != null) {
                for (DocumentSnapshot doc : snapshot.getDocuments()) {
                    JSONObject o = new JSONObject();
                    try {
                        o.put("id", doc.getId());
                        o.put("name", value(doc.getString("name")));
                        o.put("email", value(doc.getString("email")));
                        o.put("classId", value(doc.getString("classId")));
                        o.put("number", value(doc.getString("number")));
                    } catch (Exception ignored) {}
                    array.put(o);
                }
            }
            schoolStudents = array;
            emitSchoolState();
        });

        gradesListener = schoolRef.collection("grades").addSnapshotListener((snapshot, error) -> {
            if (error != null) { emitSchoolError(friendly(error.getMessage())); return; }
            schoolGrades = snapshotToJson(snapshot == null ? java.util.Collections.emptyList() : snapshot.getDocuments(),
                    new String[]{"studentId", "subjectId", "teacherId", "value", "weight", "category", "comment", "date"});
            emitSchoolState();
        });

        tasksListener = schoolRef.collection("tasks").addSnapshotListener((snapshot, error) -> {
            if (error != null) { emitSchoolError(friendly(error.getMessage())); return; }
            schoolTasks = snapshotToJson(snapshot == null ? java.util.Collections.emptyList() : snapshot.getDocuments(),
                    new String[]{"classId", "studentId", "subjectId", "teacherId", "title", "type", "note", "due", "done"});
            emitSchoolState();
        });

        attendanceListener = schoolRef.collection("attendance").addSnapshotListener((snapshot, error) -> {
            if (error != null) { emitSchoolError(friendly(error.getMessage())); return; }
            schoolAttendance = snapshotToJson(snapshot == null ? java.util.Collections.emptyList() : snapshot.getDocuments(),
                    new String[]{"studentId", "classId", "subjectId", "teacherId", "date", "state", "lesson"});
            emitSchoolState();
        });

        timetableListener = schoolRef.collection("timetable").addSnapshotListener((snapshot, error) -> {
            if (error != null) { emitSchoolError(friendly(error.getMessage())); return; }
            JSONArray array = new JSONArray();
            if (snapshot != null) {
                for (DocumentSnapshot doc : snapshot.getDocuments()) {
                    JSONObject o = new JSONObject();
                    try {
                        o.put("id", doc.getId());
                        o.put("classId", value(doc.getString("classId")));
                        Long day = doc.getLong("day");
                        Long lesson = doc.getLong("lesson");
                        Long version = doc.getLong("version");
                        o.put("day", day == null ? 0 : day);
                        o.put("lesson", lesson == null ? 0 : lesson);
                        o.put("subjectId", value(doc.getString("subjectId")));
                        o.put("teacherId", value(doc.getString("teacherId")));
                        o.put("room", value(doc.getString("room")));
                        o.put("start", value(doc.getString("start")));
                        o.put("end", value(doc.getString("end")));
                        o.put("version", version == null ? 0 : version);
                    } catch (Exception ignored) {}
                    array.put(o);
                }
            }
            schoolTimetable = array;
            emitSchoolState();
        });
    }

    private JSONArray snapshotToJson(List<DocumentSnapshot> docs, String[] fields) {
        JSONArray array = new JSONArray();
        for (DocumentSnapshot doc : docs) {
            JSONObject o = new JSONObject();
            try {
                o.put("id", doc.getId());
                for (String field : fields) {
                    Object raw = doc.get(field);
                    o.put(field, raw == null ? "" : raw);
                }
            } catch (Exception ignored) {}
            array.put(o);
        }
        return array;
    }

    private void emitSchoolState() {
        JSONObject payload = new JSONObject();
        try {
            payload.put("activeSchoolId", activeSchoolId);
            payload.put("schoolName", activeSchoolName);
            payload.put("role", activeRole);
            payload.put("schools", availableSchools);
            payload.put("classes", schoolClasses);
            payload.put("subjects", schoolSubjects);
            payload.put("teachers", schoolTeachers);
            payload.put("students", schoolStudents);
            payload.put("grades", schoolGrades);
            payload.put("tasks", schoolTasks);
            payload.put("attendance", schoolAttendance);
            payload.put("timetable", schoolTimetable);
        } catch (Exception ignored) {}
        call("window.wolfSchoolData(" + payload.toString() + ")");
    }

    private void emitSchoolError(String message) {
        call("window.wolfSchoolError(" + JSONObject.quote(message) + ")");
    }

    private void stopLegacyListener() {
        if (legacyListener != null) {
            legacyListener.remove();
            legacyListener = null;
        }
    }

    private void stopActiveSchoolListeners() {
        ListenerRegistration[] regs = {schoolListener, memberListener, classesListener, subjectsListener, teachersListener, studentsListener, gradesListener, tasksListener, attendanceListener, timetableListener};
        for (ListenerRegistration reg : regs) if (reg != null) reg.remove();
        schoolListener = memberListener = classesListener = subjectsListener = teachersListener = studentsListener = gradesListener = tasksListener = attendanceListener = timetableListener = null;
    }

    private void stopSchoolListeners() {
        if (profileListener != null) {
            profileListener.remove();
            profileListener = null;
        }
        stopActiveSchoolListeners();
        activeSchoolId = "";
        activeSchoolName = "";
        activeRole = "";
        availableSchools = new JSONArray();
        emitSchoolState();
    }

    private void emitAuthState() {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null) {
            stopLegacyListener();
            stopSchoolListeners();
            call("window.wolfSyncAuth(false,'')");
        } else {
            startLegacyListener(user);
            startSchoolSync(user);
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

    private String value(String text) { return text == null ? "" : text; }

    private String friendly(String raw) {
        if (raw == null || raw.isBlank()) return "Nie udało się połączyć z chmurą.";
        String text = raw.replace("An internal error has occurred. [", "").replace("]", "");
        if (text.contains("password is invalid") || text.contains("INVALID_LOGIN_CREDENTIALS")) return "Nieprawidłowy e-mail lub hasło.";
        if (text.contains("email address is already in use")) return "Konto z tym adresem już istnieje.";
        if (text.contains("badly formatted")) return "Wpisz poprawny adres e-mail.";
        if (text.contains("at least 6 characters")) return "Hasło musi mieć co najmniej 6 znaków.";
        if (text.contains("PERMISSION_DENIED")) return "Brak uprawnień do danych tej szkoły.";
        if (text.contains("network error") || text.contains("client is offline") || text.contains("UNAVAILABLE")) return "Brak połączenia z WolfCloud. Dane lokalne są bezpieczne; synchronizacja wznowi się automatycznie.";
        return text;
    }
}
