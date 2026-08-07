function grades(){
  if(!wolfSchool.activeSchoolId){
    setHead('Oceny',db.school);
    app.innerHTML=`<div class="card warn"><b>Tryb legacy</b><br>Brak aktywnej szkoły WolfCloud.</div><div class="card"><h2>Oceny lokalne</h2>${db.grades.map(g=>`<div class="item"><b>${esc(g.subject||'Przedmiot')}</b> · ${esc(g.value)} (waga ${esc(g.weight||1)})</div>`).join('')||'<div class="empty">Brak ocen</div>'}</div>`;
    return;
  }
  setHead('Oceny',wolfSchool.schoolName);
  let students=wolfSchool.students||[],subjects=wolfSchool.subjects||[],teachers=wolfSchool.teachers||[],list=wolfSchool.grades||[],can=canManageSchool();
  app.innerHTML=`${can?`<div class="card"><h2>Dodaj ocenę</h2>
  <select id="cgStudent"><option value="">Uczeń</option>${students.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>
  <select id="cgSubject"><option value="">Przedmiot</option>${subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>
  <select id="cgTeacher"><option value="">Nauczyciel (opcjonalnie)</option>${teachers.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select>
  <div class="grid"><select id="cgValue">${[1,2,3,4,5,6].map(v=>`<option>${v}</option>`).join('')}</select><select id="cgWeight">${[1,2,3,4,5,6].map(v=>`<option value="${v}">Waga ${v}</option>`).join('')}</select></div>
  <input id="cgCategory" placeholder="Kategoria, np. sprawdzian"><input id="cgComment" placeholder="Komentarz">
  <input id="cgDate" type="date" value="${new Date().toISOString().slice(0,10)}">
  <button style="width:100%" onclick="addCloudGrade(this)">Dodaj ocenę</button></div>`:`<div class="card"><small>Dodawanie ocen wymaga roli administratora, dyrektora lub właściciela.</small></div>`}
  <div class="card"><h2>Oceny realtime</h2>${list.slice().reverse().map(g=>`<div class="item row between"><div><b>${esc(subjects.find(s=>s.id===g.subjectId)?.name||'Przedmiot')}</b><br><small>${esc(students.find(s=>s.id===g.studentId)?.name||'Uczeń')} · ${esc(g.category||'Ocena')}</small></div><div class="row"><span class="badge">${esc(g.value)} · waga ${esc(g.weight||1)}</span>${can?`<button class="danger mini" onclick="WolfSync.deleteGrade(\'${g.id}\')">×</button>`:'' }</div></div>`).join('')||'<div class="empty">Brak ocen</div>'}</div>`;
}
function addCloudGrade(btn){
  let student=$('#cgStudent').value,subject=$('#cgSubject').value;
  if(!student||!subject)return toast('Wybierz ucznia i przedmiot');
  btn.disabled=true;btn.textContent='Dodaję…';
  WolfSync.addGrade(student,subject,$('#cgTeacher').value,Number($('#cgValue').value),Number($('#cgWeight').value),$('#cgCategory').value.trim(),$('#cgComment').value.trim(),$('#cgDate').value);
}
function saveGrade(){let studentId=$('#gStudent').value,subject=$('#gSubject').value.trim(),value=$('#gValue').value,weight=Number($('#gWeight').value),note=$('#gNote').value.trim();if(!studentId||!subject)return toast('Wybierz ucznia i przedmiot');if(editingGradeId){let g=db.grades.find(x=>x.id===editingGradeId);if(g)Object.assign(g,{studentId,subject,value,weight,note});editingGradeId=null;toast('Ocena zmieniona')}else{db.grades.push({id:id(),studentId,subject,value,weight,note,date:new Date().toISOString()});toast('Ocena dodana')}save();grades()}
function editGrade(i){editingGradeId=i;grades();window.scrollTo(0,0)}function cancelGradeEdit(){editingGradeId=null;grades()}function delGrade(i){if(!confirm('Usunąć tę ocenę?'))return;db.grades=db.grades.filter(g=>g.id!==i);if(editingGradeId===i)editingGradeId=null;save();grades()}
function setGradeFilter(){sessionStorage.setItem('gradeStudent',$('#gradeFilterStudent').value);sessionStorage.setItem('gradeSubject',$('#gradeFilterSubject').value);grades()}
function calculateNeededGrade(){let sid=$('#calcStudent').value,subject=$('#calcSubject').value,target=Number($('#calcTarget').value),newWeight=Number($('#calcWeight').value),out=$('#calcOutput');if(!sid||!subject||!target)return toast('Uzupełnij ucznia, przedmiot i średnią');let list=db.grades.filter(g=>g.studentId===sid&&g.subject===subject),sum=list.reduce((a,g)=>a+Number(g.value)*Number(g.weight||1),0),weights=list.reduce((a,g)=>a+Number(g.weight||1),0),current=weights?sum/weights:0,needed=(target*(weights+newWeight)-sum)/newWeight;let text;if(needed<=1)text=`Wystarczy ocena <b>1</b> lub wyższa.`;else if(needed>6)text=`Jedna ocena z wagą ${newWeight} nie wystarczy — potrzeba matematycznie <b>${needed.toFixed(2)}</b>.`;else text=`Potrzebujesz co najmniej <b>${Math.ceil(needed)}</b> <small>(dokładnie ${needed.toFixed(2)})</small>.`;out.innerHTML=`<div class="calc-result"><small>Obecna średnia: ${current?current.toFixed(2):'brak ocen'}</small>${text}</div>`}
let editingTaskId=null;
