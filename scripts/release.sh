#!/data/data/com.termux/files/usr/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Użycie: ./scripts/release.sh 0.9.0-beta.1"
  exit 1
fi

VERSION="$1"
TAG="v$VERSION"

git status --porcelain | grep -q . && {
  echo "Masz niezapisane zmiany. Najpierw commit/push."
  exit 1
}

git fetch origin
git tag -a "$TAG" -m "WolfEdu $VERSION"
git push origin "$TAG"

echo "Gotowe. GitHub Actions zbuduje APK i utworzy Release $TAG."
