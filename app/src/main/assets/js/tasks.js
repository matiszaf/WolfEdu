let wolfTaskDetailsId=null;

function taskISODate(offset=0){
  const d=new Date();
  d.setHours(12,0,0,0);
  d.setDate(d.getDate()+offset);
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function taskDateLabel(d){
  if(!d)return 'Brak terminu';

  const raw=String(d).slice(0,10);
  if(raw===taskISODate(0))return 'Dzisiaj';
  if(raw===taskISODate(1))return 'Jutro';

  try{
    const date=new Date(raw+'T12:00:00');
    return date.toLocaleDateString('pl-PL',{
      day:'numeric',
      month:'short',
      year:date.getFullYear()!==new Date().getFullYear()?'numeric':undefined
    });
  }catch(e){
    return raw;
  }
}

function taskDueState(t){
  if(t.done)return 'done';
  if(!t.due)return 'later';

  const due=String(t.due).slice(0,10);
  const today=taskISODate(0);
  const tomorrow=taskISODate(1);

  if(due<today)return 'overdue';
  if(due===today)return 'today';
  if(due===tomorrow)return 'tomorrow';
  return 'later';
}

function taskTypeTone(type){
  const v=String(type||'').toLowerCase();

  if(v.includes('sprawdzian'))return 'exam';
  if(v.includes('kartków'))return 'quiz';
  if(v.includes('projekt'))return 'project';
  return 'homework';
}

function taskSubjectName(t,subjects){
  if(t.subjectId){
    return subjects.find(s=>s.id===t.subjectId)?.name||t.subject||'Przedmiot';
  }
  return t.subject||'Przedmiot';
}

function taskStudentName(t,students){
  if(!t.studentId)return '';
  const s=students.find(x=>x.id===t.studentId);

  return s?.name||
    [s?.firstName,s?.lastName].filter(Boolean).join(' ')||
    '';
}

function taskClassName(t,classes){
  if(!t.classId)return '';
  return classes.find(c=>c.id===t.classId)?.name||'';
}

function taskTeacherName(t,teachers){
  if(!t.teacherId)return '';
  return teachers.find(x=>x.id===t.teacherId)?.name||'';
}

function taskFilterState(){
  return {
    status:sessionStorage.getItem('taskStatusFilter')||'active',
    subject:sessionStorage.getItem('taskSubjectFilter')||'',
    student:sessionStorage.getItem('taskStudentFilter')||''
  };
}

function applyTaskFilters(list){
  const f=taskFilterState();

  return (list||[]).filter(t=>{
    if(f.status==='active'&&t.done)return false;
    if(f.status==='done'&&!t.done)return false;
    if(f.status==='today'&&taskDueState(t)!=='today')return false;
    if(f.status==='overdue'&&taskDueState(t)!=='overdue')return false;

    if(f.subject&&(t.subjectId||t.subject)!==f.subject)return false;
    if(f.student&&t.studentId!==f.student)return false;

    return true;
  });
}

function setTaskFilters(){
  sessionStorage.setItem(
    'taskStatusFilter',
    $('#taskFilterStatus')?.value||'active'
  );
  sessionStorage.setItem(
    'taskSubjectFilter',
    $('#taskFilterSubject')?.value||''
  );
  sessionStorage.setItem(
    'taskStudentFilter',
    $('#taskFilterStudent')?.value||''
  );

  tasks();
}

function clearTaskFilters(){
  sessionStorage.removeItem('taskStatusFilter');
  sessionStorage.removeItem('taskSubjectFilter');
  sessionStorage.removeItem('taskStudentFilter');
  tasks();
}

function toggleTaskDetails(id){
  wolfTaskDetailsId=wolfTaskDetailsId===id?null:id;
  tasks();
}

function taskStatsHtml(list){
  const active=list.filter(t=>!t.done);
  const today=active.filter(t=>taskDueState(t)==='today').length;
  const overdue=active.filter(t=>taskDueState(t)==='overdue').length;
  const done=list.filter(t=>t.done).length;

  return `<section class="tasks-metrics">
    <div class="tasks-metric primary">
      <small>Do zrobienia</small>
      <b>${active.length}</b>
    </div>
    <div class="tasks-metric">
      <small>Dzisiaj</small>
      <b>${today}</b>
    </div>
    <div class="tasks-metric ${overdue?'danger':''}">
      <small>Zaległe</small>
      <b>${overdue}</b>
    </div>
    <div class="tasks-metric">
      <small>Wykonane</small>
      <b>${done}</b>
    </div>
  </section>`;
}

function taskFiltersHtml(students,subjects,cloud){
  const f=taskFilterState();

  let subjectOptions='';
  if(cloud){
    subjectOptions=subjects.map(s=>`
      <option value="${esc(s.id)}" ${s.id===f.subject?'selected':''}>
        ${esc(s.name||'Przedmiot')}
      </option>`).join('');
  }else{
    const names=[...new Set(
      (db.tasks||[]).map(t=>t.subject).filter(Boolean)
    )].sort((a,b)=>a.localeCompare(b,'pl'));

    subjectOptions=names.map(name=>`
      <option value="${esc(name)}" ${name===f.subject?'selected':''}>
        ${esc(name)}
      </option>`).join('');
  }

  const studentOptions=(students||[]).map(s=>`
    <option value="${esc(s.id)}" ${s.id===f.student?'selected':''}>
      ${esc(s.name||[s.firstName,s.lastName].filter(Boolean).join(' ')||'Uczeń')}
    </option>`).join('');

  const active=
    f.status!=='active'||
    !!f.subject||
    !!f.student;

  return `<section class="tasks-filter-card">
    <div class="tasks-filter-head">
      <div>
        <h3>Widok zadań</h3>
        <small>Filtruj terminy i odbiorców</small>
      </div>
      ${active
        ? `<button class="linkbtn" onclick="clearTaskFilters()">Wyczyść</button>`
        : ''
      }
    </div>

    <div class="tasks-filter-grid">
      <select id="taskFilterStatus" onchange="setTaskFilters()">
        <option value="active" ${f.status==='active'?'selected':''}>Aktywne</option>
        <option value="today" ${f.status==='today'?'selected':''}>Tylko dzisiaj</option>
        <option value="overdue" ${f.status==='overdue'?'selected':''}>Zaległe</option>
        <option value="done" ${f.status==='done'?'selected':''}>Wykonane</option>
        <option value="all" ${f.status==='all'?'selected':''}>Wszystkie</option>
      </select>

      <select id="taskFilterSubject" onchange="setTaskFilters()">
        <option value="">Wszystkie przedmioty</option>
        ${subjectOptions}
      </select>

      <select id="taskFilterStudent" onchange="setTaskFilters()">
        <option value="">Wszyscy uczniowie</option>
        ${studentOptions}
      </select>
    </div>
  </section>`;
}

function taskDetailHtml(t,classes,students,subjects,teachers,cloud){
  if(wolfTaskDetailsId!==t.id)return '';

  const rows=[
    ['Typ',t.type||'Zadanie domowe'],
    ['Przedmiot',taskSubjectName(t,subjects)],
    ['Termin',taskDateLabel(t.due)],
    ['Klasa',taskClassName(t,classes)||'—'],
    ['Uczeń',taskStudentName(t,students)||'—'],
    ['Nauczyciel',taskTeacherName(t,teachers)||'—'],
    ['Notatka',t.note||'—'],
    ['Status',t.done?'Wykonane':'Do zrobienia']
  ];

  return `<div class="tasks-detail">
    ${rows.map(([k,v])=>`
      <div>
        <small>${esc(k)}</small>
        <b>${esc(v)}</b>
      </div>`).join('')}

    ${!cloud?`
      <div class="tasks-detail-actions">
        <button class="secondary" onclick="event.stopPropagation();editTask('${esc(t.id)}')">
          Edytuj
        </button>
        <button class="danger secondary" onclick="event.stopPropagation();deleteTask('${esc(t.id)}')">
          Usuń
        </button>
      </div>`:''}
  </div>`;
}

function taskActionButton(t,cloud){
  if(cloud){
    return `<button
      class="tasks-done-btn ${t.done?'restore':''}"
      onclick="event.stopPropagation();WolfSync.setTaskDone('${esc(t.id)}',${!t.done})">
      ${t.done?'Przywróć':'Gotowe'}
    </button>`;
  }

  return `<button
    class="tasks-done-btn ${t.done?'restore':''}"
    onclick="event.stopPropagation();toggleTask('${esc(t.id)}')">
    ${t.done?'Przywróć':'Gotowe'}
  </button>`;
}

function taskItemHtml(t,classes,students,subjects,teachers,cloud){
  const state=taskDueState(t);
  const subject=taskSubjectName(t,subjects);
  const student=taskStudentName(t,students);
  const cls=taskClassName(t,classes);
  const secondary=[subject,student||cls].filter(Boolean).join(' · ');

  return `<div class="tasks-entry ${state}">
    <div class="tasks-entry-main" onclick="toggleTaskDetails('${esc(t.id)}')">
      <div class="tasks-type ${taskTypeTone(t.type)}">
        ${esc(
          String(t.type||'Zadanie domowe')
            .charAt(0)
            .toUpperCase()
        )}
      </div>

      <div class="tasks-entry-copy">
        <div class="tasks-entry-top">
          <b>${esc(t.title||'Zadanie')}</b>
          <span class="tasks-date ${state}">${esc(taskDateLabel(t.due))}</span>
        </div>

        <small>${esc(secondary||t.type||'Termin')}</small>

        ${t.note
          ? `<p>${esc(t.note)}</p>`
          : ''
        }
      </div>

      <span class="tasks-chevron">
        ${wolfTaskDetailsId===t.id?'⌃':'⌄'}
      </span>
    </div>

    <div class="tasks-entry-actions">
      <span class="tasks-type-label ${taskTypeTone(t.type)}">
        ${esc(t.type||'Zadanie domowe')}
      </span>
      ${taskActionButton(t,cloud)}
    </div>

    ${taskDetailHtml(t,classes,students,subjects,teachers,cloud)}
  </div>`;
}

function taskSectionHtml(title,list,classes,students,subjects,teachers,cloud,emptyText){
  if(!list.length)return '';

  return `<section class="tasks-group">
    <div class="section-title">
      <h2>${esc(title)}</h2>
      <small>${list.length}</small>
    </div>

    <div class="card tasks-list">
      ${list.map(t=>
        taskItemHtml(t,classes,students,subjects,teachers,cloud)
      ).join('')}
    </div>
  </section>`;
}

function taskGroupedListHtml(list,classes,students,subjects,teachers,cloud){
  if(!list.length){
    return `<div class="card tasks-empty">
      <span>✓</span>
      <b>Brak zadań</b>
      <small>Nie znaleziono terminów pasujących do wybranych filtrów.</small>
    </div>`;
  }

  const sorted=[...list].sort((a,b)=>{
    if(a.done!==b.done)return Number(a.done)-Number(b.done);
    return String(a.due||'9999-99-99')
      .localeCompare(String(b.due||'9999-99-99'));
  });

  const overdue=sorted.filter(t=>taskDueState(t)==='overdue');
  const today=sorted.filter(t=>taskDueState(t)==='today');
  const tomorrow=sorted.filter(t=>taskDueState(t)==='tomorrow');
  const later=sorted.filter(t=>taskDueState(t)==='later');
  const done=sorted.filter(t=>taskDueState(t)==='done');

  return `
    ${taskSectionHtml('Zaległe',overdue,classes,students,subjects,teachers,cloud)}
    ${taskSectionHtml('Dzisiaj',today,classes,students,subjects,teachers,cloud)}
    ${taskSectionHtml('Jutro',tomorrow,classes,students,subjects,teachers,cloud)}
    ${taskSectionHtml('Później',later,classes,students,subjects,teachers,cloud)}
    ${taskSectionHtml('Wykonane',done,classes,students,subjects,teachers,cloud)}
  `;
}

function cloudTaskForm(classes,students,subjects,teachers){
  return `<details class="tasks-add-card">
    <summary>
      <div>
        <span class="tasks-add-icon">＋</span>
        <div>
          <b>Dodaj zadanie</b>
          <small>Nowy termin w WolfCloud</small>
        </div>
      </div>
      <span>Rozwiń</span>
    </summary>

    <div class="tasks-add-body">
      <input id="ctTitle" placeholder="Tytuł zadania">

      <div class="tasks-form-grid">
        <select id="ctClass">
          <option value="">Klasa (opcjonalnie)</option>
          ${classes.map(c=>`
            <option value="${esc(c.id)}">${esc(c.name||'Klasa')}</option>
          `).join('')}
        </select>

        <select id="ctStudent">
          <option value="">Uczeń (opcjonalnie)</option>
          ${students.map(s=>`
            <option value="${esc(s.id)}">${esc(s.name||'Uczeń')}</option>
          `).join('')}
        </select>
      </div>

      <select id="ctSubject">
        <option value="">Przedmiot</option>
        ${subjects.map(s=>`
          <option value="${esc(s.id)}">${esc(s.name||'Przedmiot')}</option>
        `).join('')}
      </select>

      <select id="ctTeacher">
        <option value="">Nauczyciel (opcjonalnie)</option>
        ${teachers.map(t=>`
          <option value="${esc(t.id)}">${esc(t.name||'Nauczyciel')}</option>
        `).join('')}
      </select>

      <div class="tasks-form-grid">
        <select id="ctType">
          <option>Zadanie domowe</option>
          <option>Sprawdzian</option>
          <option>Kartkówka</option>
          <option>Projekt</option>
        </select>

        <input id="ctDue" type="date" value="${taskISODate(1)}">
      </div>

      <textarea id="ctNote" placeholder="Notatka (opcjonalnie)"></textarea>

      <button class="btn-full" onclick="addCloudTask(this)">
        Dodaj zadanie
      </button>
    </div>
  </details>`;
}

function localTaskForm(){
  const editing=editingTaskId
    ? (db.tasks||[]).find(t=>t.id===editingTaskId)
    : null;

  return `<details class="tasks-add-card" ${editing?'open':''}>
    <summary>
      <div>
        <span class="tasks-add-icon">${editing?'✎':'＋'}</span>
        <div>
          <b>${editing?'Edytuj termin':'Dodaj termin lokalny'}</b>
          <small>${editing?'Zmień dane zadania':'Zapisz termin na tym urządzeniu'}</small>
        </div>
      </div>
      <span>Rozwiń</span>
    </summary>

    <div class="tasks-add-body">
      <input id="tTitle" placeholder="Nazwa zadania" value="${esc(editing?.title||'')}">
      <input id="tSubject" placeholder="Przedmiot" value="${esc(editing?.subject||'')}">

      <div class="tasks-form-grid">
        <select id="tType">
          ${['Zadanie domowe','Sprawdzian','Kartkówka','Projekt'].map(v=>`
            <option ${editing?.type===v?'selected':''}>${esc(v)}</option>
          `).join('')}
        </select>

        <select id="tPriority">
          ${['Niski','Normalny','Wysoki'].map(v=>`
            <option ${String(editing?.priority||'Normalny')===v?'selected':''}>
              ${esc(v)}
            </option>
          `).join('')}
        </select>
      </div>

      <input id="tDue" type="date" value="${esc(editing?.due||taskISODate(1))}">
      <textarea id="tNote" placeholder="Notatka">${esc(editing?.note||'')}</textarea>

      <div class="tasks-form-actions">
        <button onclick="saveTask()">
          ${editing?'Zapisz zmiany':'Dodaj termin'}
        </button>

        ${editing
          ? `<button class="secondary" onclick="cancelTaskEdit()">Anuluj</button>`
          : ''
        }
      </div>
    </div>
  </details>`;
}

function tasks(){
  const cloud=!!wolfSchool.activeSchoolId;

  if(!cloud){
    setHead('Zadania',db.school);

    const classes=[];
    const students=db.students||[];
    const subjects=[];
    const teachers=[];
    const all=db.tasks||[];
    const filtered=applyTaskFilters(all);

    app.innerHTML=`
      <section class="tasks-page">
        <div class="tasks-hero">
          <div>
            <div class="tasks-eyebrow">TRYB LOKALNY</div>
            <h2>Zadania i terminy</h2>
            <p>Organizuj sprawdziany, projekty i zadania domowe.</p>
          </div>
          <span class="tasks-cloud-badge offline">offline</span>
        </div>

        ${taskStatsHtml(all)}
        ${taskFiltersHtml(students,subjects,false)}
        ${localTaskForm()}

        ${taskGroupedListHtml(
          filtered,
          classes,
          students,
          subjects,
          teachers,
          false
        )}
      </section>`;
    return;
  }

  setHead('Zadania',wolfSchool.schoolName);

  const classes=wolfSchool.classes||[];
  const students=wolfSchool.students||[];
  const subjects=wolfSchool.subjects||[];
  const teachers=wolfSchool.teachers||[];
  const all=wolfSchool.tasks||[];
  const can=canManageSchool();
  const filtered=applyTaskFilters(all);

  app.innerHTML=`
    <section class="tasks-page">
      <div class="tasks-hero">
        <div>
          <div class="tasks-eyebrow">${esc(wolfSchool.schoolName||'WOLFCLOUD')}</div>
          <h2>Zadania i terminy</h2>
          <p>
            ${all.filter(t=>!t.done).length} aktywnych ·
            ${all.filter(t=>taskDueState(t)==='today').length} na dzisiaj
          </p>
        </div>

        <span class="tasks-cloud-badge">WolfCloud</span>
      </div>

      ${taskStatsHtml(all)}
      ${taskFiltersHtml(students,subjects,true)}

      ${can
        ? cloudTaskForm(classes,students,subjects,teachers)
        : `<div class="tasks-readonly-note">
             <b>Tryb podglądu</b>
             <small>Dodawanie zadań wymaga roli administratora, dyrektora lub właściciela.</small>
           </div>`
      }

      ${taskGroupedListHtml(
        filtered,
        classes,
        students,
        subjects,
        teachers,
        true
      )}
    </section>`;
}

function addCloudTask(btn){
  const title=$('#ctTitle')?.value?.trim()||'';
  const subject=$('#ctSubject')?.value||'';

  if(!title||!subject){
    return toast('Wpisz tytuł i wybierz przedmiot');
  }

  btn.disabled=true;
  btn.textContent='Dodaję…';

  WolfSync.addTask(
    $('#ctClass')?.value||'',
    $('#ctStudent')?.value||'',
    subject,
    $('#ctTeacher')?.value||'',
    title,
    $('#ctType')?.value||'Zadanie domowe',
    $('#ctNote')?.value?.trim()||'',
    $('#ctDue')?.value||''
  );
}

function saveTask(){
  const title=$('#tTitle')?.value?.trim()||'';
  const subject=$('#tSubject')?.value?.trim()||'';
  const due=$('#tDue')?.value||'';
  const type=$('#tType')?.value||'Zadanie domowe';
  const priority=$('#tPriority')?.value||'Normalny';
  const note=$('#tNote')?.value?.trim()||'';

  if(!title||!due){
    return toast('Wpisz nazwę i termin');
  }

  if(editingTaskId){
    const t=db.tasks.find(x=>x.id===editingTaskId);

    if(t){
      Object.assign(t,{
        title,
        subject,
        due,
        type,
        priority,
        note
      });
    }

    editingTaskId=null;
    toast('Termin zmieniony');
  }else{
    db.tasks.push({
      id:id(),
      title,
      subject,
      due,
      type,
      priority,
      note,
      done:false,
      created:new Date().toISOString()
    });

    toast('Termin dodany');
  }

  save();
  tasks();
}

function editTask(i){
  editingTaskId=i;
  tasks();
  window.scrollTo({top:0,behavior:'smooth'});
}

function cancelTaskEdit(){
  editingTaskId=null;
  tasks();
}

function toggleTask(i){
  const t=db.tasks.find(x=>x.id===i);

  if(t){
    t.done=!t.done;
    save();
    tasks();
    toast(t.done?'Oznaczono jako wykonane':'Przywrócono termin');
  }
}

function deleteTask(i){
  if(!confirm('Usunąć ten termin?'))return;

  db.tasks=db.tasks.filter(t=>t.id!==i);

  if(editingTaskId===i){
    editingTaskId=null;
  }

  if(wolfTaskDetailsId===i){
    wolfTaskDetailsId=null;
  }

  save();
  tasks();
}

function setTaskFilter(v){
  sessionStorage.setItem('taskStatusFilter',v);
  tasks();
}
