let authenticated=false;
let email='';
let systemRole='';
let schools=[];
let admins=[];
let currentPage='dashboard';
let currentUid='';
let schoolSearch='';
let selectedSchoolId='';

let environment={
  consoleVersion:'—',
  consoleVersionCode:0,
  firestoreDatabase:'default'
};

let releaseInfo=null;
let releaseLoading=false;
let releaseError='';
let releaseRequests=[];
let releaseQueueLoaded=false;
let releaseQueueLoading=false;
let releaseQueueError='';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[c]));
const app=$('#app');

function toast(msg){
  const el=$('#toast');
  if(!el)return;

  el.textContent=msg||'';
  el.classList.add('show');

  clearTimeout(window.__wolfConsoleToast);
  window.__wolfConsoleToast=setTimeout(
    ()=>el.classList.remove('show'),
    2300
  );
}

function setHead(title,subtitle='Panel operatorski'){
  $('#pageTitle').textContent=title;
  $('#pageSubtitle').textContent=subtitle;
}

function login(){
  const e=$('#email')?.value?.trim()||'';
  const p=$('#password')?.value||'';

  if(!e||p.length<6){
    $('#gateMsg').textContent='Wpisz e-mail i hasło.';
    return;
  }

  $('#loginBtn').disabled=true;
  $('#loginBtn').textContent='Logowanie…';
  $('#gateMsg').textContent='';

  WolfConsole.login(e,p);
}

window.consoleAuth=(ok,e,role)=>{
  authenticated=!!ok;
  email=e||'';
  systemRole=role||'';

  if(!ok){
    $('#shell').classList.add('hidden');
    $('#gate').classList.remove('hidden');
    $('#loginBtn').disabled=false;
    $('#loginBtn').textContent='Zaloguj do Console';
    return;
  }

  $('#gate').classList.add('hidden');
  $('#shell').classList.remove('hidden');
  $('#headerAvatar').textContent=(email||'W').charAt(0).toUpperCase();

  try{WolfConsole.requestEnvironment()}catch(e){}
  try{refreshConsoleSelfUpdate()}catch(e){}
  try{startConsoleSelfUpdateWatcher()}catch(e){}
  render(currentPage);
};

window.consoleDenied=e=>{
  authenticated=false;
  $('#shell').classList.add('hidden');
  $('#gate').classList.remove('hidden');
  $('#loginBtn').disabled=false;
  $('#loginBtn').textContent='Zaloguj do Console';
  $('#gateMsg').textContent=`Konto ${e||''} nie ma uprawnień systemowych.`;
};

window.consoleSchools=x=>{
  schools=Array.isArray(x)?x:[];
  if(authenticated)render(currentPage);
};

window.consoleAdmins=x=>{
  admins=Array.isArray(x)?x:[];
  if(authenticated)render(currentPage);
};

window.consoleEnvironment=x=>{
  environment=Object.assign(environment,x||{});
  currentUid=environment.uid||'';

  if(authenticated)render(currentPage);
};


let consoleSelfUpdateInfo=null;
let consoleSelfUpdateError='';

window.consoleSelfUpdateInfo=x=>{
  consoleSelfUpdateInfo=x||null;
  consoleSelfUpdateError='';

  if(authenticated){
    render(currentPage);
  }
};

window.consoleSelfUpdateError=message=>{
  consoleSelfUpdateError=String(message||'Nie udało się sprawdzić aktualizacji Console.');

  if(authenticated){
    render(currentPage);
  }
};

function consoleSelfUpdateAvailable(){
  const current=parseVersion(environment?.consoleVersion);
  const latest=parseVersion(consoleSelfUpdateInfo?.versionName);

  if(!current || !latest){
    return false;
  }

  return compareVersions(
    consoleSelfUpdateInfo.versionName,
    environment.consoleVersion
  )>0;
}

let consoleSelfUpdateTimer=null;

function refreshConsoleSelfUpdate(){
  try{
    WolfConsole.requestConsoleUpdateInfo();
  }catch(e){
    consoleSelfUpdateError='Nie udało się uruchomić sprawdzania aktualizacji Console.';
  }
}

function startConsoleSelfUpdateWatcher(){
  if(consoleSelfUpdateTimer)return;

  consoleSelfUpdateTimer=setInterval(()=>{
    if(authenticated){
      refreshConsoleSelfUpdate();
    }
  },120000);
}

document.addEventListener('visibilitychange',()=>{
  if(!document.hidden && authenticated){
    refreshConsoleSelfUpdate();
  }
});

window.consoleReleaseInfo=x=>{
  releaseInfo=x||null;
  releaseLoading=false;
  releaseError='';

  if(
    currentPage==='releases'||
    currentPage==='dashboard'
  ){
    render(currentPage);
  }
};

window.consoleReleaseError=message=>{
  releaseLoading=false;
  releaseError=message||'Nie udało się pobrać danych Release Center.';

  if(currentPage==='releases'){
    render('releases');
  }
};


window.consoleReleaseRequests=x=>{
  releaseRequests=Array.isArray(x)?x:[];
  releaseQueueLoaded=true;
  releaseQueueLoading=false;
  releaseQueueError='';

  if(currentPage==='releases'){
    render('releases');
  }
};

window.consoleReleaseQueueError=message=>{
  releaseQueueLoaded=true;
  releaseQueueLoading=false;
  releaseQueueError=message||'Nie udało się pobrać kolejki aktualizacji.';

  if(currentPage==='releases'){
    render('releases');
  }
};

window.consoleReleaseQueued=version=>{
  releaseQueueLoaded=false;
  releaseQueueLoading=false;
  toast(`WolfEdu ${version} dodano do kolejki.`);
  refreshReleaseInfo();
  refreshReleaseQueue();
};

window.consoleError=message=>{
  toast(message||'Wystąpił błąd.');

  const btn=$('#loginBtn');
  if(btn){
    btn.disabled=false;
    btn.textContent='Zaloguj do Console';
  }
};

window.consoleMessage=message=>{
  toast(message||'Gotowe');
};

document.querySelectorAll('nav button').forEach(
  btn=>btn.addEventListener(
    'click',
    ()=>render(btn.dataset.page)
  )
);

function render(page='dashboard'){
  if(!authenticated)return;

  currentPage=page||'dashboard';

  document.querySelectorAll('nav button').forEach(
    btn=>btn.classList.toggle(
      'active',
      btn.dataset.page===currentPage
    )
  );

  const routes={
    dashboard,
    schools:schoolsView,
    admins:adminsView,
    releases:releasesView,
    diagnostics:diagnosticsView,
    schoolDetails:schoolDetailsView
  };

  const view=routes[currentPage]||dashboard;

  try{
    view();
  }catch(err){
    console.error('WolfEdu Console render error:',err);

    setHead('Błąd widoku','Console zatrzymało renderowanie strony');

    app.innerHTML=`
      <section class="card runtime-error">
        <span>!</span>
        <h2>Nie udało się wyświetlić tego ekranu</h2>
        <p>${esc(String(err?.message||err||'Nieznany błąd JavaScript'))}</p>
        <button class="secondary full" onclick="render('dashboard')">
          Wróć do System
        </button>
      </section>`;
  }
}

function statusOfSchool(s){
  const status=String(s?.systemStatus||'active').trim().toLowerCase();

  return ['active','suspended','maintenance'].includes(status)
    ? status
    : 'active';
}

function schoolStatusLabel(status){
  if(status==='suspended')return 'ZAWIESZONA';
  if(status==='maintenance')return 'KONSERWACJA';
  return 'AKTYWNA';
}

function schoolStatusClass(status){
  if(status==='suspended')return 'warn';
  if(status==='maintenance')return 'maintenance';
  return 'ok';
}

function detailCard(label,value){
  return `<div class="detail-card">
    <small>${esc(label)}</small>
    <b>${esc(value===undefined||value===null||value===''?'—':value)}</b>
  </div>`;
}

function schoolCounts(){
  return {
    active:schools.filter(s=>statusOfSchool(s)==='active').length,
    suspended:schools.filter(s=>statusOfSchool(s)==='suspended').length,
    maintenance:schools.filter(s=>statusOfSchool(s)==='maintenance').length
  };
}

function dashboard(){
  setHead('System','Przegląd platformy WolfEdu');

  const counts=schoolCounts();
  const creators=admins.filter(a=>a.role==='creator').length;

  app.innerHTML=`
    <section class="hero console-hero">
      <div>
        <span class="eyebrow">OPERATOR</span>
        <h2>WolfEdu działa.</h2>
        <p>${esc(email)} · ${esc(systemRole||'admin')}</p>
      </div>

      <span class="online-pill">● WolfCloud online</span>
    </section>

    <section class="metrics">
      <button class="metric" onclick="render('schools')">
        <small>Szkoły</small>
        <b>${schools.length}</b>
        <span>wszystkie</span>
      </button>

      <button class="metric" onclick="render('schools')">
        <small>Aktywne</small>
        <b>${counts.active}</b>
        <span>działające</span>
      </button>

      <button class="metric danger-metric" onclick="render('schools')">
        <small>Zawieszone</small>
        <b>${counts.suspended}</b>
        <span>zablokowane</span>
      </button>

      <button class="metric maintenance-metric" onclick="render('schools')">
        <small>Konserwacja</small>
        <b>${counts.maintenance}</b>
        <span>czasowo wyłączone</span>
      </button>

      <button class="metric" onclick="render('admins')">
        <small>System admini</small>
        <b>${admins.length}</b>
        <span>${creators} creator</span>
      </button>
    </section>

    <section class="dashboard-grid">
      <div class="card">
        <div class="section-head">
          <div>
            <h2>Szkoły</h2>
            <small>Podgląd WolfCloud</small>
          </div>
          <button class="link-btn" onclick="render('schools')">
            Wszystkie
          </button>
        </div>

        ${schools
          .slice()
          .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pl'))
          .slice(0,5)
          .map(s=>schoolRow(s,false))
          .join('')||
          '<div class="empty-mini">Brak szkół.</div>'
        }
      </div>

      <div class="card">
        <div class="section-head">
          <div>
            <h2>Release Center</h2>
            <small>Publiczne OTA WolfEdu</small>
          </div>
          <button class="link-btn" onclick="render('releases')">
            Otwórz
          </button>
        </div>

        ${releaseInfo
          ? `
            <div class="release-current">
              <small>AKTUALNA WERSJA</small>
              <b>${esc(releaseInfo.versionName||'—')}</b>
              <span>code ${esc(releaseInfo.versionCode||0)}</span>
            </div>
            <div class="release-note">
              ${esc(releaseInfo.changelog||'Brak changelogu')}
            </div>
          `
          : `
            <button class="secondary full" onclick="refreshReleaseInfo()">
              Pobierz stan OTA
            </button>
          `
        }
      </div>
    </section>`;
}

function schoolRow(s,controls=true){
  const status=statusOfSchool(s);

  return `<div class="item school-row">
    <button class="row-main" onclick="openSchool('${esc(s.id)}')">
      <div class="school-icon">
        ${esc((s.name||'S').charAt(0).toUpperCase())}
      </div>

      <div class="grow">
        <b>${esc(s.name||'Szkoła')}</b>
        <small>
          ${[
            s.city||'',
            s.type||'',
            s.schoolYear||''
          ].filter(Boolean).map(esc).join(' · ')||'Brak dodatkowych danych'}
        </small>

        ${status!=='active'&&s.systemStatusReason
          ? `<small class="school-status-reason">${esc(s.systemStatusReason)}</small>`
          : ''
        }
      </div>

      <span class="badge ${schoolStatusClass(status)}">
        ${schoolStatusLabel(status)}
      </span>
    </button>

    ${controls
      ? `<div class="row-actions system-actions">
          <button class="secondary"
            onclick="openSchool('${esc(s.id)}')">
            Szczegóły
          </button>

          ${status!=='active'
            ? `<button class="activate-btn"
                onclick="changeSchoolSystemStatus('${esc(s.id)}','active')">
                Aktywuj
              </button>`
            : ''
          }

          ${status!=='maintenance'
            ? `<button class="maintenance-btn"
                onclick="changeSchoolSystemStatus('${esc(s.id)}','maintenance')">
                Konserwacja
              </button>`
            : ''
          }

          ${status!=='suspended'
            ? `<button class="danger"
                onclick="changeSchoolSystemStatus('${esc(s.id)}','suspended')">
                Zawieś
              </button>`
            : ''
          }
        </div>`
      : ''
    }
  </div>`;
}

function schoolsView(){
  setHead('Szkoły','Zarządzanie instancjami WolfCloud');

  const q=schoolSearch.trim().toLowerCase();
  const counts=schoolCounts();

  const filtered=schools
    .filter(s=>
      !q||
      [
        s.name,
        s.city,
        s.type,
        s.schoolYear,
        s.ownerUid,
        s.id,
        s.systemStatusReason
      ].some(v=>
        String(v||'').toLowerCase().includes(q)
      )
    )
    .sort((a,b)=>
      String(a.name||'').localeCompare(String(b.name||''),'pl')
    );

  app.innerHTML=`
    <section class="card search-card">
      <div class="section-head">
        <div>
          <h2>Wszystkie szkoły</h2>
          <small>${filtered.length} z ${schools.length} rekordów</small>
        </div>

        <span class="badge ok">${counts.active} aktywnych</span>
      </div>

      <input
        id="schoolSearch"
        placeholder="Szukaj nazwy, miasta, ID, właściciela…"
        value="${esc(schoolSearch)}"
        oninput="schoolSearch=this.value;schoolsView()">
    </section>

    <section class="card school-list">
      ${filtered.map(s=>schoolRow(s,true)).join('')||
        `<div class="empty-state">
          <span>▦</span>
          <b>Brak wyników</b>
          <small>Zmień wyszukiwaną frazę.</small>
        </div>`
      }
    </section>`;

  const input=$('#schoolSearch');
  if(input){
    input.focus();
    input.setSelectionRange(input.value.length,input.value.length);
  }
}

function openSchool(id){
  selectedSchoolId=id;
  render('schoolDetails');
}

function schoolDetailsView(){
  const s=schools.find(x=>x.id===selectedSchoolId);

  if(!s){
    render('schools');
    return;
  }

  const status=statusOfSchool(s);

  setHead('Szczegóły szkoły',s.name||'Szkoła');

  app.innerHTML=`
    <button class="back-btn" onclick="render('schools')">
      ‹ Wróć do szkół
    </button>

    <section class="hero school-hero">
      <div class="school-icon large">
        ${esc((s.name||'S').charAt(0).toUpperCase())}
      </div>

      <div class="grow">
        <span class="eyebrow">SZKOŁA W WOLFCLOUD</span>
        <h2>${esc(s.name||'Szkoła')}</h2>
        <p>
          ${esc(s.city||'Brak miasta')}
          ${s.type?' · '+esc(s.type):''}
        </p>
      </div>

      <span class="badge ${schoolStatusClass(status)}">
        ${schoolStatusLabel(status)}
      </span>
    </section>

    <section class="detail-grid">
      ${detailCard('ID szkoły',s.id)}
      ${detailCard('Właściciel UID',s.ownerUid||'—')}
      ${detailCard('Rok szkolny',s.schoolYear||'—')}
      ${detailCard('Typ',s.type||'—')}
      ${detailCard('Adres',s.address||'—')}
      ${detailCard('E-mail',s.email||'—')}
      ${detailCard('Telefon',s.phone||'—')}
      ${detailCard('Status',schoolStatusLabel(status))}
      ${detailCard('Powód / komunikat',s.systemStatusReason||'—')}
      ${detailCard(
        'Ostatnia zmiana przez',
        s.systemStatusUpdatedByEmail||
        s.systemStatusUpdatedBy||
        '—'
      )}
    </section>

    <section class="card">
      <div class="section-head">
        <div>
          <h2>Kontrola systemowa</h2>
          <small>Status jest zapisywany bezpośrednio w WolfCloud.</small>
        </div>
      </div>

      <div class="system-control-grid">
        <button
          class="activate-btn"
          ${status==='active'?'disabled':''}
          onclick="changeSchoolSystemStatus('${esc(s.id)}','active')">
          Aktywuj
        </button>

        <button
          class="maintenance-btn"
          ${status==='maintenance'?'disabled':''}
          onclick="changeSchoolSystemStatus('${esc(s.id)}','maintenance')">
          Tryb konserwacji
        </button>

        <button
          class="danger"
          ${status==='suspended'?'disabled':''}
          onclick="changeSchoolSystemStatus('${esc(s.id)}','suspended')">
          Zawieś
        </button>
      </div>

      ${status!=='active'&&s.systemStatusReason
        ? `<div class="system-reason-box">
            <b>Komunikat dla użytkowników</b>
            <small>${esc(s.systemStatusReason)}</small>
          </div>`
        : ''
      }
    </section>`;
}

function changeSchoolSystemStatus(id,status){
  const s=schools.find(x=>x.id===id);
  if(!s)return;

  let reason='';

  if(status!=='active'){
    reason=prompt(
      status==='suspended'
        ? 'Podaj powód zawieszenia szkoły:'
        : 'Podaj komunikat trybu konserwacji:',
      s.systemStatusReason||''
    );

    if(reason===null)return;

    reason=reason.trim();

    if(!reason){
      toast('Podaj powód / komunikat.');
      return;
    }
  }

  const action=
    status==='active'
      ? 'aktywować'
      : status==='maintenance'
      ? 'włączyć tryb konserwacji dla'
      : 'zawiesić';

  if(!confirm(`Czy na pewno ${action} tę szkołę?`)){
    return;
  }

  if(
    typeof WolfConsole.setSchoolStatusDetailed!=='function'
  ){
    toast('Ta wersja ConsoleBridge nie obsługuje System Control.');
    return;
  }

  WolfConsole.setSchoolStatusDetailed(
    id,
    status,
    reason
  );
}

function toggleSchool(id,status){
  changeSchoolSystemStatus(id,status);
}

function adminsView(){
  setHead('Administratorzy','Globalny dostęp do WolfEdu Console');

  const canManage=systemRole==='creator';
  const creators=admins.filter(a=>a.role==='creator').length;

  app.innerHTML=`
    <section class="metrics admin-metrics">
      <div class="metric">
        <small>Administratorzy</small>
        <b>${admins.length}</b>
        <span>łącznie</span>
      </div>

      <div class="metric">
        <small>Creator</small>
        <b>${creators}</b>
        <span>najwyższa rola</span>
      </div>
    </section>

    ${canManage
      ? `<details class="card add-card">
          <summary>
            <div>
              <span class="add-icon">＋</span>
              <div>
                <b>Dodaj administratora systemowego</b>
                <small>Nadanie globalnego dostępu przez Firebase UID</small>
              </div>
            </div>
            <span>Rozwiń</span>
          </summary>

          <div class="details-body">
            <input id="adminUid" placeholder="Firebase UID">
            <input id="adminEmail" type="email" placeholder="E-mail (opisowo)">

            <select id="adminRole">
              <option value="admin">Administrator</option>
              <option value="creator">Creator</option>
            </select>

            <button class="full" onclick="addAdmin()">
              Dodaj dostęp
            </button>

            <p class="muted admin-help">
              Console nie wyszukuje kont Firebase po e-mailu.
              UID jest wymagany.
            </p>
          </div>
        </details>`
      : `<div class="card readonly-note">
          <b>Tryb podglądu administratorów</b>
          <small>Tylko rola creator może nadawać i odbierać dostęp systemowy.</small>
        </div>`
    }

    <section class="card">
      <div class="section-head">
        <div>
          <h2>Dostępy systemowe</h2>
          <small>${admins.length} kont</small>
        </div>
      </div>

      ${admins.map(a=>{
        const uid=a.uid||a.id||'';
        const self=uid===currentUid;
        const role=a.role||'admin';

        return `<div class="admin-item">
          <div class="admin-avatar">
            ${esc((a.email||uid||'A').charAt(0).toUpperCase())}
          </div>

          <div class="grow">
            <b>${esc(a.email||uid||'Administrator')}</b>
            <small>${esc(uid||'Brak UID')}${self?' · TO KONTO':''}</small>
          </div>

          <span class="badge ${role==='creator'?'ok':''}">
            ${esc(role)}
          </span>

          ${canManage
            ? `<div class="admin-controls">
                <select id="role-${esc(uid)}" ${self?'disabled':''}>
                  <option value="admin" ${role==='admin'?'selected':''}>
                    Administrator
                  </option>
                  <option value="creator" ${role==='creator'?'selected':''}>
                    Creator
                  </option>
                </select>

                <button
                  class="secondary"
                  ${self?'disabled':''}
                  onclick="changeAdminRole('${esc(uid)}')">
                  Zapisz
                </button>

                <button
                  class="danger"
                  ${self?'disabled':''}
                  onclick="removeAdmin('${esc(uid)}')">
                  Usuń
                </button>
              </div>`
            : ''
          }
        </div>`;
      }).join('')||
        '<div class="empty-mini">Brak administratorów.</div>'
      }
    </section>`;
}

function addAdmin(){
  if(systemRole!=='creator'){
    toast('Tylko creator może dodawać administratorów.');
    return;
  }

  const uid=$('#adminUid')?.value?.trim()||'';
  const mail=$('#adminEmail')?.value?.trim()||'';
  const role=$('#adminRole')?.value||'admin';

  if(!uid){
    toast('Wpisz UID');
    return;
  }

  WolfConsole.addSystemAdmin(uid,mail,role);
}

function changeAdminRole(uid){
  if(systemRole!=='creator')return;

  const el=document.getElementById('role-'+uid);

  if(el){
    WolfConsole.updateSystemAdminRole(uid,el.value);
  }
}

function removeAdmin(uid){
  if(systemRole!=='creator')return;

  if(confirm('Usunąć globalny dostęp tego administratora?')){
    WolfConsole.removeSystemAdmin(uid);
  }
}

function parseVersion(v){
  const m=String(v||'').trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  return m?[Number(m[1]),Number(m[2]),Number(m[3])]:null;
}

function compareVersions(a,b){
  const av=parseVersion(a);
  const bv=parseVersion(b);

  if(!av&&!bv)return 0;
  if(!av)return -1;
  if(!bv)return 1;

  for(let i=0;i<3;i++){
    if(av[i]!==bv[i])return av[i]-bv[i];
  }

  return 0;
}

function nextSuggestedVersion(){
  const current=parseVersion(releaseInfo?.versionName);

  if(!current)return '0.1.0';

  return `${current[0]}.${current[1]}.${current[2]+1}`;
}

function refreshReleaseInfo(){
  if(releaseLoading)return;

  releaseLoading=true;
  releaseError='';

  if(currentPage==='releases'){
    releasesView();
  }

  WolfConsole.requestReleaseInfo();
}

function refreshReleaseCenter(){
  refreshReleaseInfo();
  refreshReleaseQueue();
}

function refreshReleaseQueue(){
  if(releaseQueueLoading)return;

  releaseQueueLoading=true;
  releaseQueueError='';

  if(currentPage==='releases'){
    releasesView();
  }

  WolfConsole.requestReleaseRequests();
}

function releaseRequestStatus(req){
  if(
    releaseInfo?.versionName &&
    compareVersions(releaseInfo.versionName,req.versionName)>=0
  ){
    return 'published';
  }

  return 'queued';
}

function releaseQueueHtml(){
  const sorted=[...releaseRequests].sort(
    (a,b)=>Number(b.createdAtMillis||0)-Number(a.createdAtMillis||0)
  );

  if(releaseQueueLoading&&!releaseQueueLoaded){
    return `<section class="card loading-card">
      <div class="spinner"></div>
      <b>Pobieram kolejkę publikacji…</b>
    </section>`;
  }

  if(releaseQueueError){
    return `<section class="card error-card">
      <b>Błąd kolejki</b>
      <small>${esc(releaseQueueError)}</small>
      <button class="secondary full top-gap" onclick="refreshReleaseCenter()">
        Spróbuj ponownie
      </button>
    </section>`;
  }

  return `<section class="card">
    <div class="section-head">
      <div>
        <h2>Kolejka publikacji</h2>
        <small>Kolejka sprawdzana automatycznie co 2 minuty</small>
      </div>

      <button class="link-btn" onclick="refreshReleaseCenter()">
        Odśwież
      </button>
    </div>

    ${sorted.slice(0,8).map(req=>{
      const status=releaseRequestStatus(req);

      return `<div class="release-queue-item">
        <div class="release-queue-version">
          <b>${esc(req.versionName||'—')}</b>
          <small>${req.mandatory?'WYMAGANA':'opcjonalna'}</small>
        </div>

        <div class="grow">
          <span>${esc(req.changelog||'Brak changelogu')}</span>
          <small>
            ${req.createdAtMillis
              ? new Date(req.createdAtMillis).toLocaleString('pl-PL')
              : 'oczekuje na timestamp'
            }
          </small>
        </div>

        <span class="badge ${status==='published'?'ok':'maintenance'}">
          ${status==='published'?'OPUBLIKOWANA':'OCZEKUJE'}
        </span>
      </div>`;
    }).join('')||
      `<div class="empty-mini">
        Brak żądań publikacji z Console.
      </div>`
    }
  </section>`;
}

function queueWolfEduRelease(btn){
  if(systemRole!=='creator'){
    toast('Tylko creator może publikować aktualizacje.');
    return;
  }

  const version=$('#releaseVersion')?.value?.trim()||'';
  const changelog=$('#releaseChangelog')?.value?.trim()||'';
  const mandatory=!!$('#releaseMandatory')?.checked;

  if(!parseVersion(version)){
    toast('Wersja musi mieć format X.Y.Z');
    return;
  }

  if(
    releaseInfo?.versionName &&
    compareVersions(version,releaseInfo.versionName)<=0
  ){
    toast(`Wersja musi być nowsza niż ${releaseInfo.versionName}.`);
    return;
  }

  if(!changelog){
    toast('Wpisz changelog.');
    return;
  }

  const existing=releaseRequests.some(
    r=>String(r.versionName||'')===version
  );

  if(existing){
    toast(`Wersja ${version} już jest w kolejce.`);
    return;
  }

  if(!confirm(
    `Dodać WolfEdu ${version} do kolejki OTA?\n\n`+
    `${mandatory?'Aktualizacja WYMAGANA':'Aktualizacja opcjonalna'}`
  )){
    return;
  }

  if(btn){
    btn.disabled=true;
    btn.textContent='Dodaję do kolejki…';
  }

  WolfConsole.createReleaseRequest(
    version,
    changelog,
    mandatory
  );

  setTimeout(()=>{
    if(btn){
      btn.disabled=false;
      btn.textContent='Publikuj przez OTA';
    }
  },3500);
}

function releasesView(){
  setHead('Release Center','Publikowanie aktualizacji WolfEdu');

  if(!releaseQueueLoaded&&!releaseQueueLoading){
    setTimeout(refreshReleaseQueue,0);
  }

  app.innerHTML=`
    <section class="hero release-hero">
      <div>
        <span class="eyebrow">WOLFEDU OTA</span>
        <h2>
          ${releaseInfo
            ? esc(releaseInfo.versionName||'—')
            : 'Release Center'
          }
        </h2>
        <p>
          ${releaseInfo
            ? 'Aktualna publiczna wersja aplikacji.'
            : 'Stan WolfEdu-Releases.'
          }
        </p>
      </div>

      <span class="online-pill ${releaseInfo?'':'offline'}">
        ${releaseInfo?'● OTA ONLINE':'○ OCZEKIWANIE'}
      </span>
    </section>

    ${releaseLoading
      ? `<section class="card loading-card">
          <div class="spinner"></div>
          <b>Pobieram version.json…</b>
        </section>`
      : ''
    }

    ${releaseError
      ? `<section class="card error-card">
          <b>Błąd Release Center</b>
          <small>${esc(releaseError)}</small>
          <button class="secondary full top-gap" onclick="refreshReleaseInfo()">
            Spróbuj ponownie
          </button>
        </section>`
      : ''
    }

    ${releaseInfo
      ? `<section class="detail-grid">
          ${detailCard('Version name',releaseInfo.versionName||'—')}
          ${detailCard('Version code',releaseInfo.versionCode||0)}
          ${detailCard('Wymagana',releaseInfo.mandatory?'TAK':'NIE')}
          ${detailCard('Opublikowano',releaseInfo.publishedAt||'—')}
        </section>

        <section class="card">
          <h2>Aktualny changelog</h2>
          <div class="changelog">
            ${esc(releaseInfo.changelog||'Brak changelogu.')}
          </div>
        </section>`
      : (!releaseLoading&&!releaseError)
      ? `<section class="card release-start">
          <span>↻</span>
          <b>Sprawdź aktualny release</b>
          <small>Console odczyta publiczny version.json.</small>
          <button onclick="refreshReleaseInfo()">
            Pobierz stan OTA
          </button>
        </section>`
      : ''
    }

    ${systemRole==='creator'
      ? `<section class="card publish-card-v2">
          <div class="section-head">
            <div>
              <span class="eyebrow">PUBLIKACJA</span>
              <h2>Nowa wersja WolfEdu</h2>
              <small>
                Żądanie trafi do Firestore, a GitHub Actions odbierze je automatycznie.
              </small>
            </div>
          </div>

          <label class="release-field">
            <span>Numer wersji</span>
            <input
              id="releaseVersion"
              inputmode="decimal"
              placeholder="0.11.7"
              value="${esc(nextSuggestedVersion())}">
          </label>

          <label class="release-field">
            <span>Changelog</span>
            <textarea
              id="releaseChangelog"
              maxlength="2000"
              placeholder="Co zmienia ta wersja?"></textarea>
          </label>

          <label class="release-mandatory">
            <input id="releaseMandatory" type="checkbox">
            <div>
              <b>Aktualizacja wymagana</b>
              <small>
                Użytkownik powinien zainstalować tę wersję przed dalszym korzystaniem.
              </small>
            </div>
          </label>

          <button
            class="full publish-release-btn"
            onclick="queueWolfEduRelease(this)">
            Publikuj przez OTA
          </button>

          <div class="release-free-note">
            <b>Tryb darmowy</b>
            <small>
              Publikacja rozpocznie się przy najbliższym sprawdzeniu kolejki przez GitHub Actions.
            </small>
          </div>
        </section>`
      : `<section class="card readonly-note">
          <b>Publikacja tylko dla creator</b>
          <small>
            Administrator systemowy może oglądać Release Center,
            ale nie może tworzyć nowych wydań.
          </small>
        </section>`
    }

    ${releaseQueueHtml()}
  `;
}

function diagnosticsView(){
  setHead('Diagnostyka','Środowisko WolfEdu Console');

  const counts=schoolCounts();

  app.innerHTML=`
    <section class="hero diagnostic-hero">
      <div>
        <span class="eyebrow">SYSTEM STATUS</span>
        <h2>Console jest połączone.</h2>
        <p>Aktywna sesja Firebase i listenery Firestore.</p>
      </div>

      <span class="badge ok">ONLINE</span>
    </section>

    <section class="detail-grid">
      ${detailCard('Console',environment.consoleVersion||'—')}
      ${detailCard('Version code',environment.consoleVersionCode||0)}
      ${detailCard('Najnowsza Console',consoleSelfUpdateInfo?.versionName||'—')}
      ${detailCard(
        'Status OTA',
        consoleSelfUpdateError
          ? 'BŁĄD'
          : !consoleSelfUpdateInfo
            ? 'SPRAWDZANIE…'
            : consoleSelfUpdateAvailable()
              ? 'DOSTĘPNA'
              : 'AKTUALNA'
      )}
      ${detailCard('Firestore DB',environment.firestoreDatabase||'default')}
      ${detailCard('Rola',systemRole||'—')}
      ${detailCard('UID',currentUid||'—')}
      ${detailCard('E-mail',email||'—')}
      ${detailCard('Szkoły realtime',schools.length)}
      ${detailCard('Aktywne szkoły',counts.active)}
      ${detailCard('Zawieszone',counts.suspended)}
      ${detailCard('Konserwacja',counts.maintenance)}
      ${detailCard('Admini realtime',admins.length)}
    </section>

    <section class="card diagnostics-actions">
      <h2>Operacje</h2>

      <button class="secondary full top-gap"
        onclick="WolfConsole.requestState();WolfConsole.requestEnvironment();toast('Odświeżam sesję…')">
        Odśwież stan Console
      </button>

      ${
        consoleSelfUpdateAvailable()
          ? `
            <button class="primary full top-gap"
              onclick="WolfConsole.installConsoleUpdate(consoleSelfUpdateInfo.apkUrl)">
              Pobierz i zainstaluj Console ${esc(consoleSelfUpdateInfo?.versionName||'')}
            </button>

            <small>
              Android otworzy systemowy instalator aktualizacji.
            </small>
          `
          : ''
      }

      <button class="secondary full top-gap"
        onclick="refreshConsoleSelfUpdate();toast('Sprawdzam aktualizację Console…')">
        Sprawdź aktualizację Console
      </button>

      <button class="secondary full top-gap"
        onclick="refreshReleaseInfo();toast('Sprawdzam OTA…')">
        Sprawdź Release Center
      </button>

      <button class="danger full top-gap"
        onclick="WolfConsole.logout()">
        Wyloguj z Console
      </button>
    </section>`;
}

WolfConsole.requestState();
