function attendance(){
  if(!wolfSchool.activeSchoolId){
    setHead('Frekwencja',db.school);
    app.innerHTML=`<div class="card warn"><b>Tryb legacy</b><br>Brak aktywnej szkoły WolfCloud.</div><div class="card">${db.attendance.map(a=>`<div class="item">${esc(a.state)}</div>`).join('')||'<div class="empty">Brak wpisów</div>'}</div>`;
    return;
  }
  setHead('Frekwencja',wolfSchool.schoolName);
  let classes=wolfSchool.classes||[],students=wolfSchool.students||[],subjects=wolfSchool.subjects||[],teachers=wolfSchool.teachers||[],list=wolfSchool.attendance||[];
  app.innerHTML=`<div class="card"><h2>Dodaj wpis</h2>
  <select id="caStudent"><option value="">Uczeń</option>${students.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>
  <select id="caClass"><option value="">Klasa</option>${classes.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>
  <select id="caSubject"><option value="">Przedmiot</option>${subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>
  <select id="caTeacher"><option value="">Nauczyciel (opcjonalnie)</option>${teachers.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select>
  <input id="caDate" type="date" value="${new Date().toISOString().slice(0,10)}">
  <div class="grid"><select id="caState"><option>Obecny</option><option>Nieobecny</option><option>Spóźniony</option><option>Zwolniony</option><option>Usprawiedliwiony</option></select><input id="caLesson" type="number" min="1" value="1"></div>
  <button style="width:100%" onclick="addCloudAttendance(this)">Dodaj wpis</button></div>
  <div class="card"><h2>Frekwencja realtime</h2>${list.slice().reverse().map(a=>`<div class="item row between"><div><b>${esc(students.find(s=>s.id===a.studentId)?.name||'Uczeń')}</b><br><small>${esc(a.date||'')} · lekcja ${esc(a.lesson||'')}</small></div><span class="badge">${esc(a.state||'')}</span></div>`).join('')||'<div class="empty">Brak wpisów</div>'}</div>`;
}
function addCloudAttendance(btn){
  let student=$('#caStudent').value,klass=$('#caClass').value;
  if(!student||!klass)return toast('Wybierz ucznia i klasę');
  btn.disabled=true;btn.textContent='Dodaję…';
  WolfSync.addAttendance(student,klass,$('#caSubject').value,$('#caTeacher').value,$('#caDate').value,$('#caState').value,Number($('#caLesson').value||1));
}
function addAttendance(){let studentId=$('#aStudent').value,date=$('#aDate').value,state=$('#aState').value;if(!studentId)return toast('Wybierz ucznia');db.attendance.push({id:id(),studentId,date,state});save();attendance();toast('Frekwencja zapisana')}function delAttendance(i){db.attendance=db.attendance.filter(a=>a.id!==i);save();attendance()}
