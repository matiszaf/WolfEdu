const KEY='wolfEduDataV1';
let db=JSON.parse(localStorage.getItem(KEY)||'null')||{school:'',classes:[],students:[],grades:[],attendance:[],lessons:[],tasks:[]};
let page='home',currentPage='home',editingGradeId=null;
let wolfUiRefreshTimer=null;
const $=s=>document.querySelector(s);
const app=$('#app');

function schedulePageRefresh(delay=70){
  clearTimeout(wolfUiRefreshTimer);
  const target=currentPage||page||'home';

  wolfUiRefreshTimer=setTimeout(()=>{
    wolfUiRefreshTimer=null;
    if((currentPage||page||'home')!==target)return;
    render(target);
  },Math.max(0,Number(delay)||0));
}

function migrate(){db.grades=(db.grades||[]).map(g=>({...g,weight:Number(g.weight||1)}));db.subjects=db.subjects||[];db.tasks=(db.tasks||[]).map(t=>({...t,done:Boolean(t.done),type:t.type||'Zadanie domowe',priority:t.priority||'Normalny'}));save()}
function save(){db._sync=db._sync||{};db._sync.updatedAt=Date.now();localStorage.setItem(KEY,JSON.stringify(db));scheduleCloudSync()}function id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function toast(t){let x=$('#toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1700)}
function setHead(t,s){$('#headTitle').textContent=t;$('#headSub').textContent=s||db.school}
function setup(){setHead('WolfEdu','Pierwsza konfiguracja');$('#nav').classList.add('hidden');app.innerHTML=`<section class="setup"><div class="card"><h2>Utwórz swoją szkołę</h2><p class="muted">Dane zostają wyłącznie na tym telefonie.</p><input id="school" placeholder="Nazwa szkoły, np. SP 35 w Gdyni"><button style="width:100%;margin-top:8px" onclick="createSchool()">Uruchom WolfEdu</button></div></section>`}
function createSchool(){let v=$('#school').value.trim();if(!v)return toast('Wpisz nazwę szkoły');db.school=v;save();render('home')}
function schoolSystemBlocked(){
  return !!wolfSchool.activeSchoolId &&
    ['suspended','maintenance'].includes(
      String(wolfSchool.systemStatus||'active').toLowerCase()
    );
}

function renderSchoolSystemLock(){
  const maintenance=String(wolfSchool.systemStatus)==='maintenance';
  setHead(
    maintenance?'Przerwa techniczna':'Szkoła zawieszona',
    wolfSchool.schoolName||'WolfEdu'
  );

  app.innerHTML=`
    <section class="card" style="margin-top:18px;text-align:center;padding:28px 18px">
      <div style="font-size:42px;margin-bottom:10px">${maintenance?'🛠':'⛔'}</div>
      <h2>${maintenance?'Trwa konserwacja WolfCloud':'Dostęp do szkoły został zawieszony'}</h2>
      <p class="muted" style="line-height:1.5">
        ${esc(
          wolfSchool.systemStatusReason||
          (maintenance
            ? 'Administrator systemu prowadzi prace techniczne.'
            : 'Skontaktuj się z administratorem szkoły lub WolfEdu.')
        )}
      </p>
      <div class="sync-note" style="margin-top:14px">
        ${esc(wolfSchool.schoolName||'Aktywna szkoła')}
      </div>
      <button class="secondary btn-full" style="margin-top:14px"
        onclick="render('settings')">
        Konto i ustawienia
      </button>
    </section>`;
}

function wolfMandatoryUpdateBlocked(){
  const s=(typeof WOLF_OTA!=='undefined' && WOLF_OTA) ? WOLF_OTA.state : null;

  return !!(
    s &&
    s.phase==='available' &&
    s.available &&
    s.mandatory
  );
}

function renderMandatoryUpdateLock(){
  const s=WOLF_OTA.state;

  setHead(
    'Wymagana aktualizacja',
    `WolfEdu ${s.versionName||''}`
  );

  $('#nav').classList.add('hidden');

  app.innerHTML=`
    <section class="card"
      style="margin-top:18px;text-align:center;padding:28px 18px">

      <div style="font-size:42px;margin-bottom:10px">⬆️</div>

      <h2>Musisz zaktualizować WolfEdu</h2>

      <p class="muted" style="line-height:1.5">
        Wersja ${esc(s.versionName||'')} jest wymagana przed dalszym
        korzystaniem z aplikacji.
      </p>

      ${
        s.changelog
          ? `<div class="sync-note" style="margin-top:14px;text-align:left">
               <b>Co nowego:</b><br>
               ${esc(s.changelog)}
             </div>`
          : ''
      }

      ${
        s.downloadState
          ? `<div class="sync-note" style="margin-top:14px">
               ${esc(s.message||s.downloadState)}
             </div>`
          : ''
      }

      <button
        style="width:100%;margin-top:16px"
        onclick="installWolfUpdate()">
        Zaktualizuj teraz
      </button>

      <button
        class="secondary"
        style="width:100%;margin-top:10px"
        onclick="checkWolfUpdate(true)">
        Sprawdź ponownie
      </button>
    </section>`;
}

function render(p=page){
  page=p||'home';
  currentPage=page;

  if(wolfMandatoryUpdateBlocked()){
    renderMandatoryUpdateLock();
    return;
  }

  if(schoolSystemBlocked() && currentPage!=='settings'){
    $('#nav').classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(
      b=>b.classList.toggle('active',b.dataset.page===currentPage)
    );
    renderSchoolSystemLock();
    return;
  }

  if(!db.school&&!wolfSchool.schoolName)return setup();

  $('#nav').classList.remove('hidden');
  updateRoleNavigation();

  document.querySelectorAll('nav button').forEach(
    b=>b.classList.toggle('active',b.dataset.page===page)
  );

  ({
    home,
    learning,
    schoolHub,
    peopleHub,
    classes,
    studentsPage,
    teachersPage,
    subjectsPage,
    schoolPage,
    usersRolesPage,
    myInvitesPage,
    grades,
    tasks,
    attendance,
    plan,
    realizedLessons,
    settings
  }[page]||home)();
}

function currentWolfRole(){
  return String(wolfSchool?.role||'').toLowerCase();
}

function wolfRoleGroup(){
  const role=currentWolfRole();

  if(['owner','admin'].includes(role))return 'admin';
  if(['teacher','director'].includes(role))return 'staff';
  if(['student','parent'].includes(role))return 'learner';

  return 'guest';
}

function roleNavPages(){
  const group=wolfRoleGroup();

  if(group==='admin'){
    return ['home','learning','schoolHub','peopleHub','settings'];
  }

  if(group==='staff'){
    return ['home','learning','schoolHub','peopleHub','settings'];
  }

  if(group==='learner'){
    return ['home','learning','schoolHub','settings'];
  }

  return ['home','settings'];
}

function updateRoleNavigation(){
  const allowed=new Set(roleNavPages());

  document.querySelectorAll('#nav button[data-page]').forEach(btn=>{
    btn.style.display=allowed.has(btn.dataset.page)?'':'none';
  });
}

function learning(){
  setHead('Nauka','Moduły edukacyjne');

  app.innerHTML=`
    <section class="card">
      <h2>Nauka</h2>

      <div class="hub-grid">
        <button class="hub-tile" onclick="render('grades')">
          <span class="hub-icon">★</span>
          <b>Oceny</b>
          <small>Oceny i podsumowania</small>
        </button>

        <button class="hub-tile" onclick="render('tasks')">
          <span class="hub-icon">✓</span>
          <b>Zadania</b>
          <small>Zadania i terminy</small>
        </button>

        <button class="hub-tile" onclick="render('attendance')">
          <span class="hub-icon">◷</span>
          <b>Frekwencja</b>
          <small>Obecności i nieobecności</small>
        </button>

        <button class="hub-tile" onclick="render('plan')">
          <span class="hub-icon">▦</span>
          <b>Plan lekcji</b>
          <small>Plan i godziny zajęć</small>
        </button>

        <button class="hub-tile" onclick="render('realizedLessons')">
          <span class="hub-icon">☰</span>
          <b>Zrealizowane lekcje</b>
          <small>Tematy przeprowadzonych zajęć</small>
        </button>
      </div>
    </section>`;
}

function schoolHub(){
  setHead('Szkoła',wolfSchool.schoolName||'WolfEdu');

  const group=wolfRoleGroup();
  const staffLike=['staff','admin'].includes(group);

  app.innerHTML=`
    <section class="card">
      <h2>Szkoła</h2>

      <div class="hub-grid">
        <button class="hub-tile" onclick="render('schoolPage')">
          <span class="hub-icon">🏫</span>
          <b>Informacje o szkole</b>
          <small>Dane szkoły</small>
        </button>

        ${staffLike ? `
        <button class="hub-tile" onclick="render('classes')">
          <span class="hub-icon">▦</span>
          <b>Klasy</b>
          <small>Klasy szkolne</small>
        </button>
        ` : ''}

        <button class="hub-tile" onclick="render('subjectsPage')">
          <span class="hub-icon">▤</span>
          <b>Przedmioty</b>
          <small>Przedmioty szkolne</small>
        </button>
      </div>
    </section>`;
}

function peopleHub(){
  setHead('Osoby',wolfSchool.schoolName||'WolfEdu');

  const role=String(wolfSchool?.role||'').toLowerCase();
  const adminLike=['owner','admin'].includes(role);

  app.innerHTML=`
    <section class="card">
      <h2>Osoby</h2>

      <div class="hub-grid">
        <button class="hub-tile" onclick="render('studentsPage')">
          <span class="hub-icon">♟</span>
          <b>Uczniowie</b>
          <small>Uczniowie szkoły</small>
        </button>

        <button class="hub-tile" onclick="render('teachersPage')">
          <span class="hub-icon">♙</span>
          <b>Nauczyciele</b>
          <small>Informacje o nauczycielach</small>
        </button>

        ${adminLike ? `
          <button class="hub-tile" onclick="render('usersRolesPage')">
            <span class="hub-icon">⚙</span>
            <b>Użytkownicy i role</b>
            <small>Konta i uprawnienia</small>
          </button>
        ` : ''}
      </div>
    </section>`;
}




function canManageSchool(){
  return ['owner','admin','director'].includes(String(wolfSchool?.role||'').toLowerCase());
}

function canTeach(){
  const role=String(wolfSchool?.role||'').toLowerCase();
  return ['owner','admin','director','teacher'].includes(role);
}

function currentTeacherRecord(){
  if(String(wolfSchool?.role||'').toLowerCase()!=='teacher'){
    return null;
  }

  const teachers=wolfSchool.teachers||[];
  const personType=String(wolfSchool?.personType||'').toLowerCase();
  const personId=String(wolfSchool?.personId||'');

  if(personType==='teacher' && personId){
    const linked=teachers.find(t=>String(t.id||'')===personId);
    if(linked)return linked;
  }

  // Fallback dla istniejących kont utworzonych przed systemem personId.
  const email=String(syncEmail||'').trim().toLowerCase();
  if(!email)return null;

  return teachers.find(t=>
    String(t.email||'').trim().toLowerCase()===email
  )||null;
}

function teachingTeacherId(){
  const teacher=currentTeacherRecord();
  return teacher?.id||'';
}


function roleLabel(){
  const r=String(wolfSchool?.role||'').toLowerCase();
  return ({owner:'Właściciel',admin:'Administrator',director:'Dyrektor',teacher:'Nauczyciel',parent:'Rodzic',student:'Uczeń'})[r]||wolfSchool?.role||'Użytkownik';
}
