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
  const schools=wolfSchool.schools||[];
  app.innerHTML=`
    <div class="card">
      <div class="row between">
        <div><h2 style="margin:0">${esc(wolfSchool.schoolName||'WolfEdu')}</h2><small>Rola: ${esc(roleLabel())}</small></div>
        <span class="badge">${esc(wolfSchool.role||'—')}</span>
      </div>
      ${schools.length?`<select onchange="changeActiveSchool(this.value)">${schools.map(s=>`<option value="${esc(s.id)}" ${s.id===wolfSchool.activeSchoolId?'selected':''}>${esc(s.name||'Szkoła')}</option>`).join('')}</select>`:''}
    </div>
    <div class="card"><h2>Utwórz szkołę</h2>
      <input id="csName" placeholder="Nazwa szkoły">
      <input id="csCity" placeholder="Miejscowość">
      <select id="csType"><option>Szkoła podstawowa</option><option>Liceum</option><option>Technikum</option><option>Szkoła branżowa</option><option>Inna</option></select>
      <input id="csYear" placeholder="Rok szkolny, np. 2026/2027">
      <button style="width:100%" onclick="createCloudSchoolMobile(this)">Utwórz szkołę</button>
      <div class="sync-note">Tak samo jak w panelu WWW: każde zalogowane konto może utworzyć własną szkołę i automatycznie zostaje jej właścicielem.</div>
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


function roleOptions(selected){
  const roles=[
    ['admin','Administrator'],
    ['director','Dyrektor'],
    ['teacher','Nauczyciel'],
    ['parent','Rodzic'],
    ['student','Uczeń']
  ];
  return roles.map(([v,l])=>`<option value="${v}" ${selected===v?'selected':''}>${l}</option>`).join('');
}

function usersRolesPage(){
  if(!adminGuard('Użytkownicy i role'))return;
  const can=canManageSchool(), members=wolfSchool.members||[], invites=wolfSchool.invites||[];
  if(!can){
    app.innerHTML='<div class="card warn"><b>Brak uprawnień.</b><br>Zarządzanie rolami wymaga roli właściciela, administratora lub dyrektora.</div>';
    return;
  }

  app.innerHTML=`
    <div class="card">
      <h2>Zaproś użytkownika</h2>
      <input id="inviteEmail" type="email" placeholder="E-mail konta WolfEdu">
      <select id="inviteRole">${roleOptions('teacher')}</select>
      <button style="width:100%" onclick="inviteMemberMobile(this)">Wyślij zaproszenie</button>
      <div class="sync-note">Użytkownik zobaczy zaproszenie po zalogowaniu na ten adres e-mail. Nie musisz znać jego UID.</div>
    </div>

    <div class="card">
      <h2>Członkowie szkoły</h2>
      ${members.map(m=>{
        const owner=String(m.role||'')==='owner';
        return `<div class="item">
          <div class="row between"><div><b>${esc(m.email||m.uid||'Użytkownik')}</b><br><small>${esc(m.uid||'')}</small></div><span class="badge">${esc(m.role||'—')}</span></div>
          ${owner?'<small>Właściciela szkoły nie można usunąć ani zdegradować.</small>':`
            <div class="row" style="margin-top:8px">
              <select id="role-${esc(m.uid)}">${roleOptions(m.role||'student')}</select>
              <button class="secondary" onclick="changeMemberRoleMobile('${esc(m.uid)}')">Zmień</button>
              <button class="danger" onclick="removeMemberMobile('${esc(m.uid)}')">Usuń</button>
            </div>`}
        </div>`;
      }).join('')||'<div class="empty">Brak członków.</div>'}
    </div>

    <div class="card">
      <h2>Oczekujące zaproszenia</h2>
      ${invites.map(i=>`<div class="item row between"><div><b>${esc(i.email||'')}</b><br><small>${esc(i.role||'')}</small></div><button class="danger mini" onclick="cancelInviteMobile('${esc(i.id)}')">Anuluj</button></div>`).join('')||'<div class="empty">Brak oczekujących zaproszeń.</div>'}
    </div>`;
}

function inviteMemberMobile(btn){
  const email=$('#inviteEmail').value.trim();
  if(!email)return toast('Wpisz e-mail');
  btn.disabled=true;btn.textContent='Wysyłam…';
  WolfSync.inviteSchoolMember(email,$('#inviteRole').value);
}
function cancelInviteMobile(id){if(confirm('Anulować zaproszenie?'))WolfSync.cancelSchoolInvite(id)}
function changeMemberRoleMobile(uid){
  const role=$('#role-'+CSS.escape(uid)).value;
  WolfSync.changeMemberRole(uid,role);toast('Zmieniam rolę…');
}
function removeMemberMobile(uid){if(confirm('Usunąć dostęp tego użytkownika do szkoły?'))WolfSync.removeSchoolMember(uid)}

function myInvitesPage(){
  setHead('Zaproszenia','WolfEdu');
  const list=wolfSchool.myInvites||[];
  app.innerHTML=`<div class="card"><h2>Zaproszenia do szkół</h2>
  ${list.map(i=>`<div class="item"><b>${esc(i.schoolName||'Szkoła')}</b><br><small>Rola: ${esc(i.role||'')}</small><div class="row" style="margin-top:8px"><button onclick="acceptInviteMobile('${esc(i.id)}')">Dołącz</button><button class="secondary" onclick="rejectInviteMobile('${esc(i.id)}')">Odrzuć</button></div></div>`).join('')||'<div class="empty">Nie masz oczekujących zaproszeń.</div>'}</div>`;
}
function acceptInviteMobile(id){WolfSync.acceptSchoolInvite(id);toast('Dołączam do szkoły…')}
function rejectInviteMobile(id){if(confirm('Odrzucić zaproszenie?'))WolfSync.rejectSchoolInvite(id)}
