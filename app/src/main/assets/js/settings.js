function settings(){
  setHead('Ustawienia',wolfSchool.schoolName||db.school);
  let dark=localStorage.getItem('wolfEduTheme')==='dark';
  let schoolOptions=(wolfSchool.schools||[]).map(s=>`<option value="${esc(s.id)}" ${s.id===wolfSchool.activeSchoolId?'selected':''}>${esc(s.name||'Szkoła')}</option>`).join('');

  app.innerHTML=`<div class="card"><h2>Profil WolfEdu</h2>
  ${syncLoggedIn?`<div class="row"><div class="avatar">${esc((syncEmail||'?')[0].toUpperCase())}</div><div><b>${esc(syncEmail)}</b><br><small>Rola: ${esc(wolfSchool.role||'brak')} · ${esc(wolfSchool.schoolName||'brak aktywnej szkoły')}</small><br><small>UID: ${esc(syncUid||'—')}</small></div></div>
  ${schoolOptions?`<select id="activeSchoolSelect" onchange="changeActiveSchool(this.value)">${schoolOptions}</select>`:'<div class="warn" style="margin-top:10px">Nie znaleziono szkół przypisanych do tego konta.</div>'}`
  :'<div class="muted">Zaloguj się do WolfCloud, aby pobrać profil i szkołę.</div>'}</div>

  <div class="card"><h2>WolfCloud</h2><div class="sync-box">
  ${syncLoggedIn?`<div class="sync-state"><span class="bigdot ${syncState}"></span><div><b>${esc(syncTitle)}</b><br><small>${esc(syncDetail)}</small></div></div>
  <div class="sync-email">${esc(syncEmail)}</div>
  <div class="sync-actions"><button onclick="syncNow(this)">Synchronizuj teraz</button><button class="secondary" onclick="logoutSync(this)">Wyloguj</button></div>
  <div class="sync-note">Szkoła, klasy, uczniowie, przedmioty, nauczyciele, plan, oceny, zadania i frekwencja korzystają z WolfCloud realtime.</div>`
  :`<div class="sync-state"><span class="bigdot"></span><div><b>Połącz urządzenia</b><br><small>Zaloguj się lub utwórz konto.</small></div></div><input id="syncEmail" type="email" autocomplete="email" placeholder="Adres e-mail"><input id="syncPassword" type="password" autocomplete="current-password" placeholder="Hasło (minimum 6 znaków)"><div class="sync-actions"><button onclick="loginSync(this)">Zaloguj</button><button class="secondary" onclick="registerSync(this)">Utwórz konto</button></div>`}
  </div></div>

  ${syncLoggedIn && (wolfSchool.myInvites||[]).length?`<div class="card"><div class="row between"><div><h2 style="margin:0">Zaproszenia</h2><small>Masz ${(wolfSchool.myInvites||[]).length} oczekujących</small></div><button onclick="render('myInvitesPage')">Otwórz</button></div></div>`:''}

  ${syncLoggedIn?`<div class="card"><h2>Panel szkoły</h2><div class="row between"><div><b>${esc(wolfSchool.schoolName||'Brak aktywnej szkoły')}</b><br><small>${esc(roleLabel())}</small></div><button onclick="render('schoolPage')">Otwórz</button></div><div class="sync-note">Te same dane i funkcje administracyjne co w panelu WWW — dostosowane do telefonu.</div></div>`:''}

  ${syncLoggedIn?`<div class="card"><h2>Architektura</h2><small>Baza Firestore: <code>default</code></small><br><small>Aktywna szkoła: <code>${esc(wolfSchool.activeSchoolId||'brak')}</code></small></div>`:''}

  <div class="card"><h2>Wygląd</h2><div class="switch"><div><b>Tryb ciemny</b><br><small>Przyciemnia interfejs aplikacji</small></div><button class="secondary" onclick="toggleTheme()">${dark?'Wyłącz':'Włącz'}</button></div></div>

  <div class="card"><h2>Kopia danych lokalnych</h2><small>Eksport zapisuje lokalną kopię awaryjną. Dane szkolne synchronizowane przez WolfCloud pozostają w Firestore.</small><button class="btn-full" style="margin-top:10px" onclick="exportData(this)">Eksportuj kopię JSON</button><label><input id="importFile" type="file" accept="application/json" style="margin-top:10px" onchange="importData(event)"></label></div>

  <div class="version">WolfEdu 0.9.9-beta.1 · Feature Parity Baseline</div>`;
}
function changeActiveSchool(id){if(hasSyncBridge()&&id){WolfSync.setActiveSchool(id);toast('Zmieniam aktywną szkołę…')}}
function renameSchool(){let v=$('#sName')?.value?.trim();if(v){db.school=v;save();settings();toast('Zapisano')}}
function exportData(btn){
  if(btn){btn.classList.add('btn-busy');btn.textContent='Otwieram zapis…'}
  let json=JSON.stringify(db,null,2);
  if(typeof WolfNative!=='undefined'&&WolfNative.exportJson){
    WolfNative.exportJson(json);
  }else{
    let blob=new Blob([json],{type:'application/json'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='wolfedu-kopia.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    if(btn){btn.classList.remove('btn-busy');btn.textContent='Eksportuj kopię JSON'}
  }
}
window.wolfNativeExportResult=function(ok,msg){
  toast(msg|| (ok?'Kopia zapisana':'Nie udało się zapisać'));
  if(currentPage==='settings')settings();
}
function importData(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{db=JSON.parse(r.result);save();render('home');toast('Kopia wczytana')}catch{toast('Nieprawidłowy plik')}};r.readAsText(f)}function resetAll(){if(confirm('Na pewno usunąć cały dziennik lokalnie i w chmurze?')){db={school:'',classes:[],students:[],grades:[],attendance:[],lessons:[],tasks:[],_sync:{updatedAt:Date.now()}};save();setup()}}
