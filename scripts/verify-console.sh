#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

JS="console/app/src/main/assets/js/app.js"
BRIDGE="console/app/src/main/java/pl/wolfedu/console/ConsoleBridge.java"
INDEX="console/app/src/main/assets/index.html"
CSS="console/app/src/main/assets/css/console.css"

echo "=== WolfEdu Console preflight ==="

for f in "$JS" "$BRIDGE" "$INDEX" "$CSS"; do
  test -s "$f" || {
    echo "BRAK: $f"
    exit 1
  }
done

node --check "$JS"

python3 - "$JS" "$BRIDGE" <<'PY'
from pathlib import Path
import re, sys

js = Path(sys.argv[1]).read_text(encoding="utf-8")
bridge = Path(sys.argv[2]).read_text(encoding="utf-8")

required_views = [
    "dashboard",
    "schoolsView",
    "adminsView",
    "releasesView",
    "diagnosticsView",
    "schoolDetailsView",
]

definitions = set(re.findall(
    r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\(",
    js
))

missing = [name for name in required_views if name not in definitions]
if missing:
    print("BRAK WIDOKÓW:", ", ".join(missing))
    raise SystemExit(1)

router_match = re.search(
    r"const\s+routes\s*=\s*\{(.*?)\};",
    js,
    re.S
)

if not router_match:
    print("BRAK centralnego routera routes.")
    raise SystemExit(1)

router_targets=set()

for raw in router_match.group(1).split(","):
    raw=raw.strip()
    if not raw:
        continue
    target=raw.split(":",1)[1].strip() if ":" in raw else raw
    if re.fullmatch(r"[A-Za-z_$][\w$]*",target):
        router_targets.add(target)

missing_router=sorted(router_targets-definitions)

if missing_router:
    print(
        "Router odwołuje się do nieistniejących funkcji:",
        ", ".join(missing_router)
    )
    raise SystemExit(1)

calls=set(re.findall(
    r"\bWolfConsole\.([A-Za-z_$][\w$]*)\s*\(",
    js
))

native_methods=set(re.findall(
    r"@JavascriptInterface\s+public\s+void\s+([A-Za-z_$][\w$]*)\s*\(",
    bridge,
    re.S
))

missing_native=sorted(calls-native_methods)

if missing_native:
    print(
        "Frontend wywołuje brakujące metody ConsoleBridge:",
        ", ".join(missing_native)
    )
    raise SystemExit(1)

for forbidden in [
    "BuildConfig.VERSION_NAME",
    "BuildConfig.VERSION_CODE",
    "activity.getPackageManager()",
    "activity.getPackageName()",
]:
    if forbidden in bridge:
        print("Znaleziono niedozwolony/stary fragment:",forbidden)
        raise SystemExit(1)

print("Widoki routera: OK")
print("WolfConsole ↔ ConsoleBridge: OK")
print("Stare referencje BuildConfig/activity: OK")
PY

grep -q 'data-page="dashboard"' "$INDEX"
grep -q 'data-page="schools"' "$INDEX"
grep -q 'data-page="admins"' "$INDEX"
grep -q 'data-page="releases"' "$INDEX"
grep -q 'data-page="diagnostics"' "$INDEX"

echo "index.html navigation: OK"
echo "CSS: OK"
echo "=== PREFLIGHT OK ==="
