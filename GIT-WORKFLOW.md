# WolfEdu — Git Workflow

## Gałęzie
- `main` — stabilna wersja
- `develop` — rozwój
- `feature/*` — nowe funkcje
- `hotfix/*` — szybkie poprawki

## Commity
Używamy Conventional Commits, np.:
- `feat(android): dodano oceny realtime`
- `feat(web): dodano plan lekcji`
- `fix(sync): poprawiono pobieranie szkoły`
- `docs: aktualizacja README`

## Buildy rozwojowe
Push na `develop`, `feature/*`, `hotfix/*` lub `main` uruchamia CI i tworzy podpisany artefakt, np.:
`0.9.0-dev.123+develop`

## Release
Po przetestowaniu kodu na `main`:

```bash
./scripts/release.sh 0.9.0-beta.1
```

Skrypt tworzy tag `v0.9.0-beta.1`. GitHub Actions automatycznie:
1. buduje podpisane APK,
2. dołącza numer wersji do nazwy APK,
3. tworzy GitHub Release,
4. generuje release notes.

## Pierwsze utworzenie develop
```bash
git checkout main
git pull origin main
git checkout -b develop
git push -u origin develop
```
