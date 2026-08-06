# Budowanie APK na telefonie przez GitHub Actions

## 1. Utwórz repozytorium
1. Wejdź w aplikacji lub przeglądarce na GitHub.
2. Naciśnij `+` → **New repository**.
3. Nazwij je np. `MojDziennik`.
4. Wybierz **Private**, jeśli nie chcesz udostępniać kodu publicznie.
5. Nie zaznaczaj dodawania README, `.gitignore` ani licencji.
6. Naciśnij **Create repository**.

## 2. Wgraj projekt
Najłatwiej rozpakować ten ZIP w aplikacji ZArchiver. Następnie w repozytorium:
1. Naciśnij **Add file** → **Upload files**.
2. Wgraj wszystkie pliki i foldery znajdujące się wewnątrz projektu, w tym ukryty folder `.github`.
3. Pliki `build.gradle`, `settings.gradle` i folder `app` muszą znajdować się bezpośrednio na głównej stronie repozytorium.
4. Naciśnij **Commit changes**.

> Ważne: nie wgrywaj całego folderu jako jednego pliku ZIP. GitHub Actions musi widzieć rozpakowane pliki.

## 3. Uruchom budowanie
1. Otwórz zakładkę **Actions**.
2. Wybierz workflow **Zbuduj APK**.
3. Naciśnij **Run workflow** → **Run workflow**.
4. Po zakończeniu otwórz zakończone uruchomienie.
5. Na dole strony, w sekcji **Artifacts**, pobierz `MojDziennik-APK`.
6. Rozpakuj pobrany plik ZIP. W środku będzie `app-debug.apk`.

## 4. Zainstaluj APK
1. Otwórz `app-debug.apk`.
2. Android może poprosić o zgodę na instalowanie aplikacji z tego źródła.
3. Włącz zgodę tylko dla używanej przeglądarki lub menedżera plików.
4. Zainstaluj aplikację.

Każde kolejne wgranie zmian do gałęzi `main` lub `master` automatycznie uruchomi nowe budowanie APK.
