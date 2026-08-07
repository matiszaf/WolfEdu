# Changelog

## [Unreleased]

### Planowane
- oceny w nowej strukturze szkoły,
- frekwencja,
- zadania,
- wiadomości i powiadomienia.

## [0.9.0-beta.1]

### Dodano
- aplikację Android WolfEdu,
- panel WWW,
- Firebase Authentication,
- Firestore i WolfSync,
- szkoły, klasy, uczniów, nauczycieli i przedmioty,
- plan lekcji realtime,
- stałe podpisywanie APK,
- automatyczne buildy GitHub Actions,
- wersjonowanie SemVer i automatyczne GitHub Releases.

### Migracja
- stary dokument `users/{uid}/wolfedu/main` pozostaje jako fallback podczas migracji do `schools/{schoolId}/...`.
