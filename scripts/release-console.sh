#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

VERSION="${1:-}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Użycie: ./scripts/release-console.sh X.Y.Z"
  echo "Przykład: ./scripts/release-console.sh 2.0.0"
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "To nie jest repozytorium Git."
  exit 1
fi

cd "$ROOT"

if [[ ! -x scripts/verify-console.sh ]]; then
  echo "Brakuje scripts/verify-console.sh."
  echo "Release Console został zatrzymany."
  exit 1
fi

echo
echo "Uruchamiam pełny preflight Console..."
scripts/verify-console.sh
echo

BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "Nie można wydawać Console z detached HEAD."
  exit 1
fi

TAG="console-v$VERSION"

# Lokalnie ignorujemy backupy i śmieci robocze.
GIT_EXCLUDE=".git/info/exclude"
touch "$GIT_EXCLUDE"

add_local_exclude() {
  local pattern="$1"
  grep -qxF "$pattern" "$GIT_EXCLUDE" 2>/dev/null || echo "$pattern" >> "$GIT_EXCLUDE"
}

add_local_exclude ".*-backup/"
add_local_exclude ".gradle/"
add_local_exclude ".idea/"
add_local_exclude "**/build/"

echo "Sprawdzam repozytorium..."
git fetch origin --tags --prune

if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  BEHIND="$(git rev-list --count "HEAD..origin/$BRANCH")"
  if [[ "$BEHIND" != "0" ]]; then
    echo "Twój branch jest $BEHIND commit(ów) za origin/$BRANCH."
    echo "Najpierw wykonaj: git pull --rebase"
    exit 1
  fi
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  if git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
    echo "Tag $TAG już istnieje lokalnie i na GitHubie."
    exit 1
  fi

  TAG_COMMIT="$(git rev-list -n 1 "$TAG")"
  if [[ "$TAG_COMMIT" == "$(git rev-parse HEAD)" ]]; then
    echo "Znaleziono lokalny tag $TAG bez taga na GitHubie."
    echo "Ponawiam push brancha i taga..."
    git push origin "$BRANCH"
    git push origin "$TAG"
    exit 0
  fi

  echo "Lokalny tag $TAG już istnieje i wskazuje inny commit."
  exit 1
fi

if git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG już istnieje na GitHubie."
  exit 1
fi

# Wydajemy tylko zmiany Console + workflow/skrypt Console.
git add console .github/workflows/build-console.yml scripts/release-console.sh scripts/verify-console.sh

# Blokada sekretów.
DANGEROUS="$(
  git diff --cached --name-only | grep -Ei \
  '(^|/)(google-services\.json|local\.properties|\.env($|\.)|.*\.(jks|keystore|p12|pfx|pem|key))$' \
  || true
)"

if [[ -n "$DANGEROUS" ]]; then
  echo
  echo "BLOKADA: wykryto pliki, które mogą zawierać sekrety:"
  echo "$DANGEROUS"
  echo
  echo "Release Console został zatrzymany."
  git reset
  exit 1
fi

echo
echo "======================================"
echo " WolfEdu Console Auto Release"
echo "======================================"
echo " Wersja: $VERSION"
echo " Tag:    $TAG"
echo " Branch: $BRANCH"
echo "======================================"
echo

if git diff --cached --quiet; then
  echo "Brak nowych zmian Console do commita."
  echo "Utworzę release tag na aktualnym commicie."
else
  echo "Zmiany Console do wydania:"
  git diff --cached --name-status
  echo
fi

if [[ "${WOLFEDU_RELEASE_YES:-0}" != "1" ]]; then
  read -r -p "Zbudować WolfEdu Console $VERSION? [t/N] " ANSWER
  case "$ANSWER" in
    t|T|tak|TAK|Tak|y|Y|yes|YES) ;;
    *)
      echo "Anulowano."
      git reset
      exit 0
      ;;
  esac
fi

if ! git diff --cached --quiet; then
  git commit -m "release(console): WolfEdu Console $VERSION"
fi

git tag -a "$TAG" -m "WolfEdu Console $VERSION"

echo
echo "1/2 Wysyłam branch $BRANCH..."
git push origin "$BRANCH"

echo
echo "2/2 Wysyłam tag $TAG..."
git push origin "$TAG"

echo
echo "======================================"
echo " CONSOLE RELEASE WYSŁANY"
echo "======================================"
echo "WolfEdu Console $VERSION"
echo
echo "GitHub Actions:"
echo "  WolfEdu Console CI"
echo
echo "Gotowy APK znajdziesz w Artifacts workflowa:"
echo "  WolfEdu-Console-$VERSION"
