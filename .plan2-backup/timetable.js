const days=['Poniedziałek','Wtorek','Środa','Czwartek','Piątek'];
function plan(){
  let schoolName=wolfSchool.schoolName||db.school;setHead('Plan lekcji',schoolName);
  if(wolfSchool.activeSchoolId){
    if(!wolfSchool.classes.length){
      app.innerHTML=`<div class="card">
        <div class="row between">
          <div>
            <h2 style="margin:0">Plan z WolfCloud</h2>
            <small>${esc(schoolName)} · konto i szkoła są połączone</small>
          </div>
          <span class="badge">${esc(wolfSchool.role||'użytkownik')}</span>
        </div>
        <div class="warn" style="margin-top:12px">
          <b>Brak dostępnych klas</b><br>
          Plan jest połączony z WolfCloud, ale lista klas jest jeszcze pusta albo nadal się synchronizuje.
        </div>
        <button class="secondary" style="width:100%;margin-top:10px"
          onclick="WolfSync.requestSchoolData();toast('Odświeżam dane szkoły…')">
          Odśwież dane szkoły
        </button>
      </div>`;
      return;
    }
    let selected=localStorage.getItem('wolfEduPlanClass')||wolfSchool.classes[0].id;
    if(!wolfSchool.classes.some(c=>c.id===selected))selected=wolfSchool.classes[0].id;
    localStorage.setItem('wolfEduPlanClass',selected);
    let classOptions=wolfSchool.classes.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name||'Klasa')}</option>`).join('');
    let rows=days.map((d,idx)=>{let items=wolfSchool.timetable.filter(l=>l.classId===selected&&Number(l.day)===idx+1).sort((a,b)=>Number(a.lesson)-Number(b.lesson));return `<div class="day">${d}</div>${items.map(l=>{let sub=wolfSchool.subjects.find(x=>x.id===l.subjectId),tea=wolfSchool.teachers.find(x=>x.id===l.teacherId);return `<div class="item lesson" ${canManageSchool()?`onclick="openMobileLessonEditor('${l.id}','${selected}',${Number(l.day)},${Number(l.lesson)})"`:''}><div class="time">${esc(l.start||('#'+l.lesson))}</div><div style="flex:1"><b>${esc(sub?.name||'Przedmiot')}</b><br><small>${tea?.name?esc(tea.name)+' · ':''}${l.room?'sala '+esc(l.room):''}${l.end?' · do '+esc(l.end):''}</small></div><span class="badge">${esc(l.lesson)}</span></div>`}).join('')||'<small>Brak lekcji</small>'}`}).join('');
    app.innerHTML=`<div class="card"><div class="row between"><div><h2 style="margin:0">Plan z WolfCloud</h2><small>${esc(schoolName)} · synchronizacja realtime</small></div><span class="badge">${esc(wolfSchool.role||'użytkownik')}</span></div><select id="cloudPlanClass" onchange="changeCloudPlanClass(this.value)">${classOptions}</select></div><div class="card"><h2>Plan klasy</h2>${rows}</div>${canManageSchool()?`<div class="card"><h2>Edytuj plan</h2><button style="width:100%" onclick="openMobileLessonEditor('', '${selected}', 1, 1)">Dodaj lekcję</button><small>Możesz też dotknąć lekcji poniżej, aby ją edytować.</small></div>`:`<div class="card"><small>Plan jest synchronizowany realtime. Edycja wymaga roli administratora, dyrektora lub właściciela.</small></div>`}`;
    return;
  }
  app.innerHTML=`<div class="card warn"><b>Plan lokalny (legacy)</b><br>Połącz konto ze szkołą w Panelu WWW, aby korzystać z planu synchronizowanego realtime.</div><div class="card"><h2>Dodaj lekcję lokalnie</h2><select id="pDay">${days.map(d=>`<option>${d}</option>`).join('')}</select><div class="grid"><input id="pTime" type="time"><input id="pSubject" placeholder="Przedmiot"></div><input id="pRoom" placeholder="Sala / nauczyciel (opcjonalnie)"><button style="width:100%;margin-top:6px" onclick="addLesson()">Dodaj do planu</button></div><div class="card"><h2>Twój plan lokalny</h2>${days.map(d=>`<div class="day">${d}</div>${db.lessons.filter(l=>l.day===d).sort((a,b)=>a.time.localeCompare(b.time)).map(l=>`<div class="item lesson"><div class="time">${esc(l.time)}</div><div style="flex:1"><b>${esc(l.subject)}</b><br><small>${esc(l.room||'')}</small></div><button class="danger mini" onclick="delLesson('${l.id}')">×</button></div>`).join('')||'<small>Brak lekcji</small>'}`).join('')}</div>`
}
function changeCloudPlanClass(v){localStorage.setItem('wolfEduPlanClass',v);plan()}
function addLesson(){let day=$('#pDay').value,time=$('#pTime').value,subject=$('#pSubject').value.trim(),room=$('#pRoom').value.trim();if(!time||!subject)return toast('Uzupełnij godzinę i przedmiot');db.lessons.push({id:id(),day,time,subject,room});save();plan()}function delLesson(i){db.lessons=db.lessons.filter(l=>l.id!==i);save();plan()}

function openMobileLessonEditor(id,classId,day,lesson){
  if(!canManageSchool())return;
  const existing=(wolfSchool.timetable||[]).find(x=>x.id===id);
  const selectedClass=classId||localStorage.getItem('wolfEduPlanClass')||wolfSchool.classes?.[0]?.id||'';
  app.innerHTML=`<div class="card"><div class="row between"><h2>${existing?'Edytuj lekcję':'Dodaj lekcję'}</h2><button class="secondary mini" onclick="plan()">Wróć</button></div>
    <select id="mlClass">${(wolfSchool.classes||[]).map(c=>`<option value="${esc(c.id)}" ${c.id===selectedClass?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
    <div class="grid"><select id="mlDay">${days.map((d,i)=>`<option value="${i+1}" ${Number(existing?.day||day)===i+1?'selected':''}>${d}</option>`).join('')}</select><input id="mlLesson" type="number" min="1" max="20" value="${esc(existing?.lesson||lesson||1)}"></div>
    <select id="mlSubject"><option value="">Przedmiot</option>${(wolfSchool.subjects||[]).map(s=>`<option value="${esc(s.id)}" ${s.id===existing?.subjectId?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
    <select id="mlTeacher"><option value="">Nauczyciel (opcjonalnie)</option>${(wolfSchool.teachers||[]).map(t=>`<option value="${esc(t.id)}" ${t.id===existing?.teacherId?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
    <input id="mlRoom" placeholder="Sala" value="${esc(existing?.room||'')}">
    <div class="grid"><input id="mlStart" type="time" value="${esc(existing?.start||'')}"><input id="mlEnd" type="time" value="${esc(existing?.end||'')}"></div>
    <button style="width:100%" onclick="saveMobileCloudLesson('${esc(id||'')}')">Zapisz</button>
    ${existing?`<button class="danger" style="width:100%;margin-top:8px" onclick="deleteMobileCloudLesson('${esc(id)}')">Usuń lekcję</button>`:''}
  </div>`;
}
function saveMobileCloudLesson(id){
  const classId=$('#mlClass').value, subjectId=$('#mlSubject').value;
  if(!classId||!subjectId)return toast('Wybierz klasę i przedmiot');
  WolfSync.saveCloudLesson(id,classId,Number($('#mlDay').value),Number($('#mlLesson').value),subjectId,$('#mlTeacher').value,$('#mlRoom').value.trim(),$('#mlStart').value,$('#mlEnd').value);
  toast('Zapisuję lekcję…');setTimeout(plan,500);
}
function deleteMobileCloudLesson(id){if(confirm('Usunąć tę lekcję?')){WolfSync.deleteCloudLesson(id);setTimeout(plan,500)}}
