# Mój Dziennik — Android

Darmowy, lokalny dziennik szkolny po polsku.

## Funkcje
- własna szkoła,
- klasy i uczniowie,
- oceny,
- frekwencja,
- plan lekcji,
- eksport/import kopii JSON,
- wszystkie dane przechowywane lokalnie na telefonie.

## Budowanie APK w Android Studio
1. Otwórz folder projektu.
2. Poczekaj na synchronizację Gradle.
3. Wybierz **Build > Build APK(s)**.
4. Plik znajdziesz w `app/build/outputs/apk/debug/app-debug.apk`.

Projekt używa Android Gradle Plugin 8.13.2, Java 17 i nie wymaga zewnętrznych bibliotek.

## Wersja 2.0.0
- nowy ekran główny z szybkimi skrótami,
- podsumowanie ocen i frekwencji,
- najbliższa lekcja na dziś,
- tryb ciemny,
- zachowanie danych z wersji 1.0,
- automatyczne buildy także dla `develop` i `feature/**`.

## Podpisane aktualizacje

Projekt buduje teraz podpisane `app-release.apk` przy użyciu czterech sekretów GitHub Actions:

- `KEYSTORE_BASE64`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`

Pierwsze przejście ze starego APK debug na APK release wymaga jednorazowego odinstalowania starej aplikacji. Każda kolejna wersja podpisana tym samym kluczem instaluje się już jako zwykła aktualizacja.
