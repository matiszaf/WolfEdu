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

function cloudAttendanceForm(classes,students,subjects,teachers){
  return `<details class="attendance-add-card">
    <summary>
      <div>
        <span class="attendance-add-icon">＋</span>
        <div>
          <b>Dodaj wpis</b>
          <small>Nowa obecność w WolfCloud</small>
        </div>
      </div>
      <span>Rozwiń</span>
    </summary>

    <div class="attendance-add-body">
      <select id="caStudent">
        <option value="">Uczeń</option>
        ${students.map(s=>`
          <option value="${esc(s.id)}">${esc(s.name||'Uczeń')}</option>
        `).join('')}
      </select>

      <select id="caClass">
        <option value="">Klasa</option>
        ${classes.map(c=>`
          <option value="${esc(c.id)}">${esc(c.name||'Klasa')}</option>
        `).join('')}
      </select>

      <select id="caSubject">
        <option value="">Przedmiot (opcjonalnie)</option>
        ${subjects.map(s=>`
          <option value="${esc(s.id)}">${esc(s.name||'Przedmiot')}</option>
        `).join('')}
      </select>

      <select id="caTeacher">
        <option value="">Nauczyciel (opcjonalnie)</option>
        ${teachers.map(t=>`
          <option value="${esc(t.id)}">${esc(t.name||'Nauczyciel')}</option>
        `).join('')}
      </select>

      <div class="attendance-form-grid">
        <input id="caDate" type="date"
          value="${new Date().toISOString().slice(0,10)}">

        <input id="caLesson" type="number"
          min="1" max="20" value="1"
          placeholder="Lekcja">
      </div>

      <select id="caState">
        <option>Obecny</option>
        <option>Nieobecny</option>
        <option>Spóźniony</option>
        <option>Usprawiedliwiony</option>
        <option>Zwolniony</option>
      </select>

      <button class="btn-full" onclick="addCloudAttendance(this)">
        Dodaj wpis
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
  const can=canManageSchool();
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
  const student=$('#caStudent')?.value||'';
  const klass=$('#caClass')?.value||'';

  if(!student||!klass){
    return toast('Wybierz ucznia i klasę');
  }

  btn.disabled=true;
  btn.textContent='Dodaję…';

  WolfSync.addAttendance(
    student,
    klass,
    $('#caSubject')?.value||'',
    $('#caTeacher')?.value||'',
    $('#caDate')?.value||'',
    $('#caState')?.value||'Obecny',
    Number($('#caLesson')?.value||1)
  );
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
