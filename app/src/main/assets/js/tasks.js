function taskDateLabel(d){if(!d)return 'Brak terminu';let date=new Date(d+'T12:00:00'),today=new Date();today.setHours(0,0,0,0);let tomorrow=new Date(today);tomorrow.setDate(today.getDate()+1);if(date.getTime()===today.getTime())return 'Dzisiaj';if(date.getTime()===tomorrow.getTime())return 'Jutro';return date.toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'})}
function tasks(){
  if(!wolfSchool.activeSchoolId){
    setHead('Zadania',db.school);
    app.innerHTML=`<div class="card warn"><b>Tryb legacy</b><br>Brak aktywnej szkoły WolfCloud.</div><div class="card">${db.tasks.map(t=>`<div class="item">${esc(t.title)}</div>`).join('')||'<div class="empty">Brak zadań</div>'}</div>`;
    return;
  }
  setHead('Zadania',wolfSchool.schoolName);
  let classes=wolfSchool.classes||[],students=wolfSchool.students||[],subjects=wolfSchool.subjects||[],teachers=wolfSchool.teachers||[],list=wolfSchool.tasks||[],can=canManageSchool();
  app.innerHTML=`${can?`<div class="card"><h2>Dodaj zadanie</h2><input id="ctTitle" placeholder="Tytuł">
  <select id="ctClass"><option value="">Klasa (opcjonalnie)</option>${classes.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>
  <select id="ctStudent"><option value="">Uczeń (opcjonalnie)</option>${students.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>
  <select id="ctSubject"><option value="">Przedmiot</option>${subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>
  <select id="ctTeacher"><option value="">Nauczyciel (opcjonalnie)</option>${teachers.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select>
  <select id="ctType"><option>Zadanie domowe</option><option>Sprawdzian</option><option>Kartkówka</option><option>Projekt</option></select>
  <input id="ctDue" type="date"><input id="ctNote" placeholder="Notatka">
  <button style="width:100%" onclick="addCloudTask(this)">Dodaj zadanie</button></div>`:`<div class="card"><small>Dodawanie zadań wymaga roli administratora, dyrektora lub właściciela.</small></div>`}
  <div class="card"><h2>Zadania realtime</h2>${list.slice().reverse().map(t=>`<div class="item row between"><div><b>${esc(t.title||'Zadanie')}</b><br><small>${esc(subjects.find(s=>s.id===t.subjectId)?.name||'')} · ${esc(t.due||'')}</small></div><button class="secondary mini" onclick="WolfSync.setTaskDone('${t.id}',${!t.done})">${t.done?'Przywróć':'Gotowe'}</button></div>`).join('')||'<div class="empty">Brak zadań</div>'}</div>`;
}
function addCloudTask(btn){
  let title=$('#ctTitle').value.trim(),subject=$('#ctSubject').value;
  if(!title||!subject)return toast('Wpisz tytuł i wybierz przedmiot');
  btn.disabled=true;btn.textContent='Dodaję…';
  WolfSync.addTask($('#ctClass').value,$('#ctStudent').value,subject,$('#ctTeacher').value,title,$('#ctType').value,$('#ctNote').value.trim(),$('#ctDue').value);
}
function saveTask(){let title=$('#tTitle').value.trim(),subject=$('#tSubject').value.trim(),due=$('#tDue').value,type=$('#tType').value,priority=$('#tPriority').value,note=$('#tNote').value.trim();if(!title||!due)return toast('Wpisz nazwę i termin');if(editingTaskId){let t=db.tasks.find(x=>x.id===editingTaskId);if(t)Object.assign(t,{title,subject,due,type,priority,note});editingTaskId=null;toast('Termin zmieniony')}else{db.tasks.push({id:id(),title,subject,due,type,priority,note,done:false,created:new Date().toISOString()});toast('Termin dodany')}save();tasks()}
function editTask(i){editingTaskId=i;tasks();window.scrollTo(0,0)}function cancelTaskEdit(){editingTaskId=null;tasks()}function toggleTask(i){let t=db.tasks.find(x=>x.id===i);if(t){t.done=!t.done;save();tasks();toast(t.done?'Oznaczono jako wykonane':'Przywrócono termin')}}function deleteTask(i){if(!confirm('Usunąć ten termin?'))return;db.tasks=db.tasks.filter(t=>t.id!==i);if(editingTaskId===i)editingTaskId=null;save();tasks()}function setTaskFilter(v){sessionStorage.setItem('taskFilter',v);tasks()}
