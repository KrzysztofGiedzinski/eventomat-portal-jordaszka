# Vendored dependencies

## @supabase/supabase-js (UMD)

- **Plik:** `supabase-js-2.110.0.js`
- **Wersja:** `2.110.0` (najnowsza stabilna 2.x w chwili wendorowania)
- **Źródło:** `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/dist/umd/supabase.js`
- **Data pobrania:** 2026-07-01
- **sha384 pobranego pliku:** `sha384-3wY11tldQ5+yWqAvmTN4XtQvnjoTva0cV15O/O/O5NTtp0ivVopSzLOzsVXWZse9`
- **Weryfikacja prowenancji:** jsdelivr Data API (`data.jsdelivr.com/v1/packages/npm/@supabase/supabase-js@2.110.0?structure=flat`)
  zwraca dla `/dist/umd/supabase.js` hash `sha256` w base64: `LbKRLxaTmjshtHKYCnradGszpqQHCLxVXLC+JVxutbE=` (nie SRI/sha384).
  Policzony lokalnie **sha256** pobranego pliku jest identyczny bit-po-bicie: `LbKRLxaTmjshtHKYCnradGszpqQHCLxVXLC+JVxutbE=`.
  Czyli plik jest bajt-w-bajt tym, co jsdelivr deklaruje we własnym API dla tej wersji (niezależna weryfikacja integralności,
  osobna od sha384 powyżej — jsdelivr flat API nie udostępnia hasha w formacie SRI/sha384 w wygodnej formie, więc nie
  dało się zrobić bezpośredniego porównania sha384==sha384; zamiast tego porównano sha256==sha256, co daje ten sam efekt:
  potwierdzenie, że plik pochodzi z oficjalnego jsdelivr i nie został zmodyfikowany po drodze). Cały plik pobrany przez HTTPS.
- **Audyt eval/wasm:** brak `eval(`/`new Function`/`WebAssembly` (grep = 0) → `script-src 'self'` bez `unsafe-eval` wystarcza.

### Dlaczego self-host, nie CDN+SRI

Usuwa trzeci origin (jsdelivr) z modelu zagrożeń: złośliwy JS z CDN nie może już czytać tokenu z `localStorage`. `script-src 'self'` egzekwuje same-origin. Alias `@2` i tak nie nadawał się pod SRI.

### Bump (procedura utrzymaniowa — patrz RUNBOOK §Utrzymanie)

Przy security-advisory supabase-js: pobierz nowy pinowany UMD do `assets/vendor/` (nazwa = nowa wersja), powtórz weryfikację prowenancji + grep eval, podmień `src` w `index.html`+`admin.html`, uruchom `pnpm test:portal-e2e` (w eventomat-app), commit z wersją w nazwie.
