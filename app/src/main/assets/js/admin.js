function adminGuard(title){
  setHead(title,wolfSchool.schoolName||db.school);
  if(!syncLoggedIn){
    app.innerHTML='<div class="card warn"><b>Najpierw zaloguj się do WolfCloud.</b></div>';
    return false;
  }
  if(!wolfSchool.activeSchoolId && title!=='Szkoła'){
    app.innerHTML='<div class="card warn"><b>Brak aktywnej szkoły.</b><br>Wybierz szkołę lub zaakceptuj zaproszenie do szkoły.</div>';
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
        <div>
          <h2 style="margin:0">${esc(wolfSchool.schoolName||'WolfEdu')}</h2>
          <small>Rola: ${esc(roleLabel())}</small>
        </div>
        <span class="badge">${esc(wolfSchool.role||'—')}</span>
      </div>

      ${schools.length
        ? `<select onchange="changeActiveSchool(this.value)">
            ${schools.map(s=>`
              <option value="${esc(s.id)}" ${s.id===wolfSchool.activeSchoolId?'selected':''}>
                ${esc(s.name||'Szkoła')}
              </option>
            `).join('')}
          </select>`
        : `<div class="sync-note">
            Nie masz obecnie dostępnej szkoły. Do szkoły możesz dołączyć przez zaproszenie.
          </div>`
      }
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

  const can=canManageSchool();
  const students=wolfSchool.students||[];
  const parents=wolfSchool.parents||[];
  const classes=wolfSchool.classes||[];

  const parentNamesForStudent=(student)=>{
    const ids=Array.isArray(student.parentIds)?student.parentIds:[];
    return ids
      .map(id=>parents.find(p=>p.id===id)?.name||'')
      .filter(Boolean);
  };

  const studentNamesForParent=(parent)=>{
    const ids=Array.isArray(parent.studentIds)?parent.studentIds:[];
    return ids
      .map(id=>students.find(s=>s.id===id)?.name||'')
      .filter(Boolean);
  };

  app.innerHTML=`
    ${can?`
      <div class="card">
        <h2>Dodaj ucznia</h2>

        <input
          id="stuName"
          placeholder="Imię i nazwisko ucznia"
        >

        <select id="stuClass">
          <option value="">Klasa</option>
          ${classes.map(c=>`
            <option value="${esc(c.id)}">${esc(c.name)}</option>
          `).join('')}
        </select>

        <div class="grid">
          <input
            id="stuNumber"
            placeholder="Nr w dzienniku"
          >

          <input
            id="stuEmail"
            type="email"
            placeholder="E-mail ucznia"
          >
        </div>

        <div class="sync-note" style="margin-top:14px">
          <b>Rodzic / opiekun</b><br>
          Dane opcjonalne. Jeśli podasz e-mail, WolfEdu utworzy
          powiązane zaproszenie dla rodzica.
        </div>

        <input
          id="stuParentName"
          placeholder="Imię i nazwisko rodzica / opiekuna"
        >

        <div class="grid">
          <input
            id="stuParentEmail"
            type="email"
            placeholder="E-mail rodzica"
          >

          <input
            id="stuParentPhone"
            type="tel"
            placeholder="Telefon rodzica"
          >
        </div>

        <button
          style="width:100%"
          onclick="addCloudStudentMobile(this)">
          Dodaj ucznia
        </button>
      </div>
    `:''}

    <div class="card">
      <h2>Uczniowie</h2>

      ${students.map(student=>{
        const parentNames=parentNamesForStudent(student);

        return `
          <div class="item row between">
            <div>
              <b>${esc(student.name||'Uczeń')}</b><br>

              <small>
                ${esc(
                  classes.find(c=>c.id===student.classId)?.name
                  ||'Bez klasy'
                )}
                ${student.number?' · nr '+esc(student.number):''}
                ${student.email?' · '+esc(student.email):''}
              </small>

              ${parentNames.length?`
                <br>
                <small>
                  Rodzic / opiekun:
                  ${esc(parentNames.join(', '))}
                </small>
              `:''}
            </div>

            ${can?`
              <button
                class="danger mini"
                onclick="deleteCloudStudentMobile('${esc(student.id)}')">
                ×
              </button>
            `:''}
          </div>
        `;
      }).join('')||'<div class="empty">Brak uczniów</div>'}
    </div>

    <div class="card">
      <h2>Rodzice / opiekunowie</h2>

      ${parents.map(parent=>{
        const studentNames=studentNamesForParent(parent);

        return `
          <div class="item">
            <b>${esc(parent.name||'Rodzic / opiekun')}</b><br>

            <small>
              ${parent.email?esc(parent.email):'Brak e-maila'}
              ${parent.phone?' · '+esc(parent.phone):''}
            </small>

            <br>

            <small>
              ${studentNames.length
                ? 'Dziecko / dzieci: '+esc(studentNames.join(', '))
                : 'Brak przypisanego dziecka'}
            </small>
          </div>
        `;
      }).join('')||'<div class="empty">Brak rodziców / opiekunów</div>'}
    </div>`;
}

function addCloudStudentMobile(btn){
  const name=$('#stuName')?.value.trim()||'';

  if(!name){
    return toast('Wpisz imię i nazwisko ucznia');
  }

  const parentName=$('#stuParentName')?.value.trim()||'';
  const parentEmail=$('#stuParentEmail')?.value.trim()||'';
  const parentPhone=$('#stuParentPhone')?.value.trim()||'';

  btn.disabled=true;
  btn.textContent='Dodaję…';

  WolfSync.addCloudStudentWithParent(
    name,
    $('#stuClass')?.value||'',
    $('#stuNumber')?.value.trim()||'',
    $('#stuEmail')?.value.trim()||'',
    parentName,
    parentEmail,
    parentPhone
  );
}

function deleteCloudStudentMobile(id){
  if(confirm('Usunąć ucznia?')){
    WolfSync.deleteCloudStudent(id);
  }
}


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

function invitePersonList(role){
  if(role==='teacher')return wolfSchool.teachers||[];
  if(role==='student')return wolfSchool.students||[];
  if(role==='parent')return wolfSchool.parents||[];
  return [];
}

function invitePersonLabel(role,person){
  if(!person)return 'Osoba';

  if(role==='teacher'){
    return person.name||person.email||'Nauczyciel';
  }

  if(role==='student'){
    return person.name||person.email||'Uczeń';
  }

  if(role==='parent'){
    return person.name||person.email||'Rodzic / opiekun';
  }

  return person.name||person.email||'Osoba';
}

function inviteRoleChanged(){
  const role=$('#inviteRole')?.value||'';
  const personWrap=$('#invitePersonWrap');
  const personSelect=$('#invitePerson');
  const email=$('#inviteEmail');

  if(!personWrap||!personSelect||!email)return;

  const linked=['teacher','student','parent'].includes(role);

  if(!linked){
    personWrap.style.display='none';
    personSelect.innerHTML='<option value="">—</option>';

    email.readOnly=false;
    email.value='';
    email.placeholder='E-mail konta WolfEdu';
    return;
  }

  const list=invitePersonList(role);

  personWrap.style.display='';
  email.readOnly=true;
  email.value='';
  email.placeholder='E-mail zostanie pobrany z danych osoby';

  personSelect.innerHTML=`
    <option value="">Wybierz osobę</option>
    ${list.map(person=>`
      <option value="${esc(person.id)}">
        ${esc(invitePersonLabel(role,person))}
        ${person.email?' · '+esc(person.email):' · brak e-maila'}
      </option>
    `).join('')}
  `;
}

function invitePersonChanged(){
  const role=$('#inviteRole')?.value||'';
  const personId=$('#invitePerson')?.value||'';
  const email=$('#inviteEmail');

  if(!email)return;

  const person=invitePersonList(role).find(
    p=>String(p.id||'')===String(personId)
  );

  email.value=person?.email||'';
}

function linkedMemberPerson(member){
  const type=String(member?.personType||'').toLowerCase();
  const id=String(member?.personId||'');

  if(!type||!id)return null;

  return invitePersonList(type).find(
    p=>String(p.id||'')===id
  )||null;
}

function memberRoleControl(member){
  const role=String(member?.role||'').toLowerCase();
  const linked=!!member?.personType&&!!member?.personId;

  if(linked){
    return `
      <div class="sync-note" style="margin-top:8px">
        Rola jest powiązana z rekordem
        <b>${esc(member.personType)}</b>.
      </div>
    `;
  }

  if(['admin','director'].includes(role)){
    return `
      <div class="row" style="margin-top:8px">
        <select id="role-${esc(member.uid)}">
          <option value="admin" ${role==='admin'?'selected':''}>
            Administrator
          </option>
          <option value="director" ${role==='director'?'selected':''}>
            Dyrektor
          </option>
        </select>

        <button
          class="secondary"
          onclick="changeMemberRoleMobile('${esc(member.uid)}')">
          Zmień
        </button>

        <button
          class="danger"
          onclick="removeMemberMobile('${esc(member.uid)}')">
          Usuń
        </button>
      </div>
    `;
  }

  return `
    <div class="row" style="margin-top:8px">
      <button
        class="danger"
        onclick="removeMemberMobile('${esc(member.uid)}')">
        Usuń
      </button>
    </div>
  `;
}

function usersRolesPage(){
  if(!adminGuard('Użytkownicy i role'))return;

  const can=canManageSchool();
  const members=wolfSchool.members||[];
  const invites=wolfSchool.invites||[];

  if(!can){
    app.innerHTML=`
      <div class="card warn">
        <b>Brak uprawnień.</b><br>
        Zarządzanie rolami wymaga roli właściciela,
        administratora lub dyrektora.
      </div>`;
    return;
  }

  app.innerHTML=`
    <div class="card">
      <h2>Zaproś użytkownika</h2>

      <select id="inviteRole" onchange="inviteRoleChanged()">
        <option value="teacher">Nauczyciel</option>
        <option value="student">Uczeń</option>
        <option value="parent">Rodzic / opiekun</option>
        <option value="admin">Administrator</option>
        <option value="director">Dyrektor</option>
      </select>

      <div id="invitePersonWrap">
        <select id="invitePerson" onchange="invitePersonChanged()">
          <option value="">Wybierz osobę</option>
        </select>
      </div>

      <input
        id="inviteEmail"
        type="email"
        placeholder="E-mail konta WolfEdu"
      >

      <button
        style="width:100%"
        onclick="inviteMemberMobile(this)">
        Wyślij zaproszenie
      </button>

      <div class="sync-note">
        Nauczyciel, uczeń i rodzic są zapraszani przez istniejący
        rekord osoby. Administrator i dyrektor mogą być zaproszeni
        bez powiązania osobowego.
      </div>
    </div>

    <div class="card">
      <h2>Członkowie szkoły</h2>

      ${members.map(member=>{
        const owner=String(member.role||'')==='owner';
        const person=linkedMemberPerson(member);

        return `
          <div class="item">
            <div class="row between">
              <div>
                <b>
                  ${esc(
                    person?.name
                    ||member.email
                    ||member.uid
                    ||'Użytkownik'
                  )}
                </b><br>

                <small>${esc(member.email||member.uid||'')}</small>

                ${person?`
                  <br>
                  <small>
                    Powiązano:
                    ${esc(member.personType||'')}
                    · ${esc(person.name||member.personId||'')}
                  </small>
                `:''}
              </div>

              <span class="badge">
                ${esc(member.role||'—')}
              </span>
            </div>

            ${owner
              ? '<small>Właściciela szkoły nie można usunąć ani zdegradować.</small>'
              : memberRoleControl(member)
            }
          </div>
        `;
      }).join('')||'<div class="empty">Brak członków.</div>'}
    </div>

    <div class="card">
      <h2>Oczekujące zaproszenia</h2>

      ${invites.map(invite=>{
        const person=invite.personId
          ? invitePersonList(invite.personType||invite.role).find(
              p=>String(p.id||'')===String(invite.personId)
            )
          : null;

        return `
          <div class="item row between">
            <div>
              <b>${esc(person?.name||invite.email||'')}</b><br>

              <small>
                ${esc(invite.role||'')}
                ${person?' · '+esc(person.name||''):''}
              </small>
            </div>

            <button
              class="danger mini"
              onclick="cancelInviteMobile('${esc(invite.id)}')">
              Anuluj
            </button>
          </div>
        `;
      }).join('')||'<div class="empty">Brak oczekujących zaproszeń.</div>'}
    </div>`;

  inviteRoleChanged();
}

function inviteMemberMobile(btn){
  const role=$('#inviteRole')?.value||'';
  const email=$('#inviteEmail')?.value.trim()||'';

  if(!email){
    return toast('Ta osoba nie ma podanego e-maila.');
  }

  if(['teacher','student','parent'].includes(role)){
    const personId=$('#invitePerson')?.value||'';

    if(!personId){
      return toast('Wybierz osobę z listy.');
    }

    btn.disabled=true;
    btn.textContent='Wysyłam…';

    WolfSync.inviteLinkedSchoolMember(
      email,
      role,
      role,
      personId
    );

    return;
  }

  if(!['admin','director'].includes(role)){
    return toast('Nieprawidłowa rola.');
  }

  btn.disabled=true;
  btn.textContent='Wysyłam…';

  WolfSync.inviteSchoolMember(
    email,
    role
  );
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
