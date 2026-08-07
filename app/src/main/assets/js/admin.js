function adminGuard(title){
  setHead(title,wolfSchool.schoolName||db.school);
  if(!syncLoggedIn){
    app.innerHTML='<div class="card warn"><b>Najpierw zaloguj się do WolfCloud.</b></div>';
    return false;
  }
  if(!wolfSchool.activeSchoolId && title!=='Szkoła'){
    app.innerHTML='<div class="card warn"><b>Brak aktywnej szkoły.</b><br>Utwórz lub wybierz szkołę w sekcji Szkoła.</div>';
    return false;
  }
  return true;
}

function schoolPage(){
  if(!adminGuard('Szkoła'))return;
  const can=canManageSchool();
  const schools=wolfSchool.schools||[];
  app.innerHTML=`
    <div class="card">
      <div class="row between">
        <div><h2 style="margin:0">${esc(wolfSchool.schoolName||'WolfEdu')}</h2><small>Rola: ${esc(roleLabel())}</small></div>
        <span class="badge">${esc(wolfSchool.role||'—')}</span>
      </div>
      ${schools.length?`<select onchange="changeActiveSchool(this.value)">${schools.map(s=>`<option value="${esc(s.id)}" ${s.id===wolfSchool.activeSchoolId?'selected':''}>${esc(s.name||'Szkoła')}</option>`).join('')}</select>`:''}
    </div>
    ${can?`<div class="card"><h2>Utwórz szkołę</h2>
      <input id="csName" placeholder="Nazwa szkoły">
      <input id="csCity" placeholder="Miejscowość">
      <select id="csType"><option>Szkoła podstawowa</option><option>Liceum</option><option>Technikum</option><option>Szkoła branżowa</option><option>Inna</option></select>
      <input id="csYear" placeholder="Rok szkolny, np. 2026/2027">
      <button style="width:100%" onclick="createCloudSchoolMobile(this)">Utwórz szkołę</button>
    </div>`:`<div class="card"><small>Tworzenie i administracja szkołą wymagają roli administratora, dyrektora lub właściciela.</small></div>`}
    <div class="card"><h2>Zarządzanie</h2>
      <div class="action-grid">
        <button class="action-card" onclick="render('classes')"><span class="action-icon">▦</span><b>Klasy</b><small>${(wolfSchool.classes||[]).length}</small></button>
        <button class="action-card" onclick="render('studentsPage')"><span class="action-icon">♙</span><b>Uczniowie</b><small>${(wolfSchool.students||[]).length}</small></button>
        <button class="action-card" onclick="render('teachersPage')"><span class="action-icon">♟</span><b>Nauczyciele</b><small>${(wolfSchool.teachers||[]).length}</small></button>
        <button class="action-card" onclick="render('subjectsPage')"><span class="action-icon">▤</span><b>Przedmioty</b><small>${(wolfSchool.subjects||[]).length}</small></button>
      </div>
    </div>`;
}
function createCloudSchoolMobile(btn){
  const name=$('#csName').value.trim();
  if(!name)return toast('Wpisz nazwę szkoły');
  btn.disabled=true;btn.textContent='Tworzę…';
  WolfSync.createCloudSchool(name,$('#csCity').value.trim(),$('#csType').value,$('#csYear').value.trim());
}

function studentsPage(){
  if(!adminGuard('Uczniowie'))return;
  const can=canManageSchool(), students=wolfSchool.students||[], classes=wolfSchool.classes||[];
  app.innerHTML=`
    ${can?`<div class="card"><h2>Dodaj ucznia</h2>
      <input id="stuName" placeholder="Imię i nazwisko">
      <select id="stuClass"><option value="">Klasa</option>${classes.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>
      <div class="grid"><input id="stuNumber" placeholder="Nr w dzienniku"><input id="stuEmail" type="email" placeholder="E-mail"></div>
      <button style="width:100%" onclick="addCloudStudentMobile(this)">Dodaj ucznia</button>
    </div>`:''}
    <div class="card"><h2>Uczniowie</h2>${students.map(s=>`<div class="item row between"><div><b>${esc(s.name||'Uczeń')}</b><br><small>${esc(classes.find(c=>c.id===s.classId)?.name||'Bez klasy')}${s.number?' · nr '+esc(s.number):''}${s.email?' · '+esc(s.email):''}</small></div>${can?`<button class="danger mini" onclick="deleteCloudStudentMobile('${s.id}')">×</button>`:''}</div>`).join('')||'<div class="empty">Brak uczniów</div>'}</div>`;
}
function addCloudStudentMobile(btn){
  const name=$('#stuName').value.trim(); if(!name)return toast('Wpisz imię i nazwisko');
  btn.disabled=true;btn.textContent='Dodaję…';
  WolfSync.addCloudStudent(name,$('#stuClass').value,$('#stuNumber').value.trim(),$('#stuEmail').value.trim());
}
function deleteCloudStudentMobile(id){if(confirm('Usunąć ucznia?'))WolfSync.deleteCloudStudent(id)}

function teachersPage(){
  if(!adminGuard('Nauczyciele'))return;
  const can=canManageSchool(), list=wolfSchool.teachers||[];
  app.innerHTML=`
    ${can?`<div class="card"><h2>Dodaj nauczyciela</h2><input id="teaName" placeholder="Imię i nazwisko"><input id="teaEmail" type="email" placeholder="E-mail"><input id="teaTitle" placeholder="Tytuł / stanowisko"><button style="width:100%" onclick="addCloudTeacherMobile(this)">Dodaj nauczyciela</button></div>`:''}
    <div class="card"><h2>Nauczyciele</h2>${list.map(t=>`<div class="item row between"><div><b>${esc(t.name||'Nauczyciel')}</b><br><small>${esc(t.email||'')}${t.title?' · '+esc(t.title):''}</small></div>${can?`<button class="danger mini" onclick="deleteCloudTeacherMobile('${t.id}')">×</button>`:''}</div>`).join('')||'<div class="empty">Brak nauczycieli</div>'}</div>`;
}
function addCloudTeacherMobile(btn){
  const name=$('#teaName').value.trim();if(!name)return toast('Wpisz imię i nazwisko');
  btn.disabled=true;btn.textContent='Dodaję…';
  WolfSync.addCloudTeacher(name,$('#teaEmail').value.trim(),$('#teaTitle').value.trim());
}
function deleteCloudTeacherMobile(id){if(confirm('Usunąć nauczyciela?'))WolfSync.deleteCloudTeacher(id)}

function subjectsPage(){
  if(!adminGuard('Przedmioty'))return;
  const can=canManageSchool(), list=wolfSchool.subjects||[];
  app.innerHTML=`
    ${can?`<div class="card"><h2>Dodaj przedmiot</h2><input id="subName" placeholder="Nazwa"><input id="subShort" placeholder="Skrót, np. MAT"><button style="width:100%" onclick="addCloudSubjectMobile(this)">Dodaj przedmiot</button></div>`:''}
    <div class="card"><h2>Przedmioty</h2>${list.map(s=>`<div class="item row between"><div><b>${esc(s.name||'Przedmiot')}</b><br><small>${esc(s.short||'')}</small></div>${can?`<button class="danger mini" onclick="deleteCloudSubjectMobile('${s.id}')">×</button>`:''}</div>`).join('')||'<div class="empty">Brak przedmiotów</div>'}</div>`;
}
function addCloudSubjectMobile(btn){
  const name=$('#subName').value.trim();if(!name)return toast('Wpisz nazwę przedmiotu');
  btn.disabled=true;btn.textContent='Dodaję…';
  WolfSync.addCloudSubject(name,$('#subShort').value.trim());
}
function deleteCloudSubjectMobile(id){if(confirm('Usunąć przedmiot?'))WolfSync.deleteCloudSubject(id)}
