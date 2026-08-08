# WolfEdu Console 0.1.0

Osobna aplikacja operatorska platformy WolfEdu.

Package:
`pl.wolfedu.console`

## 0.1.0
- logowanie Firebase,
- twarda kontrola `systemAdmins/{uid}`,
- dashboard systemu,
- lista wszystkich szkół,
- aktywacja/zawieszanie szkoły,
- lista administratorów systemowych,
- dodawanie administratora po UID,
- zmiana roli `admin` / `creator`,
- usuwanie globalnego dostępu (bez możliwości usunięcia samego siebie).

## Bezpieczeństwo
Posiadanie APK nie daje żadnych praw. Dostęp wymaga zalogowanego konta z dokumentem `systemAdmins/{uid}` i odpowiednich reguł Firestore.
