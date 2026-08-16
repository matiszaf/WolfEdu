let wolfAttendanceDetailsId=null;

function attendanceStateKey(state){
  const s=String(state||'').trim().toLowerCase();
  if(s==='obecny')return 'present';
  if(s==='nieobecny')return 'absent';
  if(s==='spóźniony'||s==='spozniony')return 'late';
  if(s==='usprawiedliwiony')return 'excused';
  if(s==='zwolniony')return 'released';
  return 'other';
}

function attendanceStateLabel(key){
  const labels={
    present:'Obecny',
    absent:'Nieobecny',
    late:'Spóźniony',
    excused:'Usprawiedliwiony',
    released:'Zwolniony',
    other:'Inny'
  };
  return labels[key]||key;
}

function attendanceStudentName(a,students){
  if(!a.studentId)return 'Uczeń';
  const s=(students||[]).find(x=>x.id===a.studentId);
  return s?.name||
    [s?.firstName,s?.lastName].filter(Boolean).join(' ')||
    'Uczeń';
}

function attendanceClassName(a,classes){
  if(!a.classId)return '';
  return (classes||[]).find(c=>c.id===a.classId)?.name||'';
}

function attendanceSubjectName(a,subjects){
  if(!a.subjectId)return a.subject||'';
  return (subjects||[]).find(s=>s.id===a.subjectId)?.name||a.subject||'';
}

function attendanceTeacherName(a,teachers){
  if(!a.teacherId)return '';
  return (teachers||[]).find(t=>t.id===a.teacherId)?.name||'';
}

function attendanceDateRaw(value){
  return String(value||'').slice(0,10);
}

function attendanceDateLabel(value){
  const raw=attendanceDateRaw(value);
  if(!raw)return 'Brak daty';

  const today=new Date();
  const y=today.getFullYear();
  const m=String(today.getMonth()+1).padStart(2,'0');
  const d=String(today.getDate()).padStart(2,'0');
  const todayISO=`${y}-${m}-${d}`;

  if(raw===todayISO)return 'Dzisiaj';

  try{
    const date=new Date(raw+'T12:00:00');
    return date.toLocaleDateString('pl-PL',{
      weekday:'short',
      day:'numeric',
      month:'short'
    });
  }catch(e){
    return raw;
  }
}

function attendanceMonthKey(value){
  const raw=attendanceDateRaw(value);
  return /^\d{4}-\d{2}/.test(raw)?raw.slice(0,7):'';
}

function attendanceCurrentMonth(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function attendanceMonthLabel(key){
  if(!key)return 'Wszystkie miesiące';
  try{
    const [y,m]=key.split('-').map(Number);
    return new Date(y,m-1,1).toLocaleDateString('pl-PL',{
      month:'long',
      year:'numeric'
    });
  }catch(e){
    return key;
  }
}

function attendanceFilterState(){
  return {
    student:sessionStorage.getItem('attendanceStudentFilter')||'',
    state:sessionStorage.getItem('attendanceStateFilter')||'',
    month:sessionStorage.getItem('attendanceMonthFilter')||attendanceCurrentMonth()
  };
}

function setAttendanceFilters(){
  sessionStorage.setItem(
    'attendanceStudentFilter',
    $('#attendanceFilterStudent')?.value||''
  );
  sessionStorage.setItem(
    'attendanceStateFilter',
    $('#attendanceFilterState')?.value||''
  );
  sessionStorage.setItem(
    'attendanceMonthFilter',
    $('#attendanceFilterMonth')?.value||''
  );
  attendance();
}

function clearAttendanceFilters(){
  sessionStorage.removeItem('attendanceStudentFilter');
  sessionStorage.removeItem('attendanceStateFilter');
  sessionStorage.setItem('attendanceMonthFilter',attendanceCurrentMonth());
  attendance();
}

function filterAttendance(list){
  const f=attendanceFilterState();

  return (list||[]).filter(a=>{
    if(f.student&&a.studentId!==f.student)return false;
    if(f.state&&attendanceStateKey(a.state)!==f.state)return false;
    if(f.month&&attendanceMonthKey(a.date)!==f.month)return false;
    return true;
  });
}

function attendanceStats(list){
  const total=(list||[]).length;
  const counts={
    present:0,
    absent:0,
    late:0,
    excused:0,
    released:0,
    other:0
  };

  (list||[]).forEach(a=>{
    const key=attendanceStateKey(a.state);
    counts[key]=(counts[key]||0)+1;
  });

  const counted=counts.present+counts.absent+counts.late;
  const percentage=counted
    ? Math.round(((counts.present+counts.late)*100)/counted)
    : null;

  return {total,counts,percentage};
}

function attendanceStatsHtml(list){
  const s=attendanceStats(list);

  return `<section class="attendance-metrics">
    <div class="attendance-metric primary">
      <small>Frekwencja</small>
      <b>${s.percentage===null?'—':s.percentage+'%'}</b>
    </div>

    <div class="attendance-metric present">
      <small>Obecności</small>
      <b>${s.counts.present}</b>
    </div>

    <div class="attendance-metric absent">
      <small>Nieobecności</small>
      <b>${s.counts.absent}</b>
    </div>

    <div class="attendance-metric late">
      <small>Spóźnienia</small>
      <b>${s.counts.late}</b>
    </div>
  </section>`;
}

function attendanceMonthSummaryHtml(list){
  const s=attendanceStats(list);

  const rows=[
    ['Obecny',s.counts.present,'present'],
    ['Nieobecny',s.counts.absent,'absent'],
    ['Spóźniony',s.counts.late,'late'],
    ['Usprawiedliwiony',s.counts.excused,'excused'],
    ['Zwolniony',s.counts.released,'released']
  ];

  return `<section class="attendance-summary">
    <div class="attendance-summary-head">
      <div>
        <h3>Podsumowanie</h3>
        <small>${esc(attendanceMonthLabel(attendanceFilterState().month))}</small>
      </div>
      <strong>${s.total}</strong>
    </div>

    <div class="attendance-bars">
      ${rows.map(([label,count,key])=>{
        const pct=s.total?Math.round(count/s.total*100):0;
        return `<div class="attendance-bar-row">
          <div class="attendance-bar-label">
            <span>${esc(label)}</span>
            <b>${count}</b>
          </div>
          <div class="attendance-bar-track">
            <span class="${key}" style="width:${pct}%"></span>
          </div>
        </div>`;
      }).join('')}
    </div>
  </section>`;
}

function attendanceFiltersHtml(students,list){
  const f=attendanceFilterState();

  const studentOptions=(students||[]).map(s=>`
    <option value="${esc(s.id)}" ${s.id===f.student?'selected':''}>
      ${esc(s.name||[s.firstName,s.lastName].filter(Boolean).join(' ')||'Uczeń')}
    </option>`).join('');

  const months=[...new Set(
    (list||[])
      .map(a=>attendanceMonthKey(a.date))
      .filter(Boolean)
  )].sort().reverse();

  if(!months.includes(attendanceCurrentMonth())){
    months.unshift(attendanceCurrentMonth());
  }

  return `<section class="attendance-filter-card">
    <div class="attendance-filter-head">
      <div>
        <h3>Filtry</h3>
        <small>Uczeń, status i miesiąc</small>
      </div>
      <button class="linkbtn" onclick="clearAttendanceFilters()">Wyczyść</button>
    </div>

    <div class="attendance-filter-grid">
      <select id="attendanceFilterStudent" onchange="setAttendanceFilters()">
        <option value="">Wszyscy uczniowie</option>
        ${studentOptions}
      </select>

      <select id="attendanceFilterState" onchange="setAttendanceFilters()">
        <option value="">Wszystkie statusy</option>
        ${['present','absent','late','excused','released'].map(key=>`
          <option value="${key}" ${key===f.state?'selected':''}>
            ${attendanceStateLabel(key)}
          </option>`).join('')}
      </select>

      <select id="attendanceFilterMonth" onchange="setAttendanceFilters()">
        <option value="" ${!f.month?'selected':''}>Wszystkie miesiące</option>
        ${months.map(m=>`
          <option value="${m}" ${m===f.month?'selected':''}>
            ${esc(attendanceMonthLabel(m))}
          </option>`).join('')}
      </select>
    </div>
  </section>`;
}

function attendanceDetailHtml(a,classes,students,subjects,teachers,cloud){
  if(wolfAttendanceDetailsId!==a.id)return '';

  const rows=[
    ['Uczeń',attendanceStudentName(a,students)],
    ['Status',a.state||'—'],
    ['Data',attendanceDateLabel(a.date)],
    ['Lekcja',a.lesson?String(a.lesson):'—'],
    ['Klasa',attendanceClassName(a,classes)||'—'],
    ['Przedmiot',attendanceSubjectName(a,subjects)||'—'],
    ['Nauczyciel',attendanceTeacherName(a,teachers)||'—']
  ];

  return `<div class="attendance-detail">
    ${rows.map(([k,v])=>`
      <div>
        <small>${esc(k)}</small>
        <b>${esc(v)}</b>
      </div>`).join('')}

    ${!cloud?`
      <div class="attendance-detail-actions">
        <button class="danger secondary"
          onclick="event.stopPropagation();delAttendance('${esc(a.id)}')">
          Usuń wpis
        </button>
      </div>`:''}
  </div>`;
}

function toggleAttendanceDetails(id){
  wolfAttendanceDetailsId=
    wolfAttendanceDetailsId===id?null:id;
  attendance();
}

function attendanceEntryHtml(a,classes,students,subjects,teachers,cloud){
  const key=attendanceStateKey(a.state);
  const subject=attendanceSubjectName(a,subjects);
  const klass=attendanceClassName(a,classes);
  const secondary=[
    subject,
    a.lesson?'lekcja '+a.lesson:'',
    klass
  ].filter(Boolean).join(' · ');

  return `<div class="attendance-entry">
    <button class="attendance-entry-main"
      onclick="toggleAttendanceDetails('${esc(a.id)}')">

      <div class="attendance-state-dot ${key}">
        ${key==='present'?'✓':
          key==='absent'?'×':
          key==='late'?'◷':
          key==='excused'?'U':
          key==='released'?'Z':'•'}
      </div>

      <div class="attendance-entry-copy">
        <b>${esc(attendanceStudentName(a,students))}</b>
        <small>${esc(secondary||'Frekwencja')}</small>
        <span>${esc(attendanceDateLabel(a.date))}</span>
      </div>

      <div class="attendance-entry-right">
        <span class="attendance-badge ${key}">
          ${esc(a.state||attendanceStateLabel(key))}
        </span>
        <i>${wolfAttendanceDetailsId===a.id?'⌃':'⌄'}</i>
      </div>
    </button>

    ${attendanceDetailHtml(a,classes,students,subjects,teachers,cloud)}
  </div>`;
}

function attendanceGroupedHtml(list,classes,students,subjects,teachers,cloud){
  if(!list.length){
    return `<div class="card attendance-empty">
      <span>◷</span>
      <b>Brak wpisów</b>
      <small>Nie znaleziono frekwencji dla wybranych filtrów.</small>
    </div>`;
  }

  const groups=new Map();

  [...list]
    .sort((a,b)=>{
      const dateCmp=attendanceDateRaw(b.date)
        .localeCompare(attendanceDateRaw(a.date));
      if(dateCmp)return dateCmp;
      return Number(a.lesson||99)-Number(b.lesson||99);
    })
    .forEach(a=>{
      const key=attendanceDateRaw(a.date)||'brak';
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(a);
    });

  return [...groups.entries()].map(([date,items])=>`
    <section class="attendance-day">
      <div class="section-title">
        <h2>${esc(attendanceDateLabel(date))}</h2>
        <small>${items.length}</small>
      </div>

      <div class="card attendance-list">
        ${items.map(a=>
          attendanceEntryHtml(
            a,
            classes,
            students,
            subjects,
            teachers,
            cloud
          )
        ).join('')}
      </div>
    </section>`).join('');
}


function attendanceDateDay(date){
  const d=new Date(String(date||'')+'T12:00:00');
  if(Number.isNaN(d.getTime()))return 0;

  // JS: niedziela 0; plan WolfEdu: poniedziałek 1 ... niedziela 7
  const day=d.getDay();
  return day===0?7:day;
}

function attendanceActualLessonsForDate(date,classes){
  const day=attendanceDateDay(date);
  if(!day)return [];

  const teacherLocked=String(wolfSchool?.role||'').toLowerCase()==='teacher';
  const ownTeacherId=teacherLocked?teachingTeacherId():'';

  const result=[];

  (classes||[]).forEach(klass=>{
    const classId=klass.id;

    const changes=(wolfSchool.lessonChanges||[]).filter(c=>
      c.classId===classId &&
      c.date===date
    );

    const base=(wolfSchool.timetable||[])
      .filter(l=>
        l.classId===classId &&
        Number(l.day)===Number(day) &&
        (
          typeof planLessonAppliesToDate!=='function' ||
          planLessonAppliesToDate(l,date)
        )
      )
      .map(l=>{
        const change=changes.find(c=>
          String(c.type||'').toLowerCase()!=='added' &&
          Number(c.lesson)===Number(l.lesson)
        );

        return typeof planApplyChange==='function'
          ? planApplyChange(l,change)
          : {...l};
      });

    const added=changes
      .filter(c=>String(c.type||'').toLowerCase()==='added')
      .map(c=>typeof planAddedLesson==='function'
        ? planAddedLesson(c,day)
        : {
            id:'change:'+String(c.id||''),
            classId:c.classId||'',
            day,
            lesson:Number(c.lesson||0),
            subjectId:c.subjectId||'',
            teacherId:c.teacherId||'',
            room:c.room||'',
            start:c.start||'',
            end:c.end||'',
            _changeId:c.id||'',
            _changeType:'added',
            _added:true
          });

    [...base,...added]
      .filter(l=>!l._cancelled)
      .filter(l=>!teacherLocked || (ownTeacherId && l.teacherId===ownTeacherId))
      .forEach(l=>result.push({
        ...l,
        _className:klass.name||'Klasa'
      }));
  });

  return result.sort((a,b)=>{
    const aStart=String(a.start||'');
    const bStart=String(b.start||'');

    if(aStart&&bStart&&aStart!==bStart)
      return aStart.localeCompare(bStart);

    const classCmp=String(a._className||'').localeCompare(String(b._className||''));
    if(classCmp!==0)return classCmp;

    return Number(a.lesson||99)-Number(b.lesson||99);
  });
}

function attendanceLessonKey(lesson){
  return [
    lesson.classId||'',
    Number(lesson.lesson||0),
    lesson.subjectId||'',
    lesson.teacherId||''
  ].join('|');
}

function attendanceLessonOptionLabel(l){
  const subject=typeof planSubject==='function'
    ? planSubject(l)
    : ((wolfSchool.subjects||[]).find(s=>s.id===l.subjectId)?.name||'Lekcja');

  const time=l.start
    ? `${l.start}${l.end?'–'+l.end:''}`
    : `lekcja ${l.lesson}`;

  const change=l._changeType==='substitution'
    ? ' · zastępstwo'
    : l._changeType==='added'
      ? ' · dodatkowa'
      : l._changeType==='roomchange'
        ? ' · zmiana sali'
        : '';

  return `${l._className} · ${l.lesson}. ${subject} · ${time}${change}`;
}

function attendanceSelectedLesson(){
  const date=$('#caDate')?.value||'';
  const key=$('#caLessonSession')?.value||'';

  return attendanceActualLessonsForDate(
    date,
    wolfSchool.classes||[]
  ).find(l=>attendanceLessonKey(l)===key)||null;
}

function refreshCloudAttendanceLessons(){
  const date=$('#caDate')?.value||'';
  const select=$('#caLessonSession');
  const body=$('#caLessonStudents');

  if(!select||!body)return;

  const lessons=attendanceActualLessonsForDate(
    date,
    wolfSchool.classes||[]
  );

  select.innerHTML=`
    <option value="">Wybierz lekcję</option>
    ${lessons.map(l=>`
      <option value="${esc(attendanceLessonKey(l))}">
        ${esc(attendanceLessonOptionLabel(l))}
      </option>
    `).join('')}
  `;

  body.innerHTML=lessons.length
    ? '<div class="sync-note">Wybierz lekcję, aby wyświetlić listę uczniów.</div>'
    : '<div class="sync-note">Brak lekcji do sprawdzenia frekwencji w tym dniu.</div>';
}

function refreshCloudAttendanceStudents(){
  const lesson=attendanceSelectedLesson();
  const body=$('#caLessonStudents');

  if(!body)return;

  if(!lesson){
    body.innerHTML='<div class="sync-note">Wybierz lekcję.</div>';
    return;
  }

  const date=$('#caDate')?.value||'';

  const students=(wolfSchool.students||[])
    .filter(s=>s.classId===lesson.classId)
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));

  if(!students.length){
    body.innerHTML='<div class="sync-note">Brak uczniów przypisanych do tej klasy.</div>';
    return;
  }

  const existing=wolfSchool.attendance||[];

  body.innerHTML=`
    <div class="attendance-lesson-selected">
      <b>${esc(attendanceLessonOptionLabel(lesson))}</b>
      ${lesson.room?`<small>Sala ${esc(lesson.room)}</small>`:''}
    </div>

    <div class="attendance-class-list">
      ${students.map(student=>{
        const entry=existing.find(a=>
          a.studentId===student.id &&
          a.classId===lesson.classId &&
          a.date===date &&
          Number(a.lesson)===Number(lesson.lesson)
        );

        const state=entry?.state||'Obecny';

        return `
          <div class="attendance-student-row"
               data-student-id="${esc(student.id)}"
               data-attendance-id="${esc(entry?.id||'')}">

            <b>${esc(student.name||'Uczeń')}</b>

            <select class="caStudentState">
              ${[
                'Obecny',
                'Nieobecny',
                'Spóźniony',
                'Usprawiedliwiony',
                'Zwolniony'
              ].map(v=>`
                <option ${v===state?'selected':''}>${v}</option>
              `).join('')}
            </select>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function cloudAttendanceForm(classes,students,subjects,teachers){
  const today=new Date().toISOString().slice(0,10);

  return `<details class="attendance-add-card" open>
    <summary>
      <div>
        <span class="attendance-add-icon">✓</span>
        <div>
          <b>Sprawdź frekwencję</b>
          <small>Lista uczniów jest pobierana z planu lekcji</small>
        </div>
      </div>
      <span>Rozwiń</span>
    </summary>

    <div class="attendance-add-body">

      <label>Data</label>
      <input
        id="caDate"
        type="date"
        value="${today}"
        onchange="refreshCloudAttendanceLessons()">

      <label>Lekcja</label>
      <select
        id="caLessonSession"
        onchange="refreshCloudAttendanceStudents()">
        <option value="">Wybierz lekcję</option>

        ${attendanceActualLessonsForDate(today,classes).map(l=>`
          <option value="${esc(attendanceLessonKey(l))}">
            ${esc(attendanceLessonOptionLabel(l))}
          </option>
        `).join('')}
      </select>

      <div id="caLessonStudents">
        ${
          attendanceActualLessonsForDate(today,classes).length
            ? '<div class="sync-note">Wybierz lekcję, aby wyświetlić listę uczniów.</div>'
            : '<div class="sync-note">Brak lekcji do sprawdzenia frekwencji w tym dniu.</div>'
        }
      </div>

      <button
        class="btn-full"
        onclick="saveCloudLessonAttendance(this)">
        Zapisz frekwencję
      </button>

    </div>
  </details>`;
}

function localAttendanceForm(students){
  return `<details class="attendance-add-card">
    <summary>
      <div>
        <span class="attendance-add-icon">＋</span>
        <div>
          <b>Dodaj wpis lokalny</b>
          <small>Zapis tylko na tym urządzeniu</small>
        </div>
      </div>
      <span>Rozwiń</span>
    </summary>

    <div class="attendance-add-body">
      <select id="aStudent">
        <option value="">Uczeń</option>
        ${(students||[]).map(s=>`
          <option value="${esc(s.id)}">
            ${esc(s.name||[s.firstName,s.lastName].filter(Boolean).join(' ')||'Uczeń')}
          </option>
        `).join('')}
      </select>

      <div class="attendance-form-grid">
        <input id="aDate" type="date"
          value="${new Date().toISOString().slice(0,10)}">

        <select id="aState">
          <option>Obecny</option>
          <option>Nieobecny</option>
          <option>Spóźniony</option>
          <option>Usprawiedliwiony</option>
          <option>Zwolniony</option>
        </select>
      </div>

      <button class="btn-full" onclick="addAttendance()">
        Dodaj wpis
      </button>
    </div>
  </details>`;
}

function attendance(){
  const cloud=!!wolfSchool.activeSchoolId;

  if(!cloud){
    setHead('Frekwencja',db.school);

    const classes=[];
    const students=db.students||[];
    const subjects=[];
    const teachers=[];
    const all=db.attendance||[];
    const filtered=filterAttendance(all);

    app.innerHTML=`
      <section class="attendance-page">
        <div class="attendance-hero">
          <div>
            <div class="attendance-eyebrow">TRYB LOKALNY</div>
            <h2>Frekwencja</h2>
            <p>Historia obecności zapisanych na tym urządzeniu.</p>
          </div>
          <span class="attendance-cloud-badge offline">offline</span>
        </div>

        ${attendanceStatsHtml(filtered)}
        ${attendanceFiltersHtml(students,all)}
        ${attendanceMonthSummaryHtml(filtered)}
        ${localAttendanceForm(students)}

        ${attendanceGroupedHtml(
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

  setHead('Frekwencja',wolfSchool.schoolName);

  const classes=wolfSchool.classes||[];
  const students=wolfSchool.students||[];
  const subjects=wolfSchool.subjects||[];
  const teachers=wolfSchool.teachers||[];
  const all=wolfSchool.attendance||[];
  const can=canTeach();
  const filtered=filterAttendance(all);

  app.innerHTML=`
    <section class="attendance-page">
      <div class="attendance-hero">
        <div>
          <div class="attendance-eyebrow">
            ${esc(wolfSchool.schoolName||'WOLFCLOUD')}
          </div>
          <h2>Frekwencja</h2>
          <p>
            ${filtered.length
              ? `${filtered.length} wpisów · ${esc(attendanceMonthLabel(attendanceFilterState().month))}`
              : 'Brak wpisów dla obecnego filtra.'}
          </p>
        </div>

        <span class="attendance-cloud-badge">WolfCloud</span>
      </div>

      ${attendanceStatsHtml(filtered)}
      ${attendanceFiltersHtml(students,all)}
      ${attendanceMonthSummaryHtml(filtered)}

      ${can
        ? cloudAttendanceForm(classes,students,subjects,teachers)
        : `<div class="attendance-readonly-note">
             <b>Tryb podglądu</b>
             <small>Dodawanie frekwencji wymaga roli administratora, dyrektora lub właściciela.</small>
           </div>`
      }

      ${attendanceGroupedHtml(
        filtered,
        classes,
        students,
        subjects,
        teachers,
        true
      )}
    </section>`;
}

function addCloudAttendance(btn){
  // Pozostawione jako zgodność ze starszym UI.
  // Nowy formularz korzysta z saveCloudLessonAttendance().
  return saveCloudLessonAttendance(btn);
}


function saveCloudLessonAttendance(btn){
  const lesson=attendanceSelectedLesson();

  if(!lesson)
    return toast('Wybierz lekcję');

  const date=$('#caDate')?.value||'';

  if(!date)
    return toast('Wybierz datę');

  const teacherLocked=String(wolfSchool?.role||'').toLowerCase()==='teacher';

  const teacherId=teacherLocked
    ? teachingTeacherId()
    : (lesson.teacherId||'');

  if(teacherLocked&&!teacherId)
    return toast('Twoje konto nauczyciela nie jest powiązane z listą nauczycieli.');

  const rows=[...document.querySelectorAll('#caLessonStudents .attendance-student-row')];

  if(!rows.length)
    return toast('Brak uczniów do zapisania');

  btn.disabled=true;
  btn.textContent='Zapisuję…';

  rows.forEach(row=>{
    const studentId=row.dataset.studentId||'';
    const attendanceId=row.dataset.attendanceId||'';
    const state=row.querySelector('.caStudentState')?.value||'Obecny';

    if(!studentId)return;

    WolfSync.saveAttendance(
      attendanceId,
      studentId,
      lesson.classId||'',
      lesson.subjectId||'',
      teacherId,
      date,
      state,
      Number(lesson.lesson||1)
    );
  });

  toast(`Zapisuję frekwencję — ${rows.length} uczniów`);
}

function addAttendance(){
  const studentId=$('#aStudent')?.value||'';
  const date=$('#aDate')?.value||'';
  const state=$('#aState')?.value||'Obecny';

  if(!studentId){
    return toast('Wybierz ucznia');
  }

  db.attendance.push({
    id:id(),
    studentId,
    date,
    state
  });

  save();
  attendance();
  toast('Frekwencja zapisana');
}

function delAttendance(i){
  if(!confirm('Usunąć ten wpis frekwencji?'))return;

  db.attendance=db.attendance.filter(a=>a.id!==i);

  if(wolfAttendanceDetailsId===i){
    wolfAttendanceDetailsId=null;
  }

  save();
  attendance();
}
