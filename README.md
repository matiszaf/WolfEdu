# WolfEdu 4.0 — Sync Beta

WolfEdu to polski dziennik szkolny na Androida z ocenami, wagami, frekwencją, planem lekcji, zadaniami i synchronizacją między urządzeniami.

## Nowości 4.0

- konto e-mail i hasło przez Firebase Authentication,
- synchronizacja kompletnego dziennika w Cloud Firestore,
- automatyczne wysyłanie zmian,
- pobieranie nowszej kopii na drugim urządzeniu,
- status synchronizacji w nagłówku,
- działanie lokalne przy braku internetu,
- bezpieczne dane oddzielone według UID użytkownika.

Konfiguracja Firebase znajduje się w pliku `FIREBASE-INSTRUKCJA.md`.

## Budowanie

GitHub Actions wymaga dotychczasowych sekretów podpisu oraz nowego sekretu:

```text
GOOGLE_SERVICES_JSON_BASE64
```

Artefakt wynikowy:

```text
WolfEdu-podpisany-4.0.0-Sync/app-release.apk
```
