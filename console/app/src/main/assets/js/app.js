let authenticated=false;
let email='';
let systemRole='';
let schools=[];
let admins=[];
let currentPage='dashboard';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=$('#app');

function toast(msg){
  const el=$('#toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.classList.remove('show'),2200);
}
function login(){
  const e=$('#email').value.trim(), p=$('#password').value;
  if(!e||p.length<6){$('#gateMsg').textContent='Wpisz e-mail i hasło.';return}
  $('#loginBtn').disabled=true; $('#loginBtn').textContent='Logowanie…';
  WolfConsole.login(e,p);
}
window.consoleAuth=(ok,e,role)=>{
  authenticated=ok; email=e||''; systemRole=role||'';
  if(ok){
    $('#gate').classList.add('hidden'); $('#shell').classList.remove('hidden');
    render(currentPage);
  }else{
    $('#shell').classList.add('hidden'); $('#gate').classList.remove('hidden');
    $('#loginBtn').disabled=false; $('#loginBtn').textContent='Zaloguj do Console';
  }
}
window.consoleDenied=e=>{
  $('#shell').classList.add('hidden'); $('#gate').classList.remove('hidden');
  $('#loginBtn').disabled=false; $('#loginBtn').textContent='Zaloguj do Console';
  $('#gateMsg').textContent=`Konto ${e||''} nie ma uprawnień systemowych.`;
}
window.consoleSchools=x=>{schools=Array.isArray(x)?x:[];render(currentPage)}
window.consoleAdmins=x=>{admins=Array.isArray(x)?x:[];render(currentPage)}
window.consoleError=m=>{toast(m||'Błąd');$('#loginBtn').disabled=false;$('#loginBtn').textContent='Zaloguj do Console'}
window.consoleMessage=m=>toast(m||'Gotowe')

document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>render(b.dataset.page));

function render(page){
  if(!authenticated)return;
  currentPage=page;
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  ({dashboard,schoolsPage:schoolsView,adminsPage:adminsView}[page]||({dashboard,schools:schoolsView,admins:adminsView}[page]||dashboard))();
}

function dashboard(){
  $('#pageTitle').textContent='System';
  const active=schools.filter(s=>(s.systemStatus||'active')!=='suspended').length;
  const suspended=schools.length-active;
  app.innerHTML=`
    <section class="card hero">
      <span class="eyebrow">OPERATOR</span>
      <h2>WolfEdu działa.</h2>
      <p class="muted">${esc(email)} · ${esc(systemRole||'admin')}</p>
    </section>
    <section class="grid">
      <div class="metric"><small>Szkoły</small><b>${schools.length}</b></div>
      <div class="metric"><small>Aktywne</small><b>${active}</b></div>
      <div class="metric"><small>Zawieszone</small><b>${suspended}</b></div>
      <div class="metric"><small>System admini</small><b>${admins.length}</b></div>
    </section>
    <section class="card">
      <div class="row between"><div><h2>Stan systemu</h2><small>Firebase / WolfCloud</small></div><span class="badge ok">ONLINE</span></div>
    </section>
    <section class="card">
      <h2>Ostatnie szkoły</h2>
      ${schools.slice(0,5).map(s=>schoolRow(s,false)).join('')||'<div class="muted">Brak szkół.</div>'}
    </section>`;
}

function schoolRow(s,controls=true){
  const status=(s.systemStatus||'active')==='suspended'?'suspended':'active';
  return `<div class="item row between">
    <div class="grow"><b>${esc(s.name||'Szkoła')}</b><br><small>${esc(s.city||'')}${s.type?' · '+esc(s.type):''}${s.schoolYear?' · '+esc(s.schoolYear):''}</small></div>
    <span class="badge ${status==='active'?'ok':'warn'}">${status==='active'?'AKTYWNA':'ZAWIESZONA'}</span>
    ${controls?`<button class="${status==='active'?'danger':'secondary'}" onclick="toggleSchool('${esc(s.id)}','${status==='active'?'suspended':'active'}')">${status==='active'?'Zawieś':'Aktywuj'}</button>`:''}
  </div>`;
}
function schoolsView(){
  $('#pageTitle').textContent='Szkoły';
  app.innerHTML=`<section class="card"><div class="row between"><div><h2>Wszystkie szkoły</h2><small>${schools.length} rekordów</small></div></div>${schools.map(s=>schoolRow(s,true)).join('')||'<div class="muted">Brak szkół.</div>'}</section>`;
}
function toggleSchool(id,status){
  const text=status==='suspended'?'zawiesić':'aktywować';
  if(confirm(`Czy na pewno ${text} tę szkołę?`))WolfConsole.setSchoolStatus(id,status);
}

function adminsView(){
  $('#pageTitle').textContent='Administratorzy';
  app.innerHTML=`
    <section class="card">
      <h2>Dodaj administratora systemowego</h2>
      <input id="adminUid" placeholder="Firebase UID">
      <input id="adminEmail" type="email" placeholder="E-mail (opisowo)">
      <select id="adminRole"><option value="admin">Administrator</option><option value="creator">Creator</option></select>
      <button style="width:100%" onclick="addAdmin()">Dodaj dostęp</button>
      <p class="muted">Console nie wyszukuje kont Firebase po e-mailu. Do nadania globalnego dostępu używany jest UID.</p>
    </section>
    <section class="card">
      <h2>Administratorzy systemowi</h2>
      ${admins.map(a=>{
        const self=(a.uid||a.id)===(window.__currentUid||'');
        return `<div class="item">
          <div class="row between"><div class="grow"><b>${esc(a.email||a.uid||a.id)}</b><br><small>${esc(a.uid||a.id)}</small></div><span class="badge">${esc(a.role||'admin')}</span></div>
          <div class="row" style="margin-top:8px">
            <select id="role-${esc(a.id)}"><option value="admin" ${a.role==='admin'?'selected':''}>Administrator</option><option value="creator" ${a.role==='creator'?'selected':''}>Creator</option></select>
            <button class="secondary" onclick="changeAdminRole('${esc(a.id)}')">Zmień</button>
            <button class="danger" onclick="removeAdmin('${esc(a.id)}')">Usuń</button>
          </div>
        </div>`;
      }).join('')||'<div class="muted">Brak administratorów.</div>'}
    </section>`;
}
function addAdmin(){
  const uid=$('#adminUid').value.trim();
  if(!uid)return toast('Wpisz UID');
  WolfConsole.addSystemAdmin(uid,$('#adminEmail').value.trim(),$('#adminRole').value);
}
function changeAdminRole(uid){WolfConsole.updateSystemAdminRole(uid,$('#role-'+CSS.escape(uid)).value)}
function removeAdmin(uid){if(confirm('Usunąć globalny dostęp tego administratora?'))WolfConsole.removeSystemAdmin(uid)}

WolfConsole.requestState();
