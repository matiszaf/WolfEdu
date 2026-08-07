# Changelog

## 4.1.0
- nowy WolfSync dla struktury `schools/{schoolId}`
- profil użytkownika i rola szkoły
- wybór aktywnej szkoły
- plan lekcji realtime z panelu WWW
- klasy, przedmioty i nauczyciele pobierani z Firestore
- stary `users/{uid}/wolfedu/main` pozostaje jako fallback

# Changelog

## 4.0.2
- Naprawiono połączenie z nazwanym Firestore `default` zamiast domyślnej bazy `(default)`.
- Ulepszono obsługę trybu offline WolfSync.
- Chwilowy brak sieci nie jest już pokazywany jako krytyczny błąd synchronizacji.


## 4.0.1
- Włączono AndroidX wymagany przez Firebase Authentication i Firestore.
- Włączono Jetifier dla zgodności zależności.
- Naprawiono błąd `mergeReleaseNativeLibs` w GitHub Actions.

[4.0.0] — Sync Beta

### Dodano
- Firebase Authentication: rejestracja i logowanie e-mail/hasło.
- Cloud Firestore do synchronizacji danych między urządzeniami.
- Automatyczny zapis zmian do chmury.
- Pobieranie nowszej kopii danych w czasie rzeczywistym.
- Status synchronizacji w nagłówku i ustawieniach.
- GitHub Secret `GOOGLE_SERVICES_JSON_BASE64`.
- Reguły Firestore ograniczające dostęp do właściciela konta.

### Architektura
- Natywny most JavaScript–Firebase w `FirebaseSyncBridge.java`.
- Lokalne dane pozostają źródłem działania offline.


## [3.0.0]
- Rebranding aplikacji na WolfEdu
- Zmiana identyfikatora aplikacji na `pl.wolfedu.app`
- Nowa identyfikacja wizualna i ekran startowy
- Zachowanie modułów ocen, planu, frekwencji i zadań
- Podpisane wydania APK przez GitHub Actions

## [2.2.0]
- Zadania domowe, sprawdziany, kartkówki i projekty
- Terminy, priorytety, filtry i oznaczanie wykonania

## [2.1.0]
- Oceny z wagami
- Średnia ważona
- Edycja, usuwanie i kalkulator wymaganej oceny
