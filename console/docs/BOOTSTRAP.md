# Pierwszy dostęp do WolfEdu Console

Console celowo NIE potrafi nadać pierwszego administratora sama sobie.

1. Zaloguj konto, którego chcesz używać jako twórca systemu, do Firebase Authentication.
2. Firebase Console → Authentication → Users → skopiuj UID tego konta.
3. Firestore Database → utwórz kolekcję `systemAdmins`.
4. Utwórz dokument o ID równym UID.
5. Dodaj pola:
   - `uid` (string) = ten sam UID
   - `email` (string) = e-mail konta
   - `role` (string) = `creator`

Przykład:

```text
systemAdmins/
  abc123UID/
    uid: "abc123UID"
    email: "twoj@email.pl"
    role: "creator"
```

Dopiero po tym konto będzie mogło wejść do WolfEdu Console.
