// ── Anti-clickjacking (framebuster) ──────────────────────────────────────────
// frame-ancestors nieosiągalne w meta-CSP na GitHub Pages (patrz REJESTR-ADVISORY).
// Same-origin → mieści się w script-src 'self'. W ramce: ukryj i wybij z niej.
if (window.top !== window.self) {
  try { document.documentElement.style.display = 'none'; } catch (e) {}
  try { window.top.location = window.self.location; } catch (e) {}
}
// ── Konfiguracja ──────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://svhrrwqbajyflvnspuda.supabase.co';
const SUPABASE_ANON = 'sb_publishable__q1Op2Wc8lk-HEsGUOhCYg_U8jTUNyg';
// Token klienta (RESPONDENT) — ustalany niżej z URL ?t= / localStorage / legacy (Tor B magic-link).

// Sekret admina NIE jest zaszyty w stronie — podajesz go w URL: ?view=admin&token=<sekret>.
// Autoryzację robi serwer (RPC waliduje token); strona przekazuje tylko to, co w URL.
// Scala paramy z query (?) i fragmentu (#); fragment wygrywa. Backward-compat: ?t= nadal działa.
// MIRROR kontraktu eventomat-app/src/lib/portal-params.ts (DŁUG-22 — token bearer poza query).
const params     = new URLSearchParams(location.search);
new URLSearchParams(location.hash.slice(1)).forEach((v, k) => params.set(k, v));
// ── Token klienta (Tor B magic-link): z URL ?t=<token> → localStorage. ──
// Token NIE jest w bundlu. Link osobisty: …/?t=<token>. Bez tokenu = brak dostępu
// (legacy 'jordaszka' zrotowany i zdezaktywowany — Faza C zakończona 2026-06-24).
const CLIENT_LS = 'eventomat_client_token';
let RESPONDENT = params.get('t') || '';
if (RESPONDENT) { try { localStorage.setItem(CLIENT_LS, RESPONDENT); } catch {} }
else { try { RESPONDENT = localStorage.getItem(CLIENT_LS) || ''; } catch {} }
// ── Tryb widoku ──────────────────────────────────────────────────────────────
// Problem: ikona dodana do ekranu głównego startuje z manifestu (start_url './'),
// więc gubi ?view=admin&token=… → portal otwierał się jako klient. Rozwiązanie:
// zapamiętujemy token admina w localStorage TEGO urządzenia. Wejście bez jawnego
// ?view=client (i bez ?preview=1) na urządzeniu z zapisaną sesją → Widok admina.
const ADMIN_LS   = 'eventomat_admin_token';
const wantClient = params.get('view') === 'client' || params.get('preview') === '1';
// Tryb standalone = uruchomienie z ikony na ekranie głównym (PWA), a NIE klik w zwykły link.
// Dzięki temu goły link (karta przeglądarki) zawsze pokazuje klienta, nawet na urządzeniu admina;
// admina z 'gołego' adresu dostajemy wyłącznie z ikony.
const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  || window.navigator.standalone === true;
let isAdmin = false, adminToken = '';
if (params.get('view') === 'admin') {
  isAdmin = true; adminToken = params.get('token') || '';
  if (adminToken) { try { localStorage.setItem(ADMIN_LS, adminToken); } catch {} }   // zapamiętaj sesję na tym urządzeniu
} else if (!wantClient && isStandalone) {
  let saved = ''; try { saved = localStorage.getItem(ADMIN_LS) || ''; } catch {}
  if (saved) { isAdmin = true; adminToken = saved; }                                  // ikona (standalone) → Widok admina
}
// Źródło wizyty: każde urządzenie z zapamiętaną sesją admina to Krzysztof → 'owner'
// (bez konieczności pamiętania o ?preview=1). Telefon Jordanów nie ma tej sesji → 'client'.
// ?preview=1 zostaje jako ręczne wymuszenie 'owner' (np. na świeżym urządzeniu).
let deviceIsOwner = false;
try { deviceIsOwner = !!localStorage.getItem(ADMIN_LS); } catch {}
const VISIT_SOURCE = (deviceIsOwner || params.get('preview') === '1') ? 'owner' : 'client';
// DŁUG-22: po odczycie tokenu z URL zdejmij fragment (#t=) z widocznego adresu —
// token żyje już w localStorage. Usuwa go z paska adresu/historii/zakładek/„kopiuj link"
// na tym urządzeniu. Zostawiamy query (?view=/?preview=, legacy ?t=) bez zmian.
try { history.replaceState(null, '', location.pathname + location.search); } catch {}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const root = document.getElementById('root');
const pill = document.getElementById('pill');
const pillText = document.getElementById('pill-text');
let pillTimer;
function showPill(state, text) {
  pill.className = 'save-pill show' + (state ? ' ' + state : '');
  pillText.textContent = text;
  clearTimeout(pillTimer);
  if (state !== 'saving') pillTimer = setTimeout(() => pill.classList.remove('show'), 2200);
}

const LS_KEY = 'portal_' + RESPONDENT;
function lsLoad() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
function lsSave(k, v) { const d = lsLoad(); d[k] = v; localStorage.setItem(LS_KEY, JSON.stringify(d)); }

// ── Zapis odpowiedzi (debounce) ────────────────────────────────────────────────
const timers = {};
function queueSave(key, value) {
  lsSave(key, value);
  paintProgress();
  clearTimeout(timers[key]);
  showPill('saving', 'Zapisywanie…');
  timers[key] = setTimeout(() => save(key, value), 550);
}
async function save(key, value) {
  const { error } = await sb.rpc('submit_workshop_answer', { p_token: RESPONDENT, p_key: key, p_answer: value, p_note: null });
  if (error) { showPill('error', 'Błąd zapisu — zachowane lokalnie'); console.error(error); }
  else showPill('', 'Zapisano ✓');
}

const RECIP = { dominika: { icon: '👤', name: 'Dominika', sub: 'Operacje i fakty z codziennej obsługi' },
                grzegorz: { icon: '👤', name: 'Grzegorz', sub: 'Tematy techniczne — system hotelowy i sala' } };

// ── Render: portal klienta ──────────────────────────────────────────────────────
const KIND_LABEL = { pytanie: 'Pytanie', komunikat: 'Komunikat', postep: 'Postęp prac', uwaga: 'Uwaga' };

// „załatwione": pytanie = ma jakąkolwiek odpowiedź; komunikat = potwierdzony
function isDone(msg, answers) {
  if ((msg.fields || []).length) return msg.fields.some(f => { const v = answers[f.key]; return v != null && v !== ''; });
  if (msg.kind === 'komunikat') return answers['ack_' + msg.id] != null;
  return false;
}
function deferState(msg, answers) {
  const v = answers['defer_' + msg.id];
  return (v === 'nie_wiem' || v === 'grzegorz') ? v : '';
}

function renderRefresh() { renderPortal(CURRENT_FEED, lsLoad()); }

function renderDeferRow(msg, answers) {
  const wrap = document.createElement('div'); wrap.className = 'defer-row';
  const cur = deferState(msg, answers);
  wrap.innerHTML = '<span class="defer-label">Nie teraz?</span>';
  [['nie_wiem', 'Jeszcze nie wiem'], ['grzegorz', 'To pytanie do Grzegorza']].forEach(([val, lab]) => {
    const b = document.createElement('button'); b.className = 'defer-btn' + (cur === val ? ' on' : '');
    b.textContent = lab;
    b.addEventListener('click', () => { queueSave('defer_' + msg.id, cur === val ? '' : val); renderRefresh(); });
    wrap.appendChild(b);
  });
  return wrap;
}

function renderCard(msg, answers, delay) {
  const el = document.createElement('section');
  el.className = 'card k-' + msg.kind;
  el.style.animationDelay = delay + 'ms';
  el.innerHTML =
    `<div class="kicker ${esc(msg.kind)}">${KIND_LABEL[msg.kind] || 'Wpis'}</div>` +
    `<div class="q-title">${esc(msg.title)}</div>` +
    (msg.body ? `<p class="q-intro">${esc(msg.body)}</p>` : '') +
    (msg.rec ? `<div class="rec"><b>Moja propozycja</b>${esc(msg.rec)}</div>` : '');
  if ((msg.fields || []).length) {
    msg.fields.forEach(f => el.appendChild(renderField(f, answers)));
  } else if (msg.kind === 'komunikat') {
    el.appendChild(renderAck(msg.id, answers['ack_' + msg.id]));
  }
  if (msg.kind === 'pytanie' && !isDone(msg, answers)) {
    el.appendChild(renderDeferRow(msg, answers));
  }
  return el;
}

// ── Pasek postępu odpowiedzi (liczy tylko pytania; aktualizowany na żywo) ──
let CURRENT_FEED = null, progressEl = null;
function progressNumbers() {
  const ans = lsLoad();
  const qs = (CURRENT_FEED || []).filter(m => m.kind === 'pytanie');
  const done = qs.filter(m => isDone(m, ans)).length;
  const deferred = qs.filter(m => !isDone(m, ans) && deferState(m, ans)).length;
  return { done, deferred, total: qs.length };
}
function paintProgress() {
  if (!progressEl) return;
  const { done, deferred, total } = progressNumbers();
  if (total === 0) { progressEl.style.display = 'none'; return; }
  progressEl.style.display = '';
  if (done + deferred >= total) {
    progressEl.className = 'progress done';
    progressEl.innerHTML = `<div class="pdone-title">Wszystko z głowy! 🎉</div>` +
      `<div class="pdone-sub">Odpowiedzieliście na wszystkie pytania — dzięki! Możecie wracać i zmieniać odpowiedzi (w Historii). Gdy dorzucę nowe, pojawią się tutaj i dam znać.</div>`;
  } else {
    progressEl.className = 'progress';
    const pct = Math.round(done / total * 100);
    const deferNote = deferred > 0 ? ` · ${deferred} odłożone` : '';
    progressEl.innerHTML = `<div class="ptop"><span>Wasze odpowiedzi</span><span class="pcount">${done} z ${total} pytań${deferNote}</span></div>` +
      `<div class="pbar"><div class="pfill" style="width:${pct}%"></div></div>`;
  }
}

function renderPortal(feed, answers) {
  root.innerHTML = '';
  CURRENT_FEED = feed;
  const active = [], deferred = [], history = [];
  feed.forEach(m => {
    if (isDone(m, answers)) history.push(m);
    else if (deferState(m, answers)) deferred.push(m);
    else active.push(m);
  });

  // ── Pasek postępu (na górze) ──
  progressEl = document.createElement('div');
  root.appendChild(progressEl);
  paintProgress();

  // ── Aktywne — pełne karty, pogrupowane po adresacie ──
  let lastRecip = null, delay = 0;
  active.forEach(msg => {
    if (msg.recipient !== 'oboje' && msg.recipient !== lastRecip) {
      lastRecip = msg.recipient;
      const r = RECIP[msg.recipient];
      if (r) {
        const sh = document.createElement('div'); sh.className = 'section-head';
        sh.innerHTML = `<div class="chip ${esc(msg.recipient)}">${r.icon}</div><div><h2>${r.name}</h2><p>${r.sub}</p></div>`;
        root.appendChild(sh);
      }
    } else if (msg.recipient === 'oboje') { lastRecip = null; }
    root.appendChild(renderCard(msg, answers, (delay += 55)));
  });

  // ── Do wyjaśnienia — odłożone świadomie ──
  if (deferred.length) {
    const dSec = document.createElement('div'); dSec.className = 'section-defer';
    const dHead = document.createElement('div'); dHead.className = 'section-head';
    dHead.innerHTML = `<div class="chip">⏸</div><div><h2>Do wyjaśnienia</h2><p>Pytania odłożone — wróćcie, gdy będziecie gotowi.</p></div>`;
    dSec.appendChild(dHead);
    deferred.forEach(msg => {
      const card = renderCard(msg, answers, (delay += 55));
      const state = deferState(msg, answers);
      const reasonLabel = state === 'grzegorz' ? 'To pytanie do Grzegorza' : 'Jeszcze nie wiem';
      const badge = document.createElement('div'); badge.className = 'defer-reason-badge';
      badge.textContent = reasonLabel;
      card.insertBefore(badge, card.firstChild.nextSibling);
      dSec.appendChild(card);
    });
    root.appendChild(dSec);
  }

  root.appendChild(renderReplyBox());

  // ── Historia — załatwione; każdy wpis domknięty do jednej linii (klik = pełna karta) ──
  if (history.length) {
    const det = document.createElement('details'); det.className = 'historia';
    const sum = document.createElement('summary');
    sum.innerHTML = `Historia — załatwione <span class="hist-count">${history.length}</span>`;
    det.appendChild(sum);
    const hint = document.createElement('p'); hint.className = 'hist-hint';
    hint.textContent = 'Kliknij wpis, żeby go rozwinąć i zmienić odpowiedź — zapisze się sama.';
    det.appendChild(hint);
    history.forEach(msg => {
      const item = document.createElement('details'); item.className = 'hist-item k-' + msg.kind;
      const s = document.createElement('summary');
      const who = RECIP[msg.recipient] ? RECIP[msg.recipient].name : '';
      s.innerHTML = `<span class="hi-dot"></span><span class="hi-title">${esc(msg.title)}</span><span class="hi-meta">${who} ✓</span>`;
      item.appendChild(s);
      const body = document.createElement('div'); body.className = 'hi-body';
      body.appendChild(renderCard(msg, answers, 0));
      item.appendChild(body);
      det.appendChild(item);
    });
    root.appendChild(det);
  }
}

function renderAck(id, acked) {
  const wrap = document.createElement('div'); wrap.className = 'ack-row';
  if (acked) {
    wrap.innerHTML = `<span class="ack-done">Przeczytane ✓ <span class="when">${fmtWhen(acked)}</span></span>`;
    return wrap;
  }
  const btn = document.createElement('button'); btn.className = 'btn ghost'; btn.textContent = 'Przeczytane ✓';
  btn.addEventListener('click', () => {
    const stamp = new Date().toISOString();
    queueSave('ack_' + id, stamp);
    wrap.innerHTML = `<span class="ack-done">Przeczytane ✓ <span class="when">${fmtWhen(stamp)}</span></span>`;
  });
  wrap.appendChild(btn);
  return wrap;
}

function renderField(f, answers) {
  const savedVal = answers[f.key];
  const wrap = document.createElement('div'); wrap.className = 'field';
  if (f.type === 'radio') {
    const lab = document.createElement('label'); lab.className = 'flabel'; lab.textContent = f.label; wrap.appendChild(lab);
    const opts = document.createElement('div'); opts.className = 'opts';
    // pole „dopisz" — odsłaniane, gdy wybrana opcja prosi o dopisanie (np. „Mam uwagi (dopisz)")
    const noteKey = f.key + '_dopisz';
    const note = document.createElement('textarea'); note.className = 'dopisz'; note.placeholder = 'Dopisz tutaj…';
    if (answers[noteKey]) note.value = answers[noteKey];
    note.addEventListener('input', () => queueSave(noteKey, note.value));
    const needsNote = o => /dopisz/i.test(o || '');
    const syncNote = sel => { note.style.display = needsNote(sel) ? 'block' : 'none'; };
    f.options.forEach(o => {
      const l = document.createElement('label'); l.className = 'opt'; if (savedVal === o) l.classList.add('checked');
      const inp = document.createElement('input'); inp.type = 'radio'; inp.name = f.key; if (savedVal === o) inp.checked = true;
      l.appendChild(inp); l.appendChild(document.createTextNode(o));
      inp.addEventListener('change', () => { opts.querySelectorAll('.opt').forEach(x => x.classList.remove('checked')); l.classList.add('checked'); queueSave(f.key, o); syncNote(o); });
      opts.appendChild(l);
    });
    wrap.appendChild(opts);
    wrap.appendChild(note);
    syncNote(savedVal);
  } else {
    wrap.classList.add('uwagi');
    const lab = document.createElement('label'); lab.textContent = f.label; wrap.appendChild(lab);
    const ta = document.createElement('textarea'); ta.placeholder = f.placeholder || ''; if (savedVal) ta.value = savedVal;
    ta.addEventListener('input', () => queueSave(f.key, ta.value));
    wrap.appendChild(ta);
  }
  return wrap;
}

function renderReplyBox() {
  const sec = document.createElement('div'); sec.className = 'reply';
  sec.innerHTML = `<div class="section-head"><div class="chip">✉️</div><div><h2>Napiszcie do mnie</h2><p>Pytanie, uwaga, cokolwiek — odezwę się.</p></div></div>`;
  const card = document.createElement('div'); card.className = 'reply-card';
  card.innerHTML = `<h3>Wiadomość do mnie</h3><p>Macie pytanie albo coś do dodania? Piszcie śmiało.</p>`;
  const ta = document.createElement('textarea'); ta.placeholder = 'Napiszcie tutaj…';
  const row = document.createElement('div'); row.className = 'row';
  const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = 'Wyślij';
  row.appendChild(btn);
  const sentBox = document.createElement('div'); sentBox.className = 'sent-list';
  async function renderSent() {
    const { data, error } = await sb.rpc('get_my_inbound', { p_token: RESPONDENT });
    const list = error ? [] : (data || []);
    sentBox.innerHTML = list.length ? '<div class="k" style="font-size:12px;color:var(--ink-soft);margin-top:6px">Wasze wiadomości:</div>' : '';
    list.forEach(s => {
      const item = document.createElement('div'); item.className = 'sent-item';
      item.innerHTML = `${esc(s.body)}<span class="when">${fmtWhen(s.created_at)}</span>`;
      if (s.reply) {
        const rep = document.createElement('div'); rep.className = 'sent-reply';
        rep.innerHTML = `<span class="rep-who">Krzysztof:</span> ${esc(s.reply)}<span class="when">${fmtWhen(s.replied_at)}</span>`;
        item.appendChild(rep);
      }
      sentBox.appendChild(item);
    });
  }
  btn.addEventListener('click', async () => {
    const body = ta.value.trim(); if (!body) return;
    btn.disabled = true; btn.textContent = 'Wysyłam…';
    const { error } = await sb.rpc('send_portal_message', { p_token: RESPONDENT, p_body: body });
    if (error) { showPill('error', 'Nie udało się wysłać'); btn.disabled = false; btn.textContent = 'Wyślij'; console.error(error); return; }
    // powiadom Krzysztofa mailem (fire-and-forget — wiadomość jest już zapisana w bazie)
    fetch(SUPABASE_URL + '/functions/v1/notify-owner', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SUPABASE_ANON, 'apikey': SUPABASE_ANON, 'content-type': 'application/json' },
      body: JSON.stringify({ token: RESPONDENT, body }),
    }).catch(e => console.error('notify-owner', e));
    ta.value = ''; await renderSent();
    showPill('', 'Wysłano ✓'); btn.disabled = false; btn.textContent = 'Wyślij';
  });
  card.appendChild(ta); card.appendChild(row); card.appendChild(sentBox);
  sec.appendChild(card);
  setTimeout(renderSent, 0);
  return sec;
}

// ── Render: widok administratora ────────────────────────────────────────────────
// „odpowiedziany" wpis: komunikat = potwierdzony; pytanie = ma co najmniej jedną odpowiedź.

// liczy aktywne pytania bez żadnej odpowiedzi (do auto-podpowiedzi treści maila)
function countWaitingQuestions(feed, ans) {
  return feed.filter(m => m.kind === 'pytanie' && !adminIsAnswered(m, ans)).length;
}
async function notifyJordanowie(intro, btn) {
  const bar = btn.closest('.notify-bar');
  btn.disabled = true; btn.textContent = 'Wysyłam…';
  showPill('saving', 'Wysyłam powiadomienie…');
  try {
    const r = await fetch(SUPABASE_URL + '/functions/v1/notify-jordanowie', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SUPABASE_ANON, 'apikey': SUPABASE_ANON, 'content-type': 'application/json' },
      body: JSON.stringify({ token: adminToken, intro }),
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'błąd');
    showPill('', 'Powiadomienie wysłane ✓');
    // sukces → zwiń pasek do potwierdzenia (znika formularz); „Wyślij kolejne" go przywraca
    if (bar) {
      bar.innerHTML = '<div class="nb-title">Powiadomienie wysłane ✓</div>' +
        '<p style="font-size:13.5px;color:var(--ink-soft);margin-bottom:12px">Mail z linkiem do portalu poszedł do Jordanów.</p>';
      const again = document.createElement('button');
      again.className = 'btn ghost'; again.textContent = 'Wyślij kolejne';
      again.addEventListener('click', () => renderAdmin());
      bar.appendChild(again);
    }
  } catch (e) {
    showPill('error', 'Nie udało się wysłać'); console.error(e);
    btn.disabled = false; btn.textContent = 'Powiadom Jordanów';
  }
}

function adminDefer(msg, ans) {
  const v = ans['defer_' + msg.id] && ans['defer_' + msg.id].answer;
  return (v === 'nie_wiem' || v === 'grzegorz') ? v : '';
}
function adminIsAnswered(msg, ans) {
  if (msg.kind === 'komunikat') return ans['ack_' + msg.id] != null;
  return (msg.fields || []).some(f => ans[f.key] != null);
}

// karta jednego wpisu w tablicy admina (odpowiedzi / potwierdzenie)
function buildAdminCard(msg, ans) {
  const box = document.createElement('section'); box.className = 'card';
  box.innerHTML = `<div class="kicker ${msg.kind==='komunikat'?'k':'q'}">${msg.kind==='komunikat'?'Komunikat':'Pytanie'} · ${RECIP[msg.recipient]?RECIP[msg.recipient].name:'Oboje'}</div><div class="q-title">${esc(msg.title)}</div>`;
  if (msg.kind === 'pytanie') {
    const d = adminDefer(msg, ans);
    if (d) {
      const tag = document.createElement('div'); tag.className = 'defer-tag';
      tag.textContent = d === 'grzegorz' ? 'Odłożone → do Grzegorza' : 'Odłożone → jeszcze nie wie';
      box.appendChild(tag);
    }
  }
  if (msg.kind === 'komunikat') {
    const a = ans['ack_' + msg.id];
    const row = document.createElement('div'); row.className = 'admin-row';
    row.innerHTML = `<div class="${a?'a':'a empty'}">${a?'Przeczytane ✓ '+fmtWhen(a.answer):'— nie potwierdzono —'}</div><span class="badge ${a?'done':'wait'}">${a?'ok':'czeka'}</span>`;
    box.appendChild(row);
  } else {
    (msg.fields || []).forEach(f => {
      const a = ans[f.key]; const row = document.createElement('div'); row.className = 'admin-row';
      const val = a ? esc(String(a.answer)) : '— czeka —';
      row.innerHTML = `<div><div class="k">${esc(f.label)}</div><div class="a ${a?'':'empty'}">${val}</div>${a?`<div class="k" style="margin-top:4px">${fmtWhen(a.updated_at)}</div>`:''}</div><span class="badge ${a?'done':'wait'}">${a?'odpowiedziano':'czeka'}</span>`;
      box.appendChild(row);
    });
  }
  return box;
}

async function deleteVisit(id, btn) {
  if (!confirm('Usunąć ten wpis o wizycie?')) return;
  btn.disabled = true; btn.textContent = 'Usuwam…';
  const { error } = await sb.rpc('delete_portal_visit', { p_token: adminToken, p_id: id });
  if (error) { showPill('error', 'Nie udało się usunąć'); btn.disabled = false; btn.textContent = 'Usuń'; console.error(error); return; }
  showPill('', 'Usunięto ✓'); renderAdmin();
}
async function clearVisits(source, btn) {
  if (!confirm('Usunąć wszystkie Twoje wpisy testowe (źródło „ja/test")?')) return;
  btn.disabled = true; btn.textContent = 'Czyszczę…';
  const { error } = await sb.rpc('delete_portal_visits_by_source', { p_token: adminToken, p_source: source });
  if (error) { showPill('error', 'Nie udało się wyczyścić'); btn.disabled = false; btn.textContent = 'Wyczyść testy'; console.error(error); return; }
  showPill('', 'Wyczyszczono ✓'); renderAdmin();
}

function buildVisitsGroup(list, label, owner) {
  const frag = document.createDocumentFragment();
  const head = document.createElement('div'); head.className = 'subhead' + (owner ? ' owner' : '');
  head.innerHTML = `${esc(label)} <span class="scount">${list.length}</span>`;
  if (owner && list.length) {
    const clr = document.createElement('button'); clr.className = 'btn-clear'; clr.textContent = 'Wyczyść testy';
    clr.addEventListener('click', () => clearVisits('owner', clr));
    head.appendChild(clr);
  }
  frag.appendChild(head);
  if (!list.length) {
    const e = document.createElement('div'); e.className = 'empty-note'; e.textContent = owner ? '— brak Twoich wizyt testowych —' : '— jeszcze nikt nie wszedł —';
    frag.appendChild(e);
  }
  list.forEach(v => {
    const d = document.createElement('div'); d.className = 'admin-row';
    d.innerHTML = `<div><div class="a">${fmtWhen(v.opened_at)}</div><div class="k" style="margin-top:4px">na portalu ${fmtDur(v.seconds)} · ostatnio ${fmtWhen(v.last_seen_at)}</div></div>`;
    const actions = document.createElement('div'); actions.className = 'vis-actions';
    actions.innerHTML = `<span class="badge ${owner?'wait':'done'}">${owner?'ja/test':'klient'}</span>`;
    const del = document.createElement('button'); del.className = 'btn-del'; del.textContent = 'Usuń';
    del.addEventListener('click', () => deleteVisit(v.id, del));
    actions.appendChild(del);
    d.appendChild(actions);
    frag.appendChild(d);
  });
  return frag;
}

async function renderAdmin() {
  document.body.classList.add('admin-mode');   // desktop: tablica na pełną szerokość
  document.getElementById('page-tag').textContent = 'Widok administratora';
  document.getElementById('page-title').textContent = 'Tablica portalu — Jordaszka';
  document.getElementById('page-lede').innerHTML = 'Podgląd na żywo: odpowiedzi, potwierdzenia i wiadomości od Jordanów.';
  const adminFooter = document.getElementById('page-footer');
  adminFooter.innerHTML = 'Widok administratora · <a href="?view=client" style="color:var(--accent-deep);text-decoration:none">podgląd jako klient</a> · <a href="#" id="admin-unlink" style="color:var(--ink-soft);text-decoration:none">odepnij to urządzenie</a>';
  adminFooter.querySelector('#admin-unlink').addEventListener('click', e => {
    e.preventDefault();
    if (!confirm('Odpiąć sesję admina od tego urządzenia? Ponowne wejście wymaga linku z tokenem.')) return;
    try { localStorage.removeItem(ADMIN_LS); } catch {}
    location.href = '?view=client';
  });

  const [feedR, ansR, inbR, visR] = await Promise.all([
    sb.rpc('get_portal_feed', { p_token: adminToken }),
    sb.rpc('get_workshop_answers', { p_token: adminToken }),
    sb.rpc('get_portal_inbound', { p_token: adminToken }),
    sb.rpc('get_portal_visits', { p_token: adminToken }),
  ]);
  if (feedR.error || ansR.error) { root.innerHTML = `<div class="toast-error">Błąd odczytu: ${esc((feedR.error||ansR.error).message)}</div>`; return; }
  const ans = {}; (ansR.data || []).forEach(r => ans[r.question_key] = r);
  const feed = feedR.data || [];
  const waiting  = feed.filter(m => !adminIsAnswered(m, ans));
  const answered = feed.filter(m =>  adminIsAnswered(m, ans));
  const visits = visR && !visR.error ? (visR.data || []) : [];
  const visClient = visits.filter(v => v.source !== 'owner');
  const visOwner  = visits.filter(v => v.source === 'owner');
  const inb = inbR.error ? [] : (inbR.data || []);
  root.innerHTML = '';

  // ── Skrzynka — przypięta na górze (poza zakładkami) ──
  const inbox = document.createElement('section'); inbox.className = 'card pinned-inbox';
  inbox.innerHTML = `<div class="kicker k">Skrzynka</div><div class="q-title">Wiadomości od Jordanów ${inb.length?`<span class="hist-count">${inb.length}</span>`:''}</div>`;
  if (!inb.length) inbox.innerHTML += `<p class="q-intro">— brak wiadomości —</p>`;
  inb.forEach(m => {
    const d = document.createElement('div'); d.className = 'admin-row';
    d.innerHTML = `<div><div class="a">${esc(m.body)}</div><div class="k" style="margin-top:4px">${fmtWhen(m.created_at)}</div></div>`;
    const reply = document.createElement('div'); reply.className = 'inbox-reply';
    const ta = document.createElement('textarea'); ta.placeholder = 'Twoja odpowiedź…'; if (m.reply) ta.value = m.reply;
    const rb = document.createElement('button'); rb.className = 'btn ghost'; rb.textContent = m.reply ? 'Zapisz zmianę' : 'Odpowiedz';
    rb.addEventListener('click', async () => {
      rb.disabled = true; showPill('saving', 'Zapisuję…');
      const { error } = await sb.rpc('reply_to_inbound', { p_token: adminToken, p_id: m.id, p_reply: ta.value });
      if (error) { showPill('error', 'Błąd zapisu'); rb.disabled = false; return; }
      showPill('', 'Odpowiedź zapisana ✓'); renderAdmin();
    });
    if (m.replied_at) { const meta = document.createElement('div'); meta.className = 'k'; meta.textContent = 'Odpowiedziano ' + fmtWhen(m.replied_at); reply.appendChild(meta); }
    reply.appendChild(ta); reply.appendChild(rb);
    d.appendChild(reply); inbox.appendChild(d);
  });
  root.appendChild(inbox);

  // ── Zakładki ──
  const TABS = [
    { id: 'wizyty',   label: 'Wizyty',       count: visits.length },
    { id: 'czekaja',  label: 'Czekają',      count: waiting.length },
    { id: 'gotowe',   label: 'Odpowiedziane', count: answered.length },
  ];
  const tabsBar = document.createElement('div'); tabsBar.className = 'tabs';
  const panels = {};

  // panel: Wizyty (rozdzielone klient / ja-testy)
  const pVis = document.createElement('div'); pVis.className = 'tabpanel';
  pVis.appendChild(buildVisitsGroup(visClient, 'Klient (Dominika / Grzegorz)', false));
  pVis.appendChild(buildVisitsGroup(visOwner, 'Ja / testy (podgląd ?preview=1)', true));
  panels.wizyty = pVis;

  // panel: Czekają
  const pWait = document.createElement('div'); pWait.className = 'tabpanel';
  if (!waiting.length) pWait.innerHTML = `<div class="empty-note">— wszystko odpowiedziane 🎉 —</div>`;
  waiting.forEach(msg => pWait.appendChild(buildAdminCard(msg, ans)));
  panels.czekaja = pWait;

  // panel: Odpowiedziane
  const pDone = document.createElement('div'); pDone.className = 'tabpanel';
  if (!answered.length) pDone.innerHTML = `<div class="empty-note">— jeszcze nic nie odpowiedziano —</div>`;
  answered.forEach(msg => pDone.appendChild(buildAdminCard(msg, ans)));
  panels.gotowe = pDone;

  TABS.forEach((t, i) => {
    const b = document.createElement('button'); b.className = 'tab' + (i === 0 ? ' active' : '');
    b.innerHTML = `${t.label} <span class="tcount">${t.count}</span>`;
    b.addEventListener('click', () => {
      tabsBar.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      Object.values(panels).forEach(p => p.classList.remove('active'));
      panels[t.id].classList.add('active');
    });
    tabsBar.appendChild(b);
  });
  // ── Pasek powiadomienia e-mail (nad zakładkami) ──
  const notifyBar = document.createElement('div');
  notifyBar.className = 'notify-bar';
  const nWaiting = countWaitingQuestions(feed, ans);
  const suggested = nWaiting > 0
    ? 'Dorzuciłem ' + nWaiting + ' ' + (nWaiting === 1 ? 'nowe pytanie' : 'nowych pytań') + ' w portalu — zerknijcie, gdy będzie chwila.'
    : 'Mam dla Was nowe informacje w portalu.';
  const ta = document.createElement('textarea');
  ta.className = 'notify-intro'; ta.value = suggested;
  const nbtn = document.createElement('button'); nbtn.className = 'btn'; nbtn.textContent = 'Powiadom Jordanów';
  nbtn.addEventListener('click', () => {
    if (!confirm('Wysłać e-mail z powiadomieniem na jordan@jordaszka.pl?')) return;
    notifyJordanowie(ta.value.trim(), nbtn);
  });
  notifyBar.innerHTML = '<div class="nb-title">Powiadomienie e-mail</div>';
  notifyBar.appendChild(ta); notifyBar.appendChild(nbtn);
  root.appendChild(notifyBar);

  root.appendChild(tabsBar);
  Object.values(panels).forEach(p => root.appendChild(p));
  panels[TABS[0].id].classList.add('active');
}

// ── Narzędzia ────────────────────────────────────────────────────────────────
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function fmtWhen(iso) { try { return new Date(iso).toLocaleString('pl-PL', { dateStyle:'short', timeStyle:'short' }); } catch { return ''; } }
function fmtDur(s) { s = Math.max(0, s || 0); if (s < 60) return s + ' s'; return Math.round(s / 60) + ' min'; }

// ── Start ──────────────────────────────────────────────────────────────────────
// ── Śledzenie wizyt (kiedy i jak długo na portalu) ──
let visitId = null;
async function trackVisit() {
  try {
    const { data, error } = await sb.rpc('track_visit', { p_token: RESPONDENT, p_visit_id: visitId, p_source: VISIT_SOURCE });
    if (!error && data != null) visitId = data;
  } catch (e) { /* offline — pomijamy */ }
}

async function startClient() {
  const feedR = await sb.rpc('get_portal_feed', { p_token: RESPONDENT });
  if (feedR.error) { root.innerHTML = `<div class="toast-error">Nie udało się wczytać portalu: ${esc(feedR.error.message)}</div>`; return; }
  const ansR = await sb.rpc('get_workshop_answers', { p_token: RESPONDENT });
  const answers = lsLoad();
  if (!ansR.error) (ansR.data || []).forEach(r => answers[r.question_key] = r.answer);
  Object.entries(answers).forEach(([k, v]) => lsSave(k, v));
  renderPortal(feedR.data || [], answers);
  trackVisit();                                                                              // start wizyty
  setInterval(() => { if (document.visibilityState === 'visible') trackVisit(); }, 30000);   // puls co 30 s
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') trackVisit(); });
}

if (isAdmin) renderAdmin(); else startClient();
