let authenticated=false,email='',systemRole='',schools=[],admins=[],currentPage='dashboard',currentUid='',schoolSearch='',selectedSchoolId='';
let environment={consoleVersion:'—',consoleVersionCode:0,firestoreDatabase:'default'};
let releaseInfo=null,releaseLoading=false,releaseError='';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=$('#app');

function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2200)}
function setHead(t,s='Panel operatorski'){$('#pageTitle').textContent=t;$('#pageSubtitle').textContent=s}

function login(){
  const e=$('#email').value.trim(),p=$('#password').value;
  if(!e||p.length<6){$('#gateMsg').textContent='Wpisz e-mail i hasło.';return}
  $('#loginBtn').disabled=true;$('#loginBtn').textContent='Logowanie…';$('#gateMsg').textContent='';
  WolfConsole.login(e,p);
}

window.consoleAuth=(ok,e,role)=>{
  authenticated=!!ok;email=e||'';systemRole=role||'';
  if(ok){
    $('#gate').classList.add('hidden');$('#shell').classList.remove('hidden');
    $('#headerAvatar').textContent=(email||'W').charAt(0).toUpperCase();
    WolfConsole.requestEnvironment();render(currentPage);
  }else{
    $('#shell').classList.add('hidden');$('#gate').classList.remove('hidden');
    $('#loginBtn').disabled=false;$('#loginBtn').textContent='Zaloguj do Console';
  }
};
window.consoleDenied=e=>{$('#shell').classList.add('hidden');$('#gate').classList.remove('hidden');$('#loginBtn').disabled=false;$('#loginBtn').textContent='Zaloguj do Console';$('#gateMsg').textContent=`Konto ${e||''} nie ma uprawnień systemowych.`}
window.consoleSchools=x=>{schools=Array.isArray(x)?x:[];if(authenticated)render(currentPage)}
window.consoleAdmins=x=>{admins=Array.isArray(x)?x:[];if(authenticated)render(currentPage)}
window.consoleEnvironment=x=>{environment=Object.assign(environment,x||{});currentUid=environment.uid||'';if(authenticated)render(currentPage)}
window.consoleReleaseInfo=x=>{releaseInfo=x||null;releaseLoading=false;releaseError='';if(currentPage==='releases'||currentPage==='dashboard')render(currentPage)}
window.consoleReleaseError=m=>{releaseLoading=false;releaseError=m||'Nie udało się pobrać danych release.';if(currentPage==='releases')render('releases')}
window.consoleError=m=>{toast(m||'Błąd');$('#loginBtn').disabled=false;$('#loginBtn').textContent='Zaloguj do Console'}
window.consoleMessage=m=>toast(m||'Gotowe')

document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>render(b.dataset.page));

function render(page){
  if(!authenticated)return;
  currentPage=page||'dashboard';
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===currentPage));
  ({dashboard,schools:schoolsView,admins:adminsView,releases:releasesView,diagnostics:diagnosticsView,schoolDetails:schoolDetailsView}[currentPage]||dashboard)();
}
function schoolStatus(s){return (s.systemStatus||'active')==='suspended'?'suspended':'active'}
function detailCard(label,value){return `<div class="detail-card"><small>${esc(label)}</small><b>${esc(value||'—')}</b></div>`}

function dashboard(){
  setHead('System','Przegląd platformy WolfEdu');
  const active=schools.filter(s=>schoolStatus(s)==='active').length,suspended=schools.length-active,creators=admins.filter(a=>a.role==='creator').length;
  app.innerHTML=`
    <section class="hero console-hero"><div><span class="eyebrow">OPERATOR</span><h2>WolfEdu działa.</h2><p>${esc(email)} · ${esc(systemRole||'admin')}</p></div><span class="online-pill">● WolfCloud online</span></section>
    <section class="metrics">
      <button class="metric" onclick="render('schools')"><small>Szkoły</small><b>${schools.length}</b><span>wszystkie</span></button>
      <button class="metric" onclick="render('schools')"><small>Aktywne</small><b>${active}</b><span>działające</span></button>
      <button class="metric danger-metric" onclick="render('schools')"><small>Zawieszone</small><b>${suspended}</b><span>wymagają uwagi</span></button>
      <button class="metric" onclick="render('admins')"><small>System admini</small><b>${admins.length}</b><span>${creators} creator</span></button>
    </section>
    <section class="dashboard-grid">
      <div class="card"><div class="section-head"><div><h2>Szkoły</h2><small>Ostatnie rekordy</small></div><button class="link-btn" onclick="render('schools')">Wszystkie</button></div>${schools.slice(0,5).map(s=>schoolRow(s,false)).join('')||'<div class="empty-mini">Brak szkół.</div>'}</div>
      <div class="card"><div class="section-head"><div><h2>Release Center</h2><small>Publiczne OTA</small></div><button class="link-btn" onclick="render('releases')">Otwórz</button></div>
        ${releaseInfo?`<div class="release-current"><small>AKTUALNA WERSJA</small><b>${esc(releaseInfo.versionName||'—')}</b><span>code ${esc(releaseInfo.versionCode||0)}</span></div><div class="release-note">${esc(releaseInfo.changelog||'Brak changelogu')}</div>`:`<button class="secondary full" onclick="refreshReleaseInfo()">Pobierz stan OTA</button>`}
      </div>
    </section>`;
}

function schoolRow(s,controls=true){
  const status=statusOfSchool(s);

  return `<div class="item school-row">
    <button class="row-main" onclick="openSchool('${esc(s.id)}')">
      <div class="school-icon">${esc((s.name||'S').charAt(0).toUpperCase())}</div>
      <div class="grow">
        <b>${esc(s.name||'Szkoła')}</b>
        <small>${[
          s.city||'',
          s.type||'',
          s.schoolYear||''
        ].filter(Boolean).map(esc).join(' · ')||'Brak dodatkowych danych'}</small>
        ${status!=='active'&&s.systemStatusReason
          ? `<small class="school-status-reason">${esc(s.systemStatusReason)}</small>`
          : ''}
      </div>
      <span class="badge ${status==='active'?'ok':status==='maintenance'?'maintenance':'warn'}">
        ${schoolStatusLabel(status)}
      </span>
    </button>

    ${controls?`
      <div class="row-actions system-actions">
        <button class="secondary" onclick="openSchool('${esc(s.id)}')">Szczegóły</button>
        ${status!=='active'
          ? `<button class="activate-btn" onclick="changeSchoolSystemStatus('${esc(s.id)}','active')">Aktywuj</button>`
          : ''}
        ${status!=='maintenance'
          ? `<button class="maintenance-btn" onclick="changeSchoolSystemStatus('${esc(s.id)}','maintenance')">Konserwacja</button>`
          : ''}
        ${status!=='suspended'
          ? `<button class="danger" onclick="changeSchoolSystemStatus('${esc(s.id)}','suspended')">Zawieś</button>`
          : ''}
      </div>`:''}
  </div>`;
}
function schoolsView(){
  setHead('Szkoły','Zarządzanie instancjami WolfCloud');
  const q=schoolSearch.trim().toLowerCase();
  const filtered=schools.filter(s=>!q||[s.name,s.city,s.type,s.schoolYear,s.ownerUid,s.id].some(v=>String(v||'').toLowerCase().includes(q))).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pl'));
  app.innerHTML=`<section class="card search-card"><div class="section-head"><div><h2>Wszystkie szkoły</h2><small>${filtered.length} z ${schools.length}</small></div><span class="badge">${schools.filter(s=>schoolStatus(s)==='active').length} aktywnych</span></div><input id="schoolSearch" placeholder="Szukaj nazwy, miasta, ID lub właściciela…" value="${esc(schoolSearch)}" oninput="schoolSearch=this.value;schoolsView()"></section><section class="card school-list">${filtered.map(s=>schoolRow(s,true)).join('')||'<div class="empty-mini">Brak wyników.</div>'}</section>`;
  const input=$('#schoolSearch');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length)}
}
function openSchool(id){selectedSchoolId=id;render('schoolDetails')}
function schoolDetailsView(){
  const s=schools.find(x=>x.id===selectedSchoolId);if(!s){render('schools');return}
  const status=schoolStatus(s);setHead('Szczegóły szkoły',s.name||'Szkoła');
  app.innerHTML=`<button class="back-btn" onclick="render('schools')">‹ Wróć</button>
    <section class="hero school-hero"><div class="school-icon large">${esc((s.name||'S').charAt(0).toUpperCase())}</div><div class="grow"><span class="eyebrow">SZKOŁA W WOLFCLOUD</span><h2>${esc(s.name||'Szkoła')}</h2><p>${esc(s.city||'Brak miasta')}${s.type?' · '+esc(s.type):''}</p></div><span class="badge ${status==='active'?'ok':'warn'}">${status==='active'?'AKTYWNA':'ZAWIESZONA'}</span></section>
    <section class="detail-grid">${detailCard('ID szkoły',s.id)}${detailCard('Właściciel UID',s.ownerUid||'—')}${detailCard('Rok szkolny',s.schoolYear||'—')}${detailCard('Typ',s.type||'—')}${detailCard('Adres',s.address||'—')}${detailCard('E-mail',s.email||'—')}${detailCard('Telefon',s.phone||'—')}${detailCard('Status',status)}</section>
    <section class="card"><h2>Kontrola systemowa</h2><small>Zmiana zapisuje się bezpośrednio w dokumencie szkoły.</small><button class="${status==='active'?'danger':'primary'} full top-gap" onclick="toggleSchool('${esc(s.id)}','${status==='active'?'suspended':'active'}')">${status==='active'?'Zawieś szkołę':'Ponownie aktywuj szkołę'}</button></section>`;
}
function toggleSchool(id,status){
  changeSchoolSystemStatus(id,status);
}
function addAdmin(){const uid=$('#adminUid').value.trim();if(!uid)return toast('Wpisz UID');WolfConsole.addSystemAdmin(uid,$('#adminEmail').value.trim(),$('#adminRole').value)}
function changeAdminRole(uid){const el=$('#role-'+CSS.escape(uid));if(el)WolfConsole.updateSystemAdminRole(uid,el.value)}
function removeAdmin(uid){if(confirm('Usunąć globalny dostęp tego administratora?'))WolfConsole.removeSystemAdmin(uid)}

function refreshReleaseInfo(){if(releaseLoading)return;releaseLoading=true;releaseError='';if(currentPage==='releases')releasesView();WolfConsole.requestReleaseInfo()}
function releasesView(){
  setHead('Release Center','Stan publikacji aplikacji WolfEdu');
  app.innerHTML=`<section class="hero release-hero"><div><span class="eyebrow">WOLFEDU OTA</span><h2>${releaseInfo?esc(releaseInfo.versionName||'—'):'Release Center'}</h2><p>${releaseInfo?'Aktualna publiczna wersja aplikacji.':'Bezpieczny podgląd WolfEdu-Releases.'}</p></div><span class="online-pill">${releaseInfo?'● OTA ONLINE':'○ OCZEKIWANIE'}</span></section>
  ${releaseLoading?'<section class="card loading-card"><b>Pobieram version.json…</b></section>':''}
  ${releaseError?`<section class="card"><b>Błąd Release Center</b><small>${esc(releaseError)}</small><button class="secondary full top-gap" onclick="refreshReleaseInfo()">Spróbuj ponownie</button></section>`:''}
  ${releaseInfo?`<section class="detail-grid">${detailCard('Version name',releaseInfo.versionName||'—')}${detailCard('Version code',releaseInfo.versionCode||0)}${detailCard('Wymagana',releaseInfo.mandatory?'TAK':'NIE')}${detailCard('Opublikowano',releaseInfo.publishedAt||'—')}</section><section class="card"><h2>Changelog</h2><div class="changelog">${esc(releaseInfo.changelog||'Brak changelogu.')}</div></section><section class="card"><h2>Źródło APK</h2><code class="code-block">${esc(releaseInfo.apkUrl||'—')}</code><button class="secondary full" onclick="refreshReleaseInfo()">Odśwież stan OTA</button></section>`:(!releaseLoading&&!releaseError)?'<section class="card release-start"><span>↻</span><b>Sprawdź aktualny release</b><small>Console odczyta publiczny version.json bez tokena GitHub.</small><button onclick="refreshReleaseInfo()">Pobierz stan OTA</button></section>':''}
  <section class="card publish-card"><div class="publish-lock">🔒</div><div class="grow"><span class="eyebrow">STAGE 2</span><h2>Publikowanie z Console</h2><p class="muted">Przycisk Publikuj podepniemy przez bezpieczny backend. Token GitHuba nie trafi do APK.</p></div><button disabled>Publikuj</button></section>`;
}

function diagnosticsView(){
  setHead('Diagnostyka','Środowisko WolfEdu Console');
  app.innerHTML=`<section class="hero diagnostic-hero"><div><span class="eyebrow">SYSTEM STATUS</span><h2>Console jest połączone.</h2><p>Aktywna sesja Firebase i listenery Firestore.</p></div><span class="badge ok">ONLINE</span></section>
  <section class="detail-grid">${detailCard('Console',environment.consoleVersion||'—')}${detailCard('Version code',environment.consoleVersionCode||0)}${detailCard('Firestore DB',environment.firestoreDatabase||'default')}${detailCard('Rola',systemRole||'—')}${detailCard('UID',currentUid||'—')}${detailCard('E-mail',email||'—')}${detailCard('Szkoły realtime',schools.length)}${detailCard('Admini realtime',admins.length)}</section>
  <section class="card"><h2>Operacje</h2><button class="secondary full top-gap" onclick="WolfConsole.requestState();WolfConsole.requestEnvironment();toast('Odświeżam sesję…')">Odśwież stan Console</button><button class="secondary full top-gap" onclick="refreshReleaseInfo();toast('Sprawdzam OTA…')">Sprawdź Release Center</button><button class="danger full top-gap" onclick="WolfConsole.logout()">Wyloguj z Console</button></section>`;
}

WolfConsole.requestState();
