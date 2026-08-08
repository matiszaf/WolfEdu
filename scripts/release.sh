#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

VERSION="${1:-}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Użycie: ./scripts/release.sh X.Y.Z"
  echo "Przykład: ./scripts/release.sh 0.11.7"
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "To nie jest repozytorium Git."
  exit 1
fi

cd "$ROOT"

BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "Nie można wydawać release z detached HEAD."
  exit 1
fi

TAG="v$VERSION"

# Lokalne katalogi robocze/backupy nie powinny zaśmiecać git status.
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

# Synchronizacja informacji o remote bez modyfikowania lokalnego kodu.
echo "Sprawdzam repozytorium..."
git fetch origin --tags --prune

# Nie pozwalaj wydawać z brancha, który jest w tyle za origin.
if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  BEHIND="$(git rev-list --count "HEAD..origin/$BRANCH")"
  if [[ "$BEHIND" != "0" ]]; then
    echo "Twój branch jest $BEHIND commit(ów) za origin/$BRANCH."
    echo "Najpierw wykonaj: git pull --rebase"
    exit 1
  fi
fi

# Recovery: commit release istnieje lokalnie i tag istnieje lokalnie,
# ale tag nie dotarł jeszcze na GitHub.
if git rev-parse "$TAG" >/dev/null 2>&1; then
  if git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
    echo "Tag $TAG już istnieje lokalnie i na GitHubie."
    echo "Ta wersja została już wysłana."
    exit 1
  fi

  TAG_COMMIT="$(git rev-list -n 1 "$TAG")"
  if [[ "$TAG_COMMIT" == "$(git rev-parse HEAD)" ]]; then
    echo "Znaleziono lokalny tag $TAG bez taga na GitHubie."
    echo "Ponawiam tylko wysyłkę brancha i taga..."
    git push origin "$BRANCH"
    git push origin "$TAG"
    echo "Gotowe. GitHub Actions powinien teraz wystartować."
    exit 0
  fi

  echo "Lokalny tag $TAG już istnieje i wskazuje inny commit."
  exit 1
fi

if git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG już istnieje na GitHubie."
  exit 1
fi

CURRENT_VERSION="$(sed -n 's/^VERSION_NAME=//p' version.properties 2>/dev/null | head -n1 || true)"

# Walidacja, że nowa wersja jest faktycznie nowsza.
python3 - "$CURRENT_VERSION" "$VERSION" <<'PY'
import re, sys

old, new = sys.argv[1], sys.argv[2]

def parse(v):
    if not re.fullmatch(r"\d+\.\d+\.\d+", v or ""):
        return None
    return tuple(map(int, v.split(".")))

o = parse(old)
n = parse(new)

if o is not None and n <= o:
    print(f"Nowa wersja {new} musi być większa od obecnej {old}.")
    sys.exit(1)
PY

IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"
VERSION_CODE=$((2000000 + MAJOR*100000000 + MINOR*1000000 + PATCH*10000 + 9999))

if (( VERSION_CODE > 2100000000 )); then
  echo "versionCode przekracza limit Androida: $VERSION_CODE"
  exit 1
fi

# Od razu ustaw numer wersji. Wszystko trafi do JEDNEGO commita release.
cat > version.properties <<EOF
VERSION_NAME=$VERSION
VERSION_CODE=$VERSION_CODE
EOF

# Dodaj wszystkie normalne zmiany projektu.
# Lokalne backupy są ignorowane przez .git/info/exclude.
git add -A

# Bezpiecznik przed przypadkowym wrzuceniem sekretów.
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
  echo "Release został zatrzymany. Te pliki NIE zostały wysłane."
  git reset
  git restore --staged . 2>/dev/null || true
  exit 1
fi

if git diff --cached --quiet; then
  echo "Brak zmian do wydania."
  exit 1
fi

echo
echo "======================================"
echo " WolfEdu Auto Release v2"
echo "======================================"
echo " Obecna wersja: ${CURRENT_VERSION:-nieznana}"
echo " Nowa wersja:   $VERSION"
echo " versionCode:   $VERSION_CODE"
echo " Tag:           $TAG"
echo " Branch:        $BRANCH"
echo "======================================"
echo
echo "Pliki, które trafią do release:"
git diff --cached --name-status
echo

if [[ "${WOLFEDU_RELEASE_YES:-0}" != "1" ]]; then
  read -r -p "Zbudować i opublikować WolfEdu $VERSION przez OTA? [t/N] " ANSWER
  case "$ANSWER" in
    t|T|tak|TAK|Tak|y|Y|yes|YES) ;;
    *)
      echo "Anulowano. Przywracam version.properties."
      git reset
      git restore version.properties 2>/dev/null || true
      exit 0
      ;;
  esac
fi

# Jeden commit: kod + nowy numer wersji.
git commit -m "release: WolfEdu $VERSION"

# Tag na dokładnie tym samym commicie.
git tag -a "$TAG" -m "WolfEdu $VERSION"

echo
echo "1/2 Wysyłam branch $BRANCH..."
git push origin "$BRANCH"

echo
echo "2/2 Wysyłam tag $TAG..."
git push origin "$TAG"

echo
echo "======================================"
echo " RELEASE WYSŁANY"
echo "======================================"
echo "WolfEdu $VERSION"
echo
echo "GitHub Actions:"
echo "  WolfEdu Auto Release"
echo
echo "Po zakończeniu workflow:"
echo "  APK → WolfEdu-Releases → version.json → OTA"
echo
echo "Nie musisz wykonywać żadnych kolejnych komend."
