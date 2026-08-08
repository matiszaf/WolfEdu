# WolfEdu Console — start

## 1. Osobny katalog / repo

```bash
cd ~
mkdir -p WolfEdu-Console
cp -rf ~/storage/downloads/WolfEdu-Console-0.1.0/. ~/WolfEdu-Console/
cd ~/WolfEdu-Console
git init
git branch -M develop
```

## 2. Firebase Android app

W projekcie Firebase `wolf-edu` dodaj NOWĄ aplikację Android:

```text
Package name: pl.wolfedu.console
App nickname: WolfEdu Console
```

Pobierz jej `google-services.json`.

Nie używaj pliku od `pl.wolfedu.app`.

## 3. Secret Firebase dla GitHub Actions

W Termuxie, mając pobrany właściwy plik:

```bash
base64 -w 0 google-services.json
```

Wynik zapisz na GitHubie jako:

```text
CONSOLE_GOOGLE_SERVICES_JSON_BASE64
```

Do repo Console dodaj również te same sekrety podpisu co w WolfEdu:
- `KEYSTORE_BASE64`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`

## 4. Firestore

Przeczytaj:
- `docs/BOOTSTRAP.md`
- `docs/FIRESTORE-RULES-SNIPPET.rules`

Najpierw utwórz ręcznie własny wpis `systemAdmins/{UID}`.

## 5. GitHub

Po utworzeniu osobnego repo:

```bash
git add -A
git commit -m "feat: WolfEdu Console 0.1.0"
git remote add origin <ADRES_REPO>
git push -u origin develop
```

Actions zbuduje podpisane APK.
