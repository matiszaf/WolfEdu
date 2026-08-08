#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

VERSION="${1:-}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Użycie: ./scripts/release.sh X.Y.Z"
  echo "Przykład: ./scripts/release.sh 0.11.2"
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "Nie można wydawać release z detached HEAD."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Repo ma niezapisane zmiany."
  echo "Najpierw zrób commit albo usuń/odłóż zmiany."
  git status --short
  exit 1
fi

TAG="v$VERSION"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG już istnieje lokalnie."
  exit 1
fi

git fetch origin --tags

if git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG już istnieje na GitHubie."
  exit 1
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"
VERSION_CODE=$((2000000 + MAJOR*100000000 + MINOR*1000000 + PATCH*10000 + 9999))

if (( VERSION_CODE > 2100000000 )); then
  echo "versionCode przekracza limit Androida: $VERSION_CODE"
  exit 1
fi

echo
echo "======================================"
echo " WolfEdu Auto Release"
echo " Wersja: $VERSION"
echo " Code:   $VERSION_CODE"
echo " Branch: $BRANCH"
echo "======================================"
echo

if [[ "${WOLFEDU_RELEASE_YES:-0}" != "1" ]]; then
  read -r -p "Publikować tę wersję przez OTA? [t/N] " ANSWER
  case "$ANSWER" in
    t|T|tak|TAK|Tak|y|Y|yes|YES) ;;
    *) echo "Anulowano."; exit 0 ;;
  esac
fi

cat > version.properties <<EOF
VERSION_NAME=$VERSION
VERSION_CODE=$VERSION_CODE
EOF

git add version.properties
git commit -m "release: WolfEdu $VERSION"

git tag -a "$TAG" -m "WolfEdu $VERSION"

echo
echo "Wysyłam commit na origin/$BRANCH..."
git push origin "$BRANCH"

echo
echo "Wysyłam tag $TAG — to uruchomi WolfEdu Auto Release..."
git push origin "$TAG"

echo
echo "Gotowe."
echo "Śledź: GitHub → Actions → WolfEdu Auto Release"
echo "Po zielonym workflowie OTA samo zobaczy WolfEdu $VERSION."
