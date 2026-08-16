let wolfGradeDetailsId=null;

function gradeNum(v){
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}

function gradeWeight(g){
  const n=Number(g?.weight||1);
  return Number.isFinite(n)&&n>0?n:1;
}

function gradeAverage(list){
  const valid=(list||[]).filter(g=>gradeNum(g.value)!==null);
  const weightSum=valid.reduce((s,g)=>s+gradeWeight(g),0);
  if(!weightSum)return null;
  return valid.reduce((s,g)=>s+gradeNum(g.value)*gradeWeight(g),0)/weightSum;
}

function gradeFormatAverage(v){
  return v==null?'—':Number(v).toFixed(2);
}

function gradeDateLabel(value){
  if(!value)return 'Brak daty';
  try{
    const raw=String(value).slice(0,10);
    const d=new Date(raw+'T12:00:00');
    return d.toLocaleDateString('pl-PL',{day:'numeric',month:'short',year:'numeric'});
  }catch(e){
    return String(value);
  }
}

function gradeSubjectName(g,subjects){
  if(g.subjectId){
    return subjects.find(s=>s.id===g.subjectId)?.name||g.subject||'Przedmiot';
  }
  return g.subject||'Przedmiot';
}

function gradeStudentName(g,students){
  if(g.studentId){
    const s=students.find(x=>x.id===g.studentId);
    return s?.name||
      [s?.firstName,s?.lastName].filter(Boolean).join(' ')||
      'Uczeń';
  }
  return 'Uczeń';
}

function gradeTeacherName(g,teachers){
  if(!g.teacherId)return '';
  return teachers.find(t=>t.id===g.teacherId)?.name||'';
}

function gradeTone(value){
  const n=gradeNum(value);
  if(n==null)return 'neutral';
  if(n>=5)return 'excellent';
  if(n>=4)return 'good';
  if(n>=3)return 'ok';
  if(n>=2)return 'warn';
  return 'bad';
}

function gradeSubjectStats(list,subjects){
  const map=new Map();

  (list||[]).forEach(g=>{
    const key=g.subjectId||g.subject||'__unknown';
    if(!map.has(key)){
      map.set(key,{
        id:key,
        name:gradeSubjectName(g,subjects),
        list:[]
      });
    }
    map.get(key).list.push(g);
  });

  return [...map.values()]
    .map(x=>({
      ...x,
      avg:gradeAverage(x.list),
      count:x.list.length
    }))
    .sort((a,b)=>{
      if(a.avg==null&&b.avg==null)return a.name.localeCompare(b.name,'pl');
      if(a.avg==null)return 1;
      if(b.avg==null)return -1;
      return b.avg-a.avg;
    });
}

function gradeFilterState(){
  return {
    student:sessionStorage.getItem('gradeStudent')||'',
    subject:sessionStorage.getItem('gradeSubject')||''
  };
}

function gradeFilteredList(list){
  const f=gradeFilterState();

  return (list||[]).filter(g=>
    (!f.student||g.studentId===f.student) &&
    (!f.subject||(g.subjectId||g.subject)===f.subject)
  );
}

function setGradeFilter(){
  const student=$('#gradeFilterStudent');
  const subject=$('#gradeFilterSubject');

  sessionStorage.setItem('gradeStudent',student?.value||'');
  sessionStorage.setItem('gradeSubject',subject?.value||'');

  grades();
}

function clearGradeFilters(){
  sessionStorage.removeItem('gradeStudent');
  sessionStorage.removeItem('gradeSubject');
  grades();
}

function toggleGradeDetails(id){
  wolfGradeDetailsId=wolfGradeDetailsId===id?null:id;
  grades();
}

function gradeDetailHtml(g,subjects,students,teachers,can,cloud){
  if(wolfGradeDetailsId!==g.id)return '';

  const teacher=gradeTeacherName(g,teachers);
  const rows=[
    ['Uczeń',gradeStudentName(g,students)],
    ['Przedmiot',gradeSubjectName(g,subjects)],
    ['Ocena',String(g.value??'—')],
    ['Waga',String(gradeWeight(g))],
    ['Kategoria',g.category||'—'],
    ['Data',gradeDateLabel(g.date||g.createdAt)],
    ['Nauczyciel',teacher||'—'],
    ['Komentarz',g.comment||g.note||'—']
  ];

  return `<div class="grades-detail">
    ${rows.map(([k,v])=>`
      <div>
        <small>${esc(k)}</small>
        <b>${esc(v)}</b>
      </div>`).join('')}
    ${can?`
      <div class="grades-detail-actions">
        ${cloud
          ? `<button class="danger secondary" onclick="event.stopPropagation();deleteCloudGradeConfirm('${esc(g.id)}')">Usuń ocenę</button>`
          : `<button class="secondary" onclick="event.stopPropagation();editGrade('${esc(g.id)}')">Edytuj</button>
             <button class="danger secondary" onclick="event.stopPropagation();delGrade('${esc(g.id)}')">Usuń</button>`
        }
      </div>`:''}
  </div>`;
}

function deleteCloudGradeConfirm(id){
  if(!id||!confirm('Usunąć tę ocenę?'))return;
  WolfSync.deleteGrade(id);
  wolfGradeDetailsId=null;
}

function gradesStatsHtml(list,subjects){
  const avg=gradeAverage(list);
  const weighted=(list||[]).reduce((s,g)=>s+gradeWeight(g),0);
  const subjectCount=new Set((list||[]).map(g=>g.subjectId||g.subject).filter(Boolean)).size;

  return `<section class="grades-metrics">
    <div class="grades-metric primary">
      <small>Średnia ważona</small>
      <b>${gradeFormatAverage(avg)}</b>
    </div>
    <div class="grades-metric">
      <small>Liczba ocen</small>
      <b>${list.length}</b>
    </div>
    <div class="grades-metric">
      <small>Łączna waga</small>
      <b>${weighted}</b>
    </div>
    <div class="grades-metric">
      <small>Przedmioty</small>
      <b>${subjectCount}</b>
    </div>
  </section>`;
}

function gradesFiltersHtml(students,subjects,cloud){
  const f=gradeFilterState();

  const studentOptions=students.map(s=>`
    <option value="${esc(s.id)}" ${s.id===f.student?'selected':''}>
      ${esc(s.name||[s.firstName,s.lastName].filter(Boolean).join(' ')||'Uczeń')}
    </option>`).join('');

  let subjectOptions='';
  if(cloud){
    subjectOptions=subjects.map(s=>`
      <option value="${esc(s.id)}" ${s.id===f.subject?'selected':''}>
        ${esc(s.name||'Przedmiot')}
      </option>`).join('');
  }else{
    const names=[...new Set((db.grades||[]).map(g=>g.subject).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pl'));
    subjectOptions=names.map(name=>`
      <option value="${esc(name)}" ${name===f.subject?'selected':''}>
        ${esc(name)}
      </option>`).join('');
  }

  const active=!!(f.student||f.subject);

  return `<section class="grades-filter-card">
    <div class="grades-filter-head">
      <div>
        <h3>Filtry</h3>
        <small>Wybierz ucznia lub przedmiot</small>
      </div>
      ${active?`<button class="linkbtn" onclick="clearGradeFilters()">Wyczyść</button>`:''}
    </div>

    <div class="grades-filter-grid">
      <select id="gradeFilterStudent" onchange="setGradeFilter()">
        <option value="">Wszyscy uczniowie</option>
        ${studentOptions}
      </select>

      <select id="gradeFilterSubject" onchange="setGradeFilter()">
        <option value="">Wszystkie przedmioty</option>
        ${subjectOptions}
      </select>
    </div>
  </section>`;
}

function gradesSubjectsHtml(list,subjects){
  const stats=gradeSubjectStats(list,subjects);
  if(!stats.length)return '';

  return `<section>
    <div class="section-title">
      <h2>Średnie przedmiotowe</h2>
    </div>

    <div class="grades-subject-grid">
      ${stats.map(s=>`
        <button class="grades-subject-card"
          onclick="sessionStorage.setItem('gradeSubject','${esc(s.id)}');grades()">
          <div>
            <b>${esc(s.name)}</b>
            <small>${s.count} ${s.count===1?'ocena':'ocen'}</small>
          </div>
          <strong>${gradeFormatAverage(s.avg)}</strong>
        </button>`).join('')}
    </div>
  </section>`;
}

function gradesListHtml(list,subjects,students,teachers,can,cloud){
  if(!list.length){
    return `<div class="card grades-empty">
      <span>★</span>
      <b>Brak ocen</b>
      <small>Dla wybranych filtrów nie znaleziono żadnych ocen.</small>
    </div>`;
  }

  const sorted=[...list].sort((a,b)=>
    String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||''))
  );

  return `<div class="card grades-list">
    ${sorted.map(g=>{
      const subject=gradeSubjectName(g,subjects);
      const student=gradeStudentName(g,students);
      const category=g.category||g.note||'Ocena';
      const teacher=gradeTeacherName(g,teachers);

      return `<div class="grades-entry">
        <button class="grades-entry-main" onclick="toggleGradeDetails('${esc(g.id)}')">
          <div class="grades-value ${gradeTone(g.value)}">${esc(g.value??'—')}</div>

          <div class="grades-entry-copy">
            <b>${esc(subject)}</b>
            <small>${esc(student)} · ${esc(category)}</small>
            <span>${esc(gradeDateLabel(g.date||g.createdAt))}${teacher?' · '+esc(teacher):''}</span>
          </div>

          <div class="grades-entry-meta">
            <span>×${esc(gradeWeight(g))}</span>
            <i>${wolfGradeDetailsId===g.id?'⌃':'⌄'}</i>
          </div>
        </button>

        ${gradeDetailHtml(g,subjects,students,teachers,can,cloud)}
      </div>`;
    }).join('')}
  </div>`;
}

function cloudGradeForm(students,subjects,teachers){
  const teacherLocked=String(wolfSchool?.role||'').toLowerCase()==='teacher';
  const ownTeacher=teacherLocked?currentTeacherRecord():null;

  return `<details class="grades-add-card">
    <summary>
      <div>
        <span class="grades-add-icon">＋</span>
        <div>
          <b>Dodaj ocenę</b>
          <small>Nowa ocena w WolfCloud</small>
        </div>
      </div>
      <span>Rozwiń</span>
    </summary>

    <div class="grades-add-body">
      <select id="cgStudent">
        <option value="">Uczeń</option>
        ${students.map(s=>`<option value="${esc(s.id)}">${esc(s.name||'Uczeń')}</option>`).join('')}
      </select>

      <select id="cgSubject">
        <option value="">Przedmiot</option>
        ${subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.name||'Przedmiot')}</option>`).join('')}
      </select>

      ${teacherLocked ? `
        <div class="sync-note">
          <b>Nauczyciel:</b>
          ${esc(ownTeacher?.name||syncEmail||'Niepowiązane konto')}
        </div>
      ` : `<select id="cgTeacher">
        <option value="">Nauczyciel (opcjonalnie)</option>
        ${teachers.map(t=>`<option value="${esc(t.id)}">${esc(t.name||'Nauczyciel')}</option>`).join('')}
      </select>`}

      <div class="grades-form-grid">
        <select id="cgValue">
          ${[1,2,3,4,5,6].map(v=>`<option value="${v}" ${v===5?'selected':''}>Ocena ${v}</option>`).join('')}
        </select>

        <select id="cgWeight">
          ${[1,2,3,4,5,6,7,8,9,10].map(v=>`<option value="${v}">Waga ${v}</option>`).join('')}
        </select>
      </div>

      <input id="cgCategory" placeholder="Kategoria, np. sprawdzian">
      <textarea id="cgComment" placeholder="Komentarz (opcjonalnie)"></textarea>
      <input id="cgDate" type="date" value="${new Date().toISOString().slice(0,10)}">

      <button class="btn-full" onclick="addCloudGrade(this)">Dodaj ocenę</button>
    </div>
  </details>`;
}

function localGradeForm(students){
  const editing=editingGradeId?db.grades.find(g=>g.id===editingGradeId):null;

  return `<details class="grades-add-card" ${editing?'open':''}>
    <summary>
      <div>
        <span class="grades-add-icon">${editing?'✎':'＋'}</span>
        <div>
          <b>${editing?'Edytuj ocenę':'Dodaj ocenę lokalną'}</b>
          <small>Dane zostaną zapisane na tym urządzeniu</small>
        </div>
      </div>
      <span>Rozwiń</span>
    </summary>

    <div class="grades-add-body">
      <select id="gStudent">
        <option value="">Uczeń</option>
        ${students.map(s=>`
          <option value="${esc(s.id)}" ${editing?.studentId===s.id?'selected':''}>
            ${esc(s.name||[s.firstName,s.lastName].filter(Boolean).join(' ')||'Uczeń')}
          </option>`).join('')}
      </select>

      <input id="gSubject" placeholder="Przedmiot" value="${esc(editing?.subject||'')}">

      <div class="grades-form-grid">
        <select id="gValue">
          ${[1,2,3,4,5,6].map(v=>`
            <option value="${v}" ${String(editing?.value||5)===String(v)?'selected':''}>
              Ocena ${v}
            </option>`).join('')}
        </select>

        <select id="gWeight">
          ${[1,2,3,4,5,6,7,8,9,10].map(v=>`
            <option value="${v}" ${Number(editing?.weight||1)===v?'selected':''}>
              Waga ${v}
            </option>`).join('')}
        </select>
      </div>

      <input id="gNote" placeholder="Komentarz / kategoria" value="${esc(editing?.note||'')}">

      <div class="grades-form-actions">
        <button onclick="saveGrade()">${editing?'Zapisz zmiany':'Dodaj ocenę'}</button>
        ${editing?`<button class="secondary" onclick="cancelGradeEdit()">Anuluj</button>`:''}
      </div>
    </div>
  </details>`;
}

function grades(){
  const cloud=!!wolfSchool.activeSchoolId;

  if(!cloud){
    setHead('Oceny',db.school);

    const students=db.students||[];
    const subjects=[];
    const list=db.grades||[];
    const filtered=gradeFilteredList(list);

    app.innerHTML=`
      <section class="grades-page">
        <div class="grades-hero">
          <div>
            <div class="grades-eyebrow">TRYB LOKALNY</div>
            <h2>Oceny</h2>
            <p>Analiza ocen zapisanych na tym urządzeniu.</p>
          </div>
          <span class="grades-cloud-badge offline">offline</span>
        </div>

        ${gradesStatsHtml(filtered,subjects)}
        ${gradesFiltersHtml(students,subjects,false)}
        ${gradesSubjectsHtml(filtered,subjects)}
        ${localGradeForm(students)}

        <div class="section-title">
          <h2>Oceny</h2>
          <small>${filtered.length} wyników</small>
        </div>

        ${gradesListHtml(filtered,subjects,students,[],true,false)}
      </section>`;
    return;
  }

  setHead('Oceny',wolfSchool.schoolName);

  const students=wolfSchool.students||[];
  const subjects=wolfSchool.subjects||[];
  const teachers=wolfSchool.teachers||[];
  const list=wolfSchool.grades||[];
  const can=canTeach();
  const filtered=gradeFilteredList(list);
  const avg=gradeAverage(filtered);

  app.innerHTML=`
    <section class="grades-page">
      <div class="grades-hero">
        <div>
          <div class="grades-eyebrow">${esc(wolfSchool.schoolName||'WOLFCLOUD')}</div>
          <h2>Oceny</h2>
          <p>
            ${filtered.length
              ? `Średnia ważona ${gradeFormatAverage(avg)} · ${filtered.length} ${filtered.length===1?'ocena':'ocen'}`
              : 'Brak ocen dla obecnego filtra.'}
          </p>
        </div>
        <span class="grades-cloud-badge">WolfCloud</span>
      </div>

      ${gradesStatsHtml(filtered,subjects)}
      ${gradesFiltersHtml(students,subjects,true)}
      ${gradesSubjectsHtml(filtered,subjects)}

      ${can
        ? cloudGradeForm(students,subjects,teachers)
        : `<div class="grades-readonly-note">
             <b>Tryb podglądu</b>
             <small>Dodawanie i usuwanie ocen jest dostępne dla nauczycieli i administracji.</small>
           </div>`
      }

      <div class="section-title">
        <h2>Ostatnie oceny</h2>
        <small>${filtered.length} wyników</small>
      </div>

      ${gradesListHtml(filtered,subjects,students,teachers,can,true)}
    </section>`;
}

function addCloudGrade(btn){
  const teacherId=String(wolfSchool?.role||'').toLowerCase()==='teacher'
    ? teachingTeacherId()
    : ($('#cgTeacher')?.value||'');

  if(String(wolfSchool?.role||'').toLowerCase()==='teacher' && !teacherId){
    return toast('Twoje konto nauczyciela nie jest powiązane z listą nauczycieli.');
  }

  const student=$('#cgStudent')?.value||'';
  const subject=$('#cgSubject')?.value||'';

  if(!student||!subject){
    return toast('Wybierz ucznia i przedmiot');
  }

  btn.disabled=true;
  btn.textContent='Dodaję…';

  WolfSync.addGrade(
    student,
    subject,
    teacherId,
    Number($('#cgValue')?.value||0),
    Math.max(1,Math.min(10,Number($('#cgWeight')?.value||1))),
    $('#cgCategory')?.value?.trim()||'',
    $('#cgComment')?.value?.trim()||'',
    $('#cgDate')?.value||''
  );
}

function saveGrade(){
  const studentId=$('#gStudent')?.value||'';
  const subject=$('#gSubject')?.value?.trim()||'';
  const value=$('#gValue')?.value||'';
  const weight=Number($('#gWeight')?.value||1);

  if(!Number.isInteger(weight)||weight<1||weight>10){
    return toast('Waga oceny musi być od 1 do 10');
  }
  const note=$('#gNote')?.value?.trim()||'';

  if(!studentId||!subject){
    return toast('Wybierz ucznia i przedmiot');
  }

  if(editingGradeId){
    const g=db.grades.find(x=>x.id===editingGradeId);
    if(g){
      Object.assign(g,{studentId,subject,value,weight,note});
    }
    editingGradeId=null;
    toast('Ocena zmieniona');
  }else{
    db.grades.push({
      id:id(),
      studentId,
      subject,
      value,
      weight,
      note,
      date:new Date().toISOString()
    });
    toast('Ocena dodana');
  }

  save();
  grades();
}

function editGrade(i){
  editingGradeId=i;
  grades();
  window.scrollTo({top:0,behavior:'smooth'});
}

function cancelGradeEdit(){
  editingGradeId=null;
  grades();
}

function delGrade(i){
  if(!confirm('Usunąć tę ocenę?'))return;
  db.grades=db.grades.filter(g=>g.id!==i);
  if(editingGradeId===i)editingGradeId=null;
  wolfGradeDetailsId=null;
  save();
  grades();
}

function calculateNeededGrade(){
  const sid=$('#calcStudent')?.value||'';
  const subject=$('#calcSubject')?.value||'';
  const target=Number($('#calcTarget')?.value||0);
  const newWeight=Number($('#calcWeight')?.value||1);

  if(!Number.isInteger(newWeight)||newWeight<1||newWeight>10){
    return toast('Waga musi być od 1 do 10');
  }
  const out=$('#calcOutput');

  if(!sid||!subject||!target){
    return toast('Uzupełnij ucznia, przedmiot i średnią');
  }

  const list=(db.grades||[]).filter(g=>g.studentId===sid&&g.subject===subject);
  const sum=list.reduce((a,g)=>a+Number(g.value)*gradeWeight(g),0);
  const weights=list.reduce((a,g)=>a+gradeWeight(g),0);
  const current=weights?sum/weights:0;
  const needed=(target*(weights+newWeight)-sum)/newWeight;

  let text;
  if(needed<=1){
    text='Wystarczy ocena <b>1</b> lub wyższa.';
  }else if(needed>6){
    text=`Jedna ocena z wagą ${newWeight} nie wystarczy — matematycznie potrzeba <b>${needed.toFixed(2)}</b>.`;
  }else{
    text=`Potrzebujesz co najmniej <b>${Math.ceil(needed)}</b> <small>(dokładnie ${needed.toFixed(2)})</small>.`;
  }

  if(out){
    out.innerHTML=`<div class="calc-result">
      <small>Obecna średnia: ${current?current.toFixed(2):'brak ocen'}</small>
      ${text}
    </div>`;
  }
}
