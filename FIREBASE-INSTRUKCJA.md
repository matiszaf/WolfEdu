# WolfEdu 4.0 — konfiguracja synchronizacji Firebase

Synchronizacja działa przez **Firebase Authentication** i **Cloud Firestore**. Aplikacja nadal zapisuje dane lokalnie, więc można z niej korzystać bez internetu. Po odzyskaniu połączenia Firestore wysyła oczekujące zmiany.

## 1. Utwórz darmowy projekt

1. Otwórz konsolę Firebase i wybierz **Add project / Dodaj projekt**.
2. Nazwij go np. `WolfEdu`.
3. Google Analytics nie jest wymagane — możesz je wyłączyć.

## 2. Dodaj aplikację Android

W projekcie Firebase wybierz ikonę Androida i wpisz dokładnie:

```text
pl.wolfedu.app
```

Nazwa aplikacji może być `WolfEdu Android`. SHA-1 nie jest potrzebny dla logowania e-mail/hasło.

Pobierz plik:

```text
google-services.json
```

## 3. Włącz logowanie e-mail i hasłem

W Firebase przejdź do:

```text
Build → Authentication → Get started → Sign-in method
```

Włącz dostawcę:

```text
Email/Password
```

Nie musisz włączać opcji „Email link”.

## 4. Utwórz bazę Firestore

Przejdź do:

```text
Build → Firestore Database → Create database
```

Wybierz region możliwie blisko Polski. Na początek możesz wybrać tryb produkcyjny, a następnie wkleić reguły poniżej.

## 5. Ustaw bezpieczne reguły Firestore

W zakładce **Rules** wklej:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

Kliknij **Publish**. Te reguły pozwalają użytkownikowi czytać i zapisywać tylko dane przypisane do jego własnego UID.

## 6. Dodaj konfigurację jako GitHub Secret

W Termuxie przejdź do folderu, w którym znajduje się pobrany `google-services.json`, np.:

```bash
cd ~/storage/downloads
base64 google-services.json | tr -d '\n' > google-services-base64.txt
cat google-services-base64.txt
```

Skopiuj cały długi wynik.

Na GitHubie przejdź do:

```text
Repozytorium → Settings → Secrets and variables → Actions
```

Dodaj sekret:

```text
Name: GOOGLE_SERVICES_JSON_BASE64
Secret: cały ciąg Base64
```

Nie umieszczaj `google-services.json` publicznie w repozytorium. Workflow odtworzy go wyłącznie na czas budowania APK.

## 7. Zbuduj aplikację

Po dodaniu sekretu wykonaj `git push`. Workflow utworzy artefakt:

```text
WolfEdu-podpisany-4.0.0-Sync
```

W nim znajduje się podpisany `app-release.apk`.

## Jak używać synchronizacji

1. Otwórz **Opcje → Synchronizacja WolfCloud**.
2. Utwórz konto e-mail i hasło lub zaloguj się.
3. Na drugim telefonie zainstaluj WolfEdu i zaloguj się tym samym kontem.
4. Nowsza kopia danych zostanie pobrana automatycznie.

## Ważne ograniczenie wersji 4.0

W tej wersji jedno konto synchronizuje jeden kompletny dziennik. Role szkoły, nauczyciela, ucznia i rodzica oraz współdzielenie danych między różnymi kontami będą kolejnym etapem. Obecna synchronizacja służy przede wszystkim do korzystania z tych samych danych na wielu urządzeniach i tworzenia kopii w chmurze.
