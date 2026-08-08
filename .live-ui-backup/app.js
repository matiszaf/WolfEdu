const KEY='wolfEduDataV1';
let db=JSON.parse(localStorage.getItem(KEY)||'null')||{school:'',classes:[],students:[],grades:[],attendance:[],lessons:[],tasks:[]};
let page='home',editingGradeId=null; const $=s=>document.querySelector(s); const app=$('#app');
function migrate(){db.grades=(db.grades||[]).map(g=>({...g,weight:Number(g.weight||1)}));db.subjects=db.subjects||[];db.tasks=(db.tasks||[]).map(t=>({...t,done:Boolean(t.done),type:t.type||'Zadanie domowe',priority:t.priority||'Normalny'}));save()}
function save(){db._sync=db._sync||{};db._sync.updatedAt=Date.now();localStorage.setItem(KEY,JSON.stringify(db));scheduleCloudSync()}function id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function toast(t){let x=$('#toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1700)}
function setHead(t,s){$('#headTitle').textContent=t;$('#headSub').textContent=s||db.school}
function setup(){setHead('WolfEdu','Pierwsza konfiguracja');$('#nav').classList.add('hidden');app.innerHTML=`<section class="setup"><div class="card"><h2>Utwórz swoją szkołę</h2><p class="muted">Dane zostają wyłącznie na tym telefonie.</p><input id="school" placeholder="Nazwa szkoły, np. SP 35 w Gdyni"><button style="width:100%;margin-top:8px" onclick="createSchool()">Uruchom WolfEdu</button></div></section>`}
function createSchool(){let v=$('#school').value.trim();if(!v)return toast('Wpisz nazwę szkoły');db.school=v;save();render('home')}
function render(p=page){page=p;if(!db.school&&!wolfSchool.schoolName)return setup();$('#nav').classList.remove('hidden');document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));({home,classes,studentsPage,teachersPage,subjectsPage,schoolPage,usersRolesPage,myInvitesPage,grades,tasks,attendance,plan,settings}[page]||home)()}


function canManageSchool(){
  return ['owner','admin','director'].includes(String(wolfSchool?.role||'').toLowerCase());
}
function roleLabel(){
  const r=String(wolfSchool?.role||'').toLowerCase();
  return ({owner:'Właściciel',admin:'Administrator',director:'Dyrektor',teacher:'Nauczyciel',parent:'Rodzic',student:'Uczeń'})[r]||wolfSchool?.role||'Użytkownik';
}
