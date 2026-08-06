# Aktualizacja projektu do WolfEdu 3.0

```bash
cd ~/MojDziennik
git checkout main
git pull origin main
cp -rf ~/storage/downloads/WolfEdu-3.0-Rebranding/. .
git add -A
git commit -m "Rebranding aplikacji na WolfEdu 3.0"
git push origin main
```

Pobierz artefakt `WolfEdu-podpisany-3.0.0`. Ponieważ zmienia się identyfikator aplikacji na `pl.wolfedu.app`, WolfEdu zainstaluje się jednorazowo jako nowa aplikacja. Kolejne wersje WolfEdu będą już zwykłymi aktualizacjami.
