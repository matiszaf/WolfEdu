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
    private ListenerRegistration membersDirectoryListener;
    private ListenerRegistration schoolInvitesListener;
    private ListenerRegistration personalInvitesListener;

    private String activeSchoolId = "";
    private String activeSchoolName = "";
    private String activeRole = "";
    private String activeSchoolSystemStatus = "active";
    private String activeSchoolSystemStatusReason = "";
    private JSONArray schoolClasses = new JSONArray();
    private JSONArray schoolSubjects = new JSONArray();
    private JSONArray schoolTeachers = new JSONArray();
    private JSONArray schoolStudents = new JSONArray();
    private JSONArray schoolGrades = new JSONArray();
    private JSONArray schoolTasks = new JSONArray();
    private JSONArray schoolAttendance = new JSONArray();
    private JSONArray schoolTimetable = new JSONArray();
    private JSONArray availableSchools = new JSONArray();
    private JSONArray schoolMembers = new JSONArray();
    private JSONArray schoolInvites = new JSONArray();
    private JSONArray myInvites = new JSONArray();

    public FirebaseSyncBridge(WebView webView) {
        this.webView = webView;
        this.auth = FirebaseAuth.getInstance();
        this.firestore = FirebaseFirestore.getInstance("default");
        auth.addAuthStateListener(ignored -> emitAuthState());
    }

    @JavascriptInterface
    public void requestAuthState() {
        emitAuthState();
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

    private boolean hasActiveSchool() {
        return activeSchoolId != null
                && !activeSchoolId.isBlank()
                && !"suspended".equals(activeSchoolSystemStatus)
                && !"maintenance".equals(activeSchoolSystemStatus);
    }

    private Map<String, Object> auditPayload(FirebaseUser user) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("updatedBy", user.getUid());
        payload.put("updatedAt", FieldValue.serverTimestamp());
        return payload;
    }

    @JavascriptInterface
    public void createCloudSchool(String name, String city, String type, String schoolYear) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || name == null || name.trim().isEmpty()) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("name", name.trim());
        payload.put("city", city == null ? "" : city.trim());
        payload.put("type", type == null ? "" : type.trim());
        payload.put("schoolYear", schoolYear == null ? "" : schoolYear.trim());
        payload.put("ownerUid", user.getUid());
        payload.put("createdAt", FieldValue.serverTimestamp());
        payload.put("updatedAt", FieldValue.serverTimestamp());

        firestore.collection("schools").add(payload)
                .addOnSuccessListener(ref -> {
                    Map<String, Object> member = new HashMap<>();
                    member.put("uid", user.getUid());
                    member.put("email", value(user.getEmail()));
                    member.put("role", "owner");
                    member.put("joinedAt", FieldValue.serverTimestamp());

                    ref.collection("members").document(user.getUid()).set(member)
                            .addOnSuccessListener(unused -> {
                                Map<String, Object> profile = new HashMap<>();
                                profile.put("activeSchoolId", ref.getId());
                                firestore.collection("users").document(user.getUid())
                                        .set(profile, SetOptions.merge())
                                        .addOnSuccessListener(done -> {
                                            loadAvailableSchools(user);
                                            emitStatus("Gotowe", "Szkoła została utworzona.", "online");
                                        })
                                        .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
                            })
                            .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
                })
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void addCloudClass(String name, String profile) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || !hasActiveSchool() || name == null || name.trim().isEmpty()) return;
        Map<String, Object> payload = auditPayload(user);
        payload.put("name", name.trim());
        payload.put("profile", profile == null ? "" : profile.trim());
        payload.put("createdAt", FieldValue.serverTimestamp());
        payload.put("createdBy", user.getUid());
        firestore.collection("schools").document(activeSchoolId).collection("classes").add(payload)
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void deleteCloudClass(String id) {
        if (!hasActiveSchool() || id == null || id.isBlank()) return;
        firestore.collection("schools").document(activeSchoolId).collection("classes").document(id).delete()
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void addCloudStudent(String name, String classId, String number, String email) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || !hasActiveSchool() || name == null || name.trim().isEmpty()) return;
        Map<String, Object> payload = auditPayload(user);
        payload.put("name", name.trim());
        payload.put("classId", classId == null ? "" : classId);
        payload.put("number", number == null ? "" : number.trim());
        payload.put("email", email == null ? "" : email.trim());
        payload.put("createdAt", FieldValue.serverTimestamp());
        payload.put("createdBy", user.getUid());
        firestore.collection("schools").document(activeSchoolId).collection("students").add(payload)
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void deleteCloudStudent(String id) {
        if (!hasActiveSchool() || id == null || id.isBlank()) return;
        firestore.collection("schools").document(activeSchoolId).collection("students").document(id).delete()
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void addCloudTeacher(String name, String email, String title) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || !hasActiveSchool() || name == null || name.trim().isEmpty()) return;
        Map<String, Object> payload = auditPayload(user);
        payload.put("name", name.trim());
        payload.put("email", email == null ? "" : email.trim());
        payload.put("title", title == null ? "" : title.trim());
        payload.put("createdAt", FieldValue.serverTimestamp());
        payload.put("createdBy", user.getUid());
        firestore.collection("schools").document(activeSchoolId).collection("teachers").add(payload)
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void deleteCloudTeacher(String id) {
        if (!hasActiveSchool() || id == null || id.isBlank()) return;
        firestore.collection("schools").document(activeSchoolId).collection("teachers").document(id).delete()
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void addCloudSubject(String name, String shortName) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || !hasActiveSchool() || name == null || name.trim().isEmpty()) return;
        Map<String, Object> payload = auditPayload(user);
        payload.put("name", name.trim());
        payload.put("short", shortName == null ? "" : shortName.trim().toUpperCase());
        payload.put("createdAt", FieldValue.serverTimestamp());
        payload.put("createdBy", user.getUid());
        firestore.collection("schools").document(activeSchoolId).collection("subjects").add(payload)
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void deleteCloudSubject(String id) {
        if (!hasActiveSchool() || id == null || id.isBlank()) return;
        firestore.collection("schools").document(activeSchoolId).collection("subjects").document(id).delete()
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void saveCloudLesson(String id, String classId, int day, int lesson, String subjectId,
                                String teacherId, String room, String start, String end) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || !hasActiveSchool() || classId == null || classId.isBlank()
                || subjectId == null || subjectId.isBlank()) return;

        Map<String, Object> payload = auditPayload(user);
        payload.put("classId", classId);
        payload.put("day", day);
        payload.put("lesson", lesson);
        payload.put("subjectId", subjectId);
        payload.put("teacherId", teacherId == null ? "" : teacherId);
        payload.put("room", room == null ? "" : room.trim());
        payload.put("start", start == null ? "" : start);
        payload.put("end", end == null ? "" : end);

        if (id == null || id.isBlank()) {
            payload.put("createdAt", FieldValue.serverTimestamp());
            payload.put("createdBy", user.getUid());
            payload.put("version", 1);
            firestore.collection("schools").document(activeSchoolId).collection("timetable").add(payload)
                    .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
        } else {
            payload.put("version", FieldValue.increment(1));
            firestore.collection("schools").document(activeSchoolId).collection("timetable").document(id)
                    .set(payload, SetOptions.merge())
                    .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
        }
    }

    @JavascriptInterface
    public void deleteCloudLesson(String id) {
        if (!hasActiveSchool() || id == null || id.isBlank()) return;
        firestore.collection("schools").document(activeSchoolId).collection("timetable").document(id).delete()
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void addGrade(String studentId, String subjectId, String teacherId, double value, int weight,
                         String category, String comment, String date) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || !hasActiveSchool()) return;

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
        if (!hasActiveSchool() || id == null || id.isBlank()) return;
        firestore.collection("schools").document(activeSchoolId).collection("grades").document(id).delete()
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void addTask(String classId, String studentId, String subjectId, String teacherId,
                        String title, String type, String note, String due) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || !hasActiveSchool()) return;

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
        if (user == null || !hasActiveSchool() || id == null || id.isBlank()) return;

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
        if (user == null || !hasActiveSchool()) return;

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

    private boolean isAdminRole() {
        String role = activeRole == null ? "" : activeRole.toLowerCase();
        return role.equals("owner") || role.equals("admin") || role.equals("director");
    }

    @JavascriptInterface
    public void inviteSchoolMember(String email, String role) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || !hasActiveSchool() || !isAdminRole()) return;

        String cleanEmail = email == null ? "" : email.trim();
        String cleanRole = role == null ? "" : role.trim().toLowerCase();
        if (cleanEmail.isEmpty() || !(cleanRole.equals("admin") || cleanRole.equals("director")
                || cleanRole.equals("teacher") || cleanRole.equals("parent") || cleanRole.equals("student"))) {
            emitSchoolError("Wpisz poprawny e-mail i wybierz rolę.");
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("schoolId", activeSchoolId);
        payload.put("schoolName", activeSchoolName);
        payload.put("email", cleanEmail);
        payload.put("role", cleanRole);
        payload.put("createdBy", user.getUid());
        payload.put("createdAt", FieldValue.serverTimestamp());

        firestore.collection("schoolInvites").add(payload)
                .addOnSuccessListener(ref -> emitStatus("Zaproszenie wysłane", cleanEmail + " · " + cleanRole, "online"))
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void cancelSchoolInvite(String inviteId) {
        if (!isAdminRole() || inviteId == null || inviteId.isBlank()) return;
        firestore.collection("schoolInvites").document(inviteId).delete()
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void acceptSchoolInvite(String inviteId) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || inviteId == null || inviteId.isBlank()) return;

        DocumentReference inviteRef = firestore.collection("schoolInvites").document(inviteId);
        inviteRef.get().addOnSuccessListener(invite -> {
            if (!invite.exists()) {
                emitSchoolError("Zaproszenie już nie istnieje.");
                return;
            }

            String email = value(invite.getString("email"));
            String userEmail = value(user.getEmail());
            if (!email.equalsIgnoreCase(userEmail)) {
                emitSchoolError("To zaproszenie jest przypisane do innego adresu e-mail.");
                return;
            }

            String schoolId = value(invite.getString("schoolId"));
            String role = value(invite.getString("role"));
            if (schoolId.isBlank() || role.isBlank()) {
                emitSchoolError("Zaproszenie jest nieprawidłowe.");
                return;
            }

            Map<String, Object> member = new HashMap<>();
            member.put("uid", user.getUid());
            member.put("email", userEmail);
            member.put("role", role);
            member.put("inviteId", inviteId);
            member.put("joinedAt", FieldValue.serverTimestamp());

            firestore.collection("schools").document(schoolId).collection("members").document(user.getUid())
                    .set(member)
                    .addOnSuccessListener(done -> {
                        Map<String, Object> profile = new HashMap<>();
                        profile.put("activeSchoolId", schoolId);
                        firestore.collection("users").document(user.getUid()).set(profile, SetOptions.merge())
                                .addOnSuccessListener(profileDone -> inviteRef.delete()
                                        .addOnSuccessListener(deleted -> {
                                            emitStatus("Dołączono do szkoły", value(invite.getString("schoolName")), "online");
                                            loadAvailableSchools(user);
                                        })
                                        .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage()))))
                                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
                    })
                    .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
        }).addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void rejectSchoolInvite(String inviteId) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || inviteId == null || inviteId.isBlank()) return;
        firestore.collection("schoolInvites").document(inviteId).delete()
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void changeMemberRole(String uid, String role) {
        if (!hasActiveSchool() || !isAdminRole() || uid == null || uid.isBlank()) return;
        String cleanRole = role == null ? "" : role.trim().toLowerCase();
        if (!(cleanRole.equals("admin") || cleanRole.equals("director") || cleanRole.equals("teacher")
                || cleanRole.equals("parent") || cleanRole.equals("student"))) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("role", cleanRole);
        payload.put("updatedAt", FieldValue.serverTimestamp());
        FirebaseUser user = auth.getCurrentUser();
        if (user != null) payload.put("updatedBy", user.getUid());

        firestore.collection("schools").document(activeSchoolId).collection("members").document(uid)
                .set(payload, SetOptions.merge())
                .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
    }

    @JavascriptInterface
    public void removeSchoolMember(String uid) {
        if (!hasActiveSchool() || !isAdminRole() || uid == null || uid.isBlank()) return;
        firestore.collection("schools").document(activeSchoolId).get()
                .addOnSuccessListener(school -> {
                    if (uid.equals(value(school.getString("ownerUid")))) {
                        emitSchoolError("Nie można usunąć właściciela szkoły.");
                        return;
                    }
                    firestore.collection("schools").document(activeSchoolId).collection("members").document(uid).delete()
                            .addOnFailureListener(error -> emitSchoolError(friendly(error.getMessage())));
                })
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
        attachPersonalInvitesListener(user);

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
        activeSchoolSystemStatus = "active";
        activeSchoolSystemStatusReason = "";
        schoolClasses = new JSONArray();
        schoolSubjects = new JSONArray();
        schoolTeachers = new JSONArray();
        schoolStudents = new JSONArray();
        schoolGrades = new JSONArray();
        schoolTasks = new JSONArray();
        schoolAttendance = new JSONArray();
        schoolTimetable = new JSONArray();
        schoolMembers = new JSONArray();
        schoolInvites = new JSONArray();

        if (activeSchoolId.isBlank()) {
            emitSchoolState();
            return;
        }

        DocumentReference schoolRef = firestore.collection("schools").document(activeSchoolId);
        schoolListener = schoolRef.addSnapshotListener((snapshot, error) -> {
            if (error != null) { emitSchoolError(friendly(error.getMessage())); return; }
            activeSchoolName = snapshot != null && snapshot.exists() ? value(snapshot.getString("name")) : "";

            if (snapshot != null && snapshot.exists()) {
                String status = value(snapshot.getString("systemStatus")).trim().toLowerCase();
                activeSchoolSystemStatus = status.isBlank() ? "active" : status;
                activeSchoolSystemStatusReason = value(snapshot.getString("systemStatusReason"));

                if (user.getUid().equals(snapshot.getString("ownerUid"))) {
                    activeRole = "owner";
                }
            } else {
                activeSchoolSystemStatus = "active";
                activeSchoolSystemStatusReason = "";
            }

            refreshAdminListeners(user, schoolRef);
            loadAvailableSchools(user);
            emitSchoolState();
        });

        memberListener = schoolRef.collection("members").document(user.getUid()).addSnapshotListener((snapshot, error) -> {
            if (error == null && snapshot != null && snapshot.exists()) {
                String role = snapshot.getString("role");
                if (role != null && !role.isBlank()) activeRole = role;
            }
            refreshAdminListeners(user, schoolRef);
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

    private void attachPersonalInvitesListener(FirebaseUser user) {
        if (personalInvitesListener != null) {
            personalInvitesListener.remove();
            personalInvitesListener = null;
        }
        String email = value(user.getEmail());
        if (email.isBlank()) {
            myInvites = new JSONArray();
            emitSchoolState();
            return;
        }

        personalInvitesListener = firestore.collection("schoolInvites").whereEqualTo("email", email)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null) {
                        emitSchoolError(friendly(error.getMessage()));
                        return;
                    }
                    myInvites = snapshotToJson(snapshot == null ? java.util.Collections.emptyList() : snapshot.getDocuments(),
                            new String[]{"schoolId", "schoolName", "email", "role"});
                    emitSchoolState();
                });
    }

    private void refreshAdminListeners(FirebaseUser user, DocumentReference schoolRef) {
        if (!isAdminRole()) {
            stopAdminListeners();
            schoolMembers = new JSONArray();
            schoolInvites = new JSONArray();
            return;
        }

        if (membersDirectoryListener == null) {
            membersDirectoryListener = schoolRef.collection("members").addSnapshotListener((snapshot, error) -> {
                if (error != null) { emitSchoolError(friendly(error.getMessage())); return; }
                schoolMembers = snapshotToJson(snapshot == null ? java.util.Collections.emptyList() : snapshot.getDocuments(),
                        new String[]{"uid", "email", "role", "inviteId"});
                emitSchoolState();
            });
        }

        if (schoolInvitesListener == null) {
            schoolInvitesListener = firestore.collection("schoolInvites").whereEqualTo("schoolId", activeSchoolId)
                    .addSnapshotListener((snapshot, error) -> {
                        if (error != null) { emitSchoolError(friendly(error.getMessage())); return; }
                        schoolInvites = snapshotToJson(snapshot == null ? java.util.Collections.emptyList() : snapshot.getDocuments(),
                                new String[]{"schoolId", "schoolName", "email", "role"});
                        emitSchoolState();
                    });
        }
    }

    private void stopAdminListeners() {
        if (membersDirectoryListener != null) {
            membersDirectoryListener.remove();
            membersDirectoryListener = null;
        }
        if (schoolInvitesListener != null) {
            schoolInvitesListener.remove();
            schoolInvitesListener = null;
        }
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
            payload.put("systemStatus", activeSchoolSystemStatus);
            payload.put("systemStatusReason", activeSchoolSystemStatusReason);
            payload.put("schools", availableSchools);
            payload.put("classes", schoolClasses);
            payload.put("subjects", schoolSubjects);
            payload.put("teachers", schoolTeachers);
            payload.put("students", schoolStudents);
            payload.put("grades", schoolGrades);
            payload.put("tasks", schoolTasks);
            payload.put("attendance", schoolAttendance);
            payload.put("timetable", schoolTimetable);
            payload.put("members", schoolMembers);
            payload.put("invites", schoolInvites);
            payload.put("myInvites", myInvites);
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
        stopAdminListeners();
    }

    private void stopSchoolListeners() {
        if (profileListener != null) {
            profileListener.remove();
            profileListener = null;
        }
        stopActiveSchoolListeners();
        if (personalInvitesListener != null) { personalInvitesListener.remove(); personalInvitesListener = null; }
        myInvites = new JSONArray();
        activeSchoolId = "";
        activeSchoolName = "";
        activeRole = "";
        activeSchoolSystemStatus = "active";
        activeSchoolSystemStatusReason = "";
        availableSchools = new JSONArray();
        emitSchoolState();
    }

    private void emitAuthState() {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null) {
            stopLegacyListener();
            stopSchoolListeners();
            call("window.wolfSyncAuth(false,'','')");
        } else {
            startLegacyListener(user);
            startSchoolSync(user);
            call("window.wolfSyncAuth(true," + JSONObject.quote(user.getEmail() == null ? "" : user.getEmail()) + "," + JSONObject.quote(user.getUid()) + ")");
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
