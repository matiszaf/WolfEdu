# Aktualizacja do 2.2.0 z telefonu

1. Rozpakuj ZIP w folderze Pobrane.
2. W Termuxie wykonaj:

```bash
cd ~/MojDziennik
git checkout main
git pull origin main
cp -rf ~/storage/downloads/MojDziennik-2.2-Zadania/. .
git add -A
git commit -m "Dodano zadania i sprawdziany"
git push origin main
```

3. Na GitHubie otwórz Actions i pobierz artefakt `MojDziennik-podpisany-2.2.0`.
4. Zainstaluj `app-release.apk` jako aktualizację.
