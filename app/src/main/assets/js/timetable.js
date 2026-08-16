const days=['Poniedziałek','Wtorek','Środa','Czwartek','Piątek'];
let wolfPlanDay=null;

function planDefaultSchoolYear(){
  const now=new Date();
  const y=now.getFullYear();
  const startYear=now.getMonth()>=7?y:y-1;
  return `${startYear}/${startYear+1}`;
}

function planDefaultPeriod(){
  const schoolYear=localStorage.getItem('wolfEduPlanSchoolYear')||planDefaultSchoolYear();
  const parts=schoolYear.match(/^(\d{4})\/(\d{4})$/);

  if(parts){
    return {
      schoolYear,
      validFrom:localStorage.getItem('wolfEduPlanValidFrom')||`${parts[1]}-09-01`,
      validTo:localStorage.getItem('wolfEduPlanValidTo')||`${parts[2]}-06-30`
    };
  }

  return {
    schoolYear,
    validFrom:localStorage.getItem('wolfEduPlanValidFrom')||'',
    validTo:localStorage.getItem('wolfEduPlanValidTo')||''
  };
}

function rememberPlanPeriod(schoolYear,validFrom,validTo){
  localStorage.setItem('wolfEduPlanSchoolYear',schoolYear);
  localStorage.setItem('wolfEduPlanValidFrom',validFrom);
  localStorage.setItem('wolfEduPlanValidTo',validTo);
}

function planReferenceDate(){
  return localStorage.getItem('wolfEduPlanReferenceDate')||planDateKey();
}

function setPlanReferenceDate(value){
  if(!value)return;
  localStorage.setItem('wolfEduPlanReferenceDate',value);
  wolfPlanDay=null;
  plan();
}

function planLessonAppliesToDate(lesson,date=planReferenceDate()){
  const from=String(lesson?.validFrom||'').trim();
  const to=String(lesson?.validTo||'').trim();

  // Stare wpisy planu, utworzone przed wprowadzeniem wersjonowania,
  // pozostają widoczne dla zgodności wstecznej.
  if(!from&&!to)return true;

  if(from && date<from)return false;
  if(to && date>to)return false;

  return true;
}

function planDateForDay(day){
  const reference=planReferenceDate();
  const d=new Date(reference+'T12:00:00');

  if(Number.isNaN(d.getTime()))return reference;

  // JS: niedziela=0, poniedziałek=1 ... sobota=6
  const current=d.getDay();
  const currentMondayIndex=current===0?7:current;
  const diff=Number(day)-currentMondayIndex;

  d.setDate(d.getDate()+diff);

  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');

  return `${y}-${m}-${dd}`;
}

function planChangesFor(classId,date){
  return (wolfSchool.lessonChanges||[]).filter(c=>
    c.classId===classId &&
    c.date===date
  );
}

function planApplyChange(base,change){
  if(!change)return {...base};

  const type=String(change.type||'').toLowerCase();

  const result={
    ...base,
    _changeId:change.id||'',
    _changeType:type,
    _changeNote:change.note||''
  };

  if(type==='cancelled'){
    result._cancelled=true;
    return result;
  }

  if(change.subjectId)result.subjectId=change.subjectId;
  if(change.teacherId)result.teacherId=change.teacherId;
  if(change.room)result.room=change.room;
  if(change.start)result.start=change.start;
  if(change.end)result.end=change.end;

  return result;
}

function planAddedLesson(change,day){
  return {
    id:'change:'+String(change.id||''),
    classId:change.classId||'',
    day:Number(day),
    lesson:Number(change.lesson||0),
    subjectId:change.subjectId||'',
    teacherId:change.teacherId||'',
    room:change.room||'',
    start:change.start||'',
    end:change.end||'',
    _changeId:change.id||'',
    _changeType:'added',
    _changeNote:change.note||'',
    _added:true
  };
}


function planMinutes(v){
  if(!v||!/^\d{1,2}:\d{2}/.test(v))return null;
  const [h,m]=v.slice(0,5).split(':').map(Number);
  return h*60+m;
}
function planToday(){
  const d=new Date().getDay();
  return d>=1&&d<=5?d:null;
}
function planSelectedDay(){
  if(wolfPlanDay!==null)return wolfPlanDay;
  return planToday()||1;
}
function setPlanDay(day){wolfPlanDay=Number(day);plan()}
function planSubject(l){return wolfSchool.subjects.find(x=>x.id===l.subjectId)?.name||'Przedmiot'}
function planTeacher(l){return wolfSchool.teachers.find(x=>x.id===l.teacherId)?.name||''}

function planDateKey(date=new Date()){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function planCurrentTeacher(){
  if(String(wolfSchool?.role||'').toLowerCase()!=='teacher')return null;
  const email=String(syncEmail||'').trim().toLowerCase();
  if(!email)return null;
  return (wolfSchool.teachers||[]).find(t=>
    String(t.email||'').trim().toLowerCase()===email
  )||null;
}

function planLessonSource(lesson){
  if(lesson?._changeId){
    return {
      sourceType:'lessonChange',
      sourceId:String(lesson._changeId),
      timetableId:lesson._added?'':String(lesson.id||'')
    };
  }

  return {
    sourceType:'timetable',
    sourceId:String(lesson?.id||''),
    timetableId:String(lesson?.id||'')
  };
}

function planLessonRecord(lesson,date=planDateKey()){
  const source=planLessonSource(lesson);

  return (wolfSchool.lessonRecords||[]).find(r=>
    r.date===date &&
    (
      (
        r.sourceType===source.sourceType &&
        r.sourceId===source.sourceId
      )
      ||
      (
        !r.sourceType &&
        source.sourceType==='timetable' &&
        r.timetableId===source.timetableId
      )
    )
  )||null;
}

function planActualLessonById(lessonId,classId,day){
  const actual=planClassLessons(classId,Number(day)).find(
    l=>String(l.id)===String(lessonId)
  );

  if(actual)return actual;

  return (wolfSchool.timetable||[]).find(
    l=>String(l.id)===String(lessonId)
  )||null;
}

function canRecordLessonTopic(lesson,day){
  if(Number(day)!==planToday())return false;
  const teacher=planCurrentTeacher();
  return !!teacher && teacher.id===lesson?.teacherId;
}
function planMissingTopicLessons(){
  const teacher=planCurrentTeacher();
  const today=planToday();

  if(!teacher||!today)return [];

  const result=[];

  (wolfSchool.classes||[]).forEach(klass=>{
    planClassLessons(klass.id,today)
      .filter(l=>
        !l._cancelled &&
        l.teacherId===teacher.id &&
        planLessonState(l,today)==='past' &&
        !String(planLessonRecord(l)?.topic||'').trim()
      )
      .forEach(l=>result.push({
        ...l,
        _className:klass.name||'Klasa'
      }));
  });

  return result.sort((a,b)=>{
    const am=planMinutes(a.start);
    const bm=planMinutes(b.start);

    if(am!==null&&bm!==null&&am!==bm)return am-bm;

    const classCmp=String(a._className||'')
      .localeCompare(String(b._className||''));

    if(classCmp!==0)return classCmp;

    return Number(a.lesson||99)-Number(b.lesson||99);
  });
}

function planMissingTopicsHtml(){
  const missing=planMissingTopicLessons();

  if(!missing.length)return '';

  return `<section class="plan-topic-alert">
    <div class="plan-topic-alert-head">
      <div>
        <small>WYMAGANE UZUPEŁNIENIE</small>
        <b>${missing.length===1
          ? '1 lekcja bez tematu'
          : `${missing.length} lekcje bez tematu`}</b>
      </div>
      <span>${missing.length}</span>
    </div>

    <div class="plan-topic-alert-list">
      ${missing.map(l=>`
        <button onclick="openLessonTopicEditor('${esc(l.id)}','${esc(l.classId)}',${Number(l.day)})">
          <div>
            <b>${esc(planSubject(l))}</b>
            <small>
              ${esc(l.start||('Lekcja '+(l.lesson||'')))}
              ${l.room?' · sala '+esc(l.room):''}
            </small>
          </div>
          <strong>Uzupełnij</strong>
        </button>
      `).join('')}
    </div>
  </section>`;
}

function planClassLessons(classId,day){
  const date=planDateForDay(day);
  const changes=planChangesFor(classId,date);

  const base=(wolfSchool.timetable||[])
    .filter(l=>
      l.classId===classId &&
      Number(l.day)===Number(day) &&
      planLessonAppliesToDate(l,date)
    )
    .map(l=>{
      const change=changes.find(c=>
        String(c.type||'').toLowerCase()!=='added' &&
        Number(c.lesson)===Number(l.lesson)
      );

      return planApplyChange(l,change);
    });

  const added=changes
    .filter(c=>String(c.type||'').toLowerCase()==='added')
    .map(c=>planAddedLesson(c,day));

  return [...base,...added]
    .sort((a,b)=>{
      const am=planMinutes(a.start),bm=planMinutes(b.start);
      if(am!==null&&bm!==null&&am!==bm)return am-bm;
      return Number(a.lesson||99)-Number(b.lesson||99);
    });
}
function planLessonState(l,day){
  const today=planToday();
  if(today!==Number(day))return '';
  const now=new Date(),mins=now.getHours()*60+now.getMinutes();
  const start=planMinutes(l.start),end=planMinutes(l.end);
  if(start===null)return '';
  if(end!==null&&mins>=start&&mins<=end)return 'current';
  if(mins<start)return 'future';
  return 'past';
}
function planNextLesson(classId){
  const today=planToday();
  if(!today)return null;
  const now=new Date(),mins=now.getHours()*60+now.getMinutes();
  const list=planClassLessons(classId,today);
  return list.find(l=>{
    const end=planMinutes(l.end),start=planMinutes(l.start);
    return end!==null?end>=mins:(start!==null&&start>=mins);
  })||null;
}
function planHero(classId){
  const today=planToday();
  if(!today){
    return `<section class="plan-hero">
      <div><div class="plan-eyebrow">WEEKEND</div><h2>Dziś bez lekcji</h2>
      <p>Plan na poniedziałek jest gotowy poniżej.</p></div>
      <span class="plan-cloud">WolfCloud</span>
    </section>`;
  }
  const next=planNextLesson(classId);
  if(!next){
    return `<section class="plan-hero">
      <div><div class="plan-eyebrow">${esc(days[today-1].toUpperCase())}</div><h2>Lekcje zakończone</h2>
      <p>Na dziś nie ma już kolejnych zajęć.</p></div>
      <span class="plan-cloud">WolfCloud</span>
    </section>`;
  }
  const state=planLessonState(next,today);
  const title=state==='current'?'Teraz':'Najbliższa lekcja';
  const meta=[
    next.start?(next.start+(next.end?'–'+next.end:'')):'',
    next.room?'sala '+next.room:'',
    planTeacher(next)
  ].filter(Boolean).join(' · ');
  return `<section class="plan-hero active">
    <div><div class="plan-eyebrow">${esc(title.toUpperCase())}</div>
    <h2>${esc(planSubject(next))}</h2><p>${esc(meta||('Lekcja '+(next.lesson||'')))}</p></div>
    <div class="plan-number">${esc(next.lesson||'•')}</div>
  </section>`;
}
function planDayTabs(selected,classId){
  const today=planToday();
  return `<div class="plan-days">${days.map((d,i)=>{
    const n=i+1,count=planClassLessons(classId,n).length;
    return `<button class="${selected===n?'active':''} ${today===n?'today':''}" onclick="setPlanDay(${n})">
      <span>${d.slice(0,3)}</span><small>${count}</small>
    </button>`;
  }).join('')}</div>`;
}
function planLessonCard(l,day,selected){
  const state=planLessonState(l,day);
  const teacher=planTeacher(l);
  const meta=[
    teacher,
    l.room?'sala '+l.room:''
  ].filter(Boolean).join(' · ');

  const today=Number(day)===Number(planToday());
  const record=today?planLessonRecord(l):null;
  const canTopic=!l._cancelled&&canRecordLessonTopic(l,day);

  const click=canTopic
    ? `onclick="openLessonTopicEditor('${esc(l.id)}','${esc(selected)}',${Number(day)})"`
    : canManageSchool()
      ? `onclick="openMobileLessonEditor('${esc(l.id)}','${esc(selected)}',${Number(l.day)},${Number(l.lesson)})"`
      : '';

  const changeBadge=l._cancelled
    ? '<em>ODWOŁANA</em>'
    : l._changeType==='substitution'
      ? '<em>ZASTĘPSTWO</em>'
      : l._changeType==='roomchange'
        ? '<em>ZMIANA SALI</em>'
        : l._changeType==='added'
          ? '<em>DODATKOWA</em>'
          : '';

  const topicHtml=record?.topic
    ? `<div class="plan-topic">
         <small>TEMAT LEKCJI</small>
         <b>${esc(record.topic)}</b>
       </div>`
    : canTopic
      ? `<div class="plan-topic missing">
           <small>TEMAT LEKCJI</small>
           <b>Uzupełnij temat lekcji</b>
         </div>`
      : '';

  return `<div class="plan-lesson ${state}" ${click}>
    <div class="plan-time">
      <b>${esc(l.start||('#'+l.lesson))}</b>
      <small>${esc(l.end||'')}</small>
    </div>

    <div class="plan-line"><span></span></div>

    <div class="plan-copy">
      <div class="plan-title-row">
        <b>${esc(planSubject(l))}</b>
        ${state==='current'&&!l._cancelled?'<em>TERAZ</em>':''}
        ${changeBadge}
      </div>

      <small>${l._cancelled?'Lekcja nie odbędzie się':esc(meta||'Brak sali i nauczyciela')}</small>
      ${l._changeNote?`<small>${esc(l._changeNote)}</small>`:''}
      ${topicHtml}

      ${canManageSchool()&&!l._added?`
        <button
          class="secondary mini plan-change-btn"
          onclick="event.stopPropagation();openLessonChangeEditor('${esc(l.id)}','${esc(selected)}',${Number(day)},${Number(l.lesson)})">
          ${l._changeId?'Edytuj zmianę':'Zmiana na ten dzień'}
        </button>
      `:''}
    </div>

    <div class="plan-lesson-no">${esc(l.lesson||'')}</div>
  </div>`;
}



function openAddedLessonEditor(classId,day){
  if(!canManageSchool())return;

  const date=planDateForDay(day);
  const lessons=planClassLessons(classId,day);

  const suggestedLesson=Math.max(
    1,
    ...lessons.map(l=>Number(l.lesson||0))
  )+1;

  app.innerHTML=`<section class="plan-page">
    <div class="plan-editor">

      <div class="plan-editor-head">
        <div>
          <small>JEDNORAZOWA LEKCJA</small>
          <h2>Dodatkowa lekcja</h2>
        </div>

        <button class="secondary mini" onclick="plan()">Wróć</button>
      </div>

      <div class="card">
        <small>DATA</small>
        <b>${esc(date)}</b>
      </div>

      <label>Numer lekcji</label>
      <input
        id="laLesson"
        type="number"
        min="1"
        max="20"
        value="${suggestedLesson}">

      <label>Przedmiot</label>
      <select id="laSubject">
        <option value="">Wybierz przedmiot</option>
        ${(wolfSchool.subjects||[]).map(subject=>`
          <option value="${esc(subject.id)}">${esc(subject.name)}</option>
        `).join('')}
      </select>

      <label>Nauczyciel</label>
      <select id="laTeacher">
        <option value="">Nauczyciel (opcjonalnie)</option>
        ${(wolfSchool.teachers||[]).map(teacher=>`
          <option value="${esc(teacher.id)}">${esc(teacher.name)}</option>
        `).join('')}
      </select>

      <label>Sala</label>
      <input id="laRoom" placeholder="np. 12">

      <div class="grid">
        <div>
          <label>Od</label>
          <input id="laStart" type="time">
        </div>

        <div>
          <label>Do</label>
          <input id="laEnd" type="time">
        </div>
      </div>

      <label>Notatka</label>
      <textarea
        id="laNote"
        placeholder="np. Dodatkowe zajęcia przygotowujące do egzaminu"></textarea>

      <button
        class="btn-full"
        onclick="saveAddedLessonEditor('${esc(classId)}','${esc(date)}')">
        Dodaj lekcję
      </button>

    </div>
  </section>`;
}

function saveAddedLessonEditor(classId,date){
  if(!canManageSchool())return;

  const lessonNumber=Number($('#laLesson').value);
  const subjectId=$('#laSubject').value;
  const teacherId=$('#laTeacher').value;
  const room=$('#laRoom').value.trim();
  const start=$('#laStart').value;
  const end=$('#laEnd').value;
  const note=$('#laNote').value.trim();

  if(!lessonNumber||lessonNumber<1)
    return toast('Podaj numer lekcji');

  if(!subjectId)
    return toast('Wybierz przedmiot');

  WolfSync.saveLessonChange(
    '',
    date,
    classId,
    lessonNumber,
    'added',
    subjectId,
    teacherId,
    room,
    start,
    end,
    note
  );

  toast('Dodaję dodatkową lekcję…');
  plan();
}

function openLessonChangeEditor(baseId,classId,day,lessonNumber){
  if(!canManageSchool())return;

  const date=planDateForDay(day);

  const actual=planClassLessons(classId,day).find(l=>
    String(l.id)===String(baseId) ||
    Number(l.lesson)===Number(lessonNumber)
  );

  const base=(wolfSchool.timetable||[]).find(l=>String(l.id)===String(baseId))||actual;

  if(!base)return toast('Nie znaleziono lekcji');

  const existing=(wolfSchool.lessonChanges||[]).find(c=>
    String(c.id)===String(actual?._changeId||'')
  );

  const currentType=existing?.type||actual?._changeType||'substitution';

  app.innerHTML=`<section class="plan-page">
    <div class="plan-editor">

      <div class="plan-editor-head">
        <div>
          <small>ZMIANA JEDNORAZOWA</small>
          <h2>${existing?'Edytuj zmianę':'Zmień lekcję'}</h2>
        </div>

        <button
          class="secondary mini"
          onclick="plan()">
          Wróć
        </button>
      </div>

      <div class="card">
        <small>DATA</small>
        <b>${esc(date)}</b>

        <small>LEKCJA</small>
        <b>${esc(base.lesson||lessonNumber)}. ${esc(planSubject(base))}</b>
      </div>

      <label>Rodzaj zmiany</label>
      <select id="lcType" onchange="refreshLessonChangeEditor()">
        <option value="substitution" ${currentType==='substitution'?'selected':''}>Zastępstwo</option>
        <option value="cancelled" ${currentType==='cancelled'?'selected':''}>Odwołanie lekcji</option>
        <option value="roomchange" ${currentType==='roomchange'?'selected':''}>Zmiana sali</option>
      </select>

      <div id="lcDetails">

        <label>Przedmiot</label>
        <select id="lcSubject">
          <option value="">Bez zmiany przedmiotu</option>
          ${(wolfSchool.subjects||[]).map(subject=>`
            <option
              value="${esc(subject.id)}"
              ${subject.id===(existing?.subjectId||'')?'selected':''}>
              ${esc(subject.name)}
            </option>
          `).join('')}
        </select>

        <label>Nauczyciel</label>
        <select id="lcTeacher">
          <option value="">Bez zmiany nauczyciela</option>
          ${(wolfSchool.teachers||[]).map(teacher=>`
            <option
              value="${esc(teacher.id)}"
              ${teacher.id===(existing?.teacherId||'')?'selected':''}>
              ${esc(teacher.name)}
            </option>
          `).join('')}
        </select>

        <label>Sala</label>
        <input
          id="lcRoom"
          placeholder="Bez zmiany"
          value="${esc(existing?.room||'')}">

        <div class="grid">
          <div>
            <label>Od</label>
            <input
              id="lcStart"
              type="time"
              value="${esc(existing?.start||'')}">
          </div>

          <div>
            <label>Do</label>
            <input
              id="lcEnd"
              type="time"
              value="${esc(existing?.end||'')}">
          </div>
        </div>

      </div>

      <label>Notatka</label>
      <textarea
        id="lcNote"
        placeholder="np. Nieobecność nauczyciela">${esc(existing?.note||'')}</textarea>

      <button
        class="btn-full"
        onclick="saveLessonChangeEditor(
          '${esc(existing?.id||'')}',
          '${esc(classId)}',
          '${esc(date)}',
          ${Number(lessonNumber)}
        )">
        Zapisz zmianę
      </button>

      ${existing?`
        <button
          class="danger btn-full"
          onclick="deleteLessonChangeEditor('${esc(existing.id)}')">
          Usuń zmianę
        </button>
      `:''}

    </div>
  </section>`;

  refreshLessonChangeEditor();
}

function refreshLessonChangeEditor(){
  const type=$('#lcType')?.value;
  const details=$('#lcDetails');

  if(!details)return;

  details.style.display=type==='cancelled'?'none':'';
}

function saveLessonChangeEditor(id,classId,date,lessonNumber){
  if(!canManageSchool())return;

  const type=$('#lcType').value;
  const note=$('#lcNote').value.trim();

  let subjectId='';
  let teacherId='';
  let room='';
  let start='';
  let end='';

  if(type!=='cancelled'){
    subjectId=$('#lcSubject').value;
    teacherId=$('#lcTeacher').value;
    room=$('#lcRoom').value.trim();
    start=$('#lcStart').value;
    end=$('#lcEnd').value;
  }

  if(type==='roomchange'&&!room){
    return toast('Podaj nową salę');
  }

  WolfSync.saveLessonChange(
    id,
    date,
    classId,
    Number(lessonNumber),
    type,
    subjectId,
    teacherId,
    room,
    start,
    end,
    note
  );

  toast(type==='cancelled'
    ? 'Odwołuję lekcję…'
    : 'Zapisuję zmianę planu…');

  plan();
}

function deleteLessonChangeEditor(id){
  if(!canManageSchool()||!id)return;

  if(!confirm('Usunąć tę zmianę i przywrócić lekcję z planu bazowego?'))return;

  WolfSync.deleteLessonChange(id);
  toast('Usuwam zmianę…');
  plan();
}

function planWeekOverview(classId){
  return `<details class="plan-week">
    <summary><div><b>Cały tydzień</b><small>Szybki podgląd liczby lekcji</small></div><span>Rozwiń</span></summary>
    <div class="plan-week-grid">${days.map((d,i)=>{
      const list=planClassLessons(classId,i+1);
      return `<button onclick="setPlanDay(${i+1})"><b>${d}</b><small>${list.length} ${list.length===1?'lekcja':'lekcji'}</small>
      <span>${list.slice(0,3).map(planSubject).map(esc).join(' · ')||'Brak zajęć'}</span></button>`;
    }).join('')}</div>
  </details>`;
}
function plan(){
  const schoolName=wolfSchool.schoolName||db.school;
  setHead('Plan lekcji',schoolName);

  if(wolfSchool.activeSchoolId){
    if(!wolfSchool.classes.length){
      app.innerHTML=`<section class="plan-page"><div class="card plan-empty">
        <span>▦</span><b>Plan z WolfCloud</b>
        <small>Konto i szkoła są połączone, ale lista klas jest jeszcze pusta.</small>
        <button class="secondary" onclick="WolfSync.requestSchoolData();toast('Odświeżam dane szkoły…')">Odśwież dane szkoły</button>
      </div></section>`;
      return;
    }

    let selected=localStorage.getItem('wolfEduPlanClass')||wolfSchool.classes[0].id;
    if(!wolfSchool.classes.some(c=>c.id===selected))selected=wolfSchool.classes[0].id;
    localStorage.setItem('wolfEduPlanClass',selected);
    const selectedDay=planSelectedDay();
    const lessons=planClassLessons(selected,selectedDay);
    const classOptions=wolfSchool.classes.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name||'Klasa')}</option>`).join('');

    app.innerHTML=`<section class="plan-page">
      ${planHero(selected)}
      ${planMissingTopicsHtml()}
      <section class="plan-toolbar">
        <div>
          <small>Plan klasy</small>
          <select id="cloudPlanClass" onchange="changeCloudPlanClass(this.value)">${classOptions}</select>
        </div>

        <div>
          <small>Plan na dzień</small>
          <input
            type="date"
            id="cloudPlanReferenceDate"
            value="${esc(planReferenceDate())}"
            onchange="setPlanReferenceDate(this.value)">
        </div>

        <span class="plan-role">${esc(wolfSchool.role||'użytkownik')}</span>
      </section>
      ${planDayTabs(selectedDay,selected)}
      <section class="plan-day-card">
        <div class="plan-day-head"><div><small>${selectedDay===planToday()?'DZISIAJ':'WYBRANY DZIEŃ'}</small>
        <h2>${esc(days[selectedDay-1])}</h2></div><b>${lessons.length} ${lessons.length===1?'lekcja':'lekcji'}</b></div>
        <div class="plan-list">${lessons.map(l=>planLessonCard(l,selectedDay,selected)).join('')||
          `<div class="plan-no-lessons"><span>✓</span><b>Brak lekcji</b><small>W tym dniu nie ma zaplanowanych zajęć.</small></div>`}
        </div>
      </section>
      ${planWeekOverview(selected)}
      ${canManageSchool()?`
        <button class="plan-add" onclick="openMobileLessonEditor('', '${esc(selected)}', ${selectedDay}, ${Math.max(1,lessons.length+1)})">＋ Dodaj do planu tygodniowego</button>
        <button class="plan-add secondary" onclick="openAddedLessonEditor('${esc(selected)}', ${selectedDay})">＋ Dodatkowa lekcja tylko tego dnia</button>
      `:''}
    </section>`;
    return;
  }

  app.innerHTML=`<section class="plan-page">
    <div class="card warn"><b>Plan lokalny</b><br><small>Połącz konto ze szkołą, aby korzystać z planu WolfCloud realtime.</small></div>
    <details class="plan-week" open><summary><div><b>Dodaj lekcję lokalnie</b><small>Plan zapisany na urządzeniu</small></div></summary>
    <div class="plan-local-form"><select id="pDay">${days.map(d=>`<option>${d}</option>`).join('')}</select>
    <div class="grid"><input id="pTime" type="time"><input id="pSubject" placeholder="Przedmiot"></div>
    <input id="pRoom" placeholder="Sala / nauczyciel (opcjonalnie)">
    <button class="btn-full" onclick="addLesson()">Dodaj do planu</button></div></details>
    <div class="card">${days.map(d=>`<div class="day">${d}</div>${db.lessons.filter(l=>l.day===d).sort((a,b)=>a.time.localeCompare(b.time)).map(l=>`<div class="item lesson"><div class="time">${esc(l.time)}</div><div style="flex:1"><b>${esc(l.subject)}</b><br><small>${esc(l.room||'')}</small></div><button class="danger mini" onclick="delLesson('${l.id}')">×</button></div>`).join('')||'<small>Brak lekcji</small>'}`).join('')}</div>
  </section>`;
}
function changeCloudPlanClass(v){localStorage.setItem('wolfEduPlanClass',v);wolfPlanDay=null;plan()}
function addLesson(){let day=$('#pDay').value,time=$('#pTime').value,subject=$('#pSubject').value.trim(),room=$('#pRoom').value.trim();if(!time||!subject)return toast('Uzupełnij godzinę i przedmiot');db.lessons.push({id:id(),day,time,subject,room});save();plan()}
function delLesson(i){db.lessons=db.lessons.filter(l=>l.id!==i);save();plan()}

function openLessonTopicEditor(lessonId,classId,day){
  const lesson=planActualLessonById(
    lessonId,
    classId,
    Number(day)
  );

  if(!lesson){
    toast('Nie znaleziono lekcji.');
    return;
  }

  if(!canRecordLessonTopic(lesson,lesson.day)){
    toast('Możesz uzupełnić temat tylko swojej dzisiejszej lekcji.');
    return;
  }

  const record=planLessonRecord(lesson);

  app.innerHTML=`
    <section class="plan-page">
      <div class="plan-editor">

        <div class="plan-editor-head">
          <div>
            <small>REALIZACJA LEKCJI</small>
            <h2>Temat lekcji</h2>
          </div>

          <button class="secondary mini" onclick="plan()">
            Wróć
          </button>
        </div>

        <div class="sync-note">
          <b>${esc(planSubject(lesson))}</b><br>
          ${esc(planDateKey())}
          · lekcja ${esc(lesson.lesson||'')}
          ${lesson.room?' · sala '+esc(lesson.room):''}
        </div>

        <textarea
          id="lessonTopic"
          maxlength="500"
          placeholder="Wpisz przerabiany temat lekcji..."
        >${esc(record?.topic||'')}</textarea>

        <button
          class="btn-full"
          onclick="saveLessonTopic('${esc(record?.id||'')}','${esc(lesson.id)}','${esc(lesson.classId)}',${Number(lesson.day)})">
          ${record?'Zapisz zmiany':'Zapisz temat lekcji'}
        </button>

        <div class="sync-note">
          Temat jest wymagany dla prowadzącego nauczyciela.
        </div>
      </div>
    </section>`;
}

function saveLessonTopic(recordId,lessonId,classId,day){
  const lesson=planActualLessonById(
    lessonId,
    classId,
    Number(day)
  );

  if(!lesson){
    toast('Nie znaleziono lekcji.');
    return;
  }

  if(!canRecordLessonTopic(lesson,lesson.day)){
    toast('Brak uprawnień do tej lekcji.');
    return;
  }

  const topic=$('#lessonTopic')?.value.trim()||'';

  if(!topic){
    toast('Wpisz temat lekcji.');
    return;
  }

  const source=planLessonSource(lesson);

  WolfSync.saveLessonRecord(
    recordId||'',
    source.sourceType,
    source.sourceId,
    source.timetableId,
    planDateKey(),
    lesson.classId,
    lesson.subjectId,
    lesson.teacherId,
    Number(lesson.lesson||0),
    topic
  );

  toast('Zapisuję temat lekcji…');
}

function openMobileLessonEditor(id,classId,day,lesson){
  if(!canManageSchool())return;
  const existing=(wolfSchool.timetable||[]).find(x=>x.id===id);
  const period=planDefaultPeriod();
  const selectedClass=classId||localStorage.getItem('wolfEduPlanClass')||wolfSchool.classes?.[0]?.id||'';
  app.innerHTML=`<section class="plan-page"><div class="plan-editor">
    <div class="plan-editor-head"><div><small>WOLFCLOUD</small><h2>${existing?'Edytuj lekcję':'Dodaj lekcję'}</h2></div><button class="secondary mini" onclick="plan()">Wróć</button></div>
    <select id="mlClass">${(wolfSchool.classes||[]).map(c=>`<option value="${esc(c.id)}" ${c.id===selectedClass?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
    <div class="grid"><select id="mlDay">${days.map((d,i)=>`<option value="${i+1}" ${Number(existing?.day||day)===i+1?'selected':''}>${d}</option>`).join('')}</select><input id="mlLesson" type="number" min="1" max="20" value="${esc(existing?.lesson||lesson||1)}"></div>
    <select id="mlSubject"><option value="">Przedmiot</option>${(wolfSchool.subjects||[]).map(s=>`<option value="${esc(s.id)}" ${s.id===existing?.subjectId?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
    <select id="mlTeacher"><option value="">Nauczyciel (opcjonalnie)</option>${(wolfSchool.teachers||[]).map(t=>`<option value="${esc(t.id)}" ${t.id===existing?.teacherId?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
    <input id="mlRoom" placeholder="Sala" value="${esc(existing?.room||'')}">
    <div class="grid"><input id="mlStart" type="time" value="${esc(existing?.start||'')}"><input id="mlEnd" type="time" value="${esc(existing?.end||'')}"></div>

    <label>Rok szkolny</label>
    <input id="mlSchoolYear" placeholder="np. 2026/2027" value="${esc(existing?.schoolYear||period.schoolYear)}">

    <div class="grid">
      <div>
        <label>Obowiązuje od</label>
        <input id="mlValidFrom" type="date" value="${esc(existing?.validFrom||period.validFrom)}">
      </div>
      <div>
        <label>Obowiązuje do</label>
        <input id="mlValidTo" type="date" value="${esc(existing?.validTo||period.validTo)}">
      </div>
    </div>

    <button class="btn-full" onclick="saveMobileCloudLesson('${esc(id||'')}')">Zapisz</button>
    ${existing?`<button class="danger btn-full" onclick="deleteMobileCloudLesson('${esc(id)}')">Usuń lekcję</button>`:''}
  </div></section>`;
}
function saveMobileCloudLesson(id){
  const classId=$('#mlClass').value,subjectId=$('#mlSubject').value;
  if(!classId||!subjectId)return toast('Wybierz klasę i przedmiot');
  const schoolYear=$('#mlSchoolYear').value.trim();
  const validFrom=$('#mlValidFrom').value;
  const validTo=$('#mlValidTo').value;

  if(!schoolYear)return toast('Podaj rok szkolny');
  if(!validFrom||!validTo)return toast('Podaj okres obowiązywania planu');
  if(validFrom>validTo)return toast('Data końcowa nie może być wcześniejsza od początkowej');

  rememberPlanPeriod(schoolYear,validFrom,validTo);

  WolfSync.saveCloudLesson(
    id,
    classId,
    Number($('#mlDay').value),
    Number($('#mlLesson').value),
    subjectId,
    $('#mlTeacher').value,
    $('#mlRoom').value.trim(),
    $('#mlStart').value,
    $('#mlEnd').value,
    schoolYear,
    validFrom,
    validTo
  );
  toast('Zapisuję lekcję…');
}
function deleteMobileCloudLesson(id){
  if(confirm('Usunąć tę lekcję?')){WolfSync.deleteCloudLesson(id);toast('Usuwam lekcję…')}
}


function realizedLessonStudentOptions(){
  const students=wolfSchool.students||[];
  const personType=String(wolfSchool.personType||'').toLowerCase();
  const personId=String(wolfSchool.personId||'');

  if(personType==='student' && personId){
    return students.filter(s=>String(s.id)===personId);
  }

  return students;
}

function realizedLessonSelectedStudent(){
  const available=realizedLessonStudentOptions();

  if(!available.length)return '';

  const personType=String(wolfSchool.personType||'').toLowerCase();
  const personId=String(wolfSchool.personId||'');

  if(personType==='student' && personId)
    return personId;

  const stored=localStorage.getItem('wolfEduRealizedStudent')||'';

  if(available.some(s=>String(s.id)===stored))
    return stored;

  return available[0]?.id||'';
}

function realizedLessonSubjectName(subjectId){
  return (wolfSchool.subjects||[]).find(
    s=>String(s.id)===String(subjectId)
  )?.name||'Przedmiot';
}

function realizedLessonTeacherName(teacherId){
  return (wolfSchool.teachers||[]).find(
    t=>String(t.id)===String(teacherId)
  )?.name||'';
}

function realizedLessonAttendance(studentId,record){
  return (wolfSchool.attendance||[]).find(a=>
    String(a.studentId)===String(studentId) &&
    String(a.classId)===String(record.classId) &&
    String(a.date)===String(record.date) &&
    Number(a.lesson)===Number(record.lesson)
  )||null;
}

function realizedLessonSourceChange(record){
  if(record.sourceType!=='lessonChange' || !record.sourceId)
    return null;

  return (wolfSchool.lessonChanges||[]).find(
    c=>String(c.id)===String(record.sourceId)
  )||null;
}

function realizedLessonDateLabel(date){
  const d=new Date(String(date||'')+'T12:00:00');

  if(Number.isNaN(d.getTime()))
    return String(date||'');

  return d.toLocaleDateString('pl-PL',{
    weekday:'long',
    day:'numeric',
    month:'long',
    year:'numeric'
  });
}

function realizedLessons(){
  if(!wolfSchool.activeSchoolId){
    setHead('Zrealizowane lekcje',db.school);
    app.innerHTML=`
      <section class="card">
        <h2>Zrealizowane lekcje</h2>
        <p class="muted">Ta funkcja wymaga aktywnej szkoły WolfCloud.</p>
      </section>`;
    return;
  }

  setHead('Zrealizowane lekcje',wolfSchool.schoolName);

  const students=realizedLessonStudentOptions();
  const selectedStudent=realizedLessonSelectedStudent();

  const selectedSubject=localStorage.getItem('wolfEduRealizedSubject')||'';
  const selectedFrom=localStorage.getItem('wolfEduRealizedFrom')||'';
  const selectedTo=localStorage.getItem('wolfEduRealizedTo')||'';

  const student=students.find(
    s=>String(s.id)===String(selectedStudent)
  );

  const classId=String(student?.classId||'');

  let records=(wolfSchool.lessonRecords||[])
    .filter(r=>
      !!String(r.topic||'').trim() &&
      (!classId || String(r.classId)===classId)
    );

  if(selectedSubject){
    records=records.filter(
      r=>String(r.subjectId)===selectedSubject
    );
  }

  if(selectedFrom){
    records=records.filter(
      r=>String(r.date||'')>=selectedFrom
    );
  }

  if(selectedTo){
    records=records.filter(
      r=>String(r.date||'')<=selectedTo
    );
  }

  records.sort((a,b)=>{
    const dateCmp=String(b.date||'').localeCompare(String(a.date||''));
    if(dateCmp!==0)return dateCmp;
    return Number(a.lesson||0)-Number(b.lesson||0);
  });

  const personType=String(wolfSchool.personType||'').toLowerCase();
  const studentLocked=personType==='student';

  app.innerHTML=`
    <section class="plan-page">

      <div class="plan-hero">
        <div>
          <small>HISTORIA ZAJĘĆ</small>
          <h2>Zrealizowane lekcje</h2>
          <p>Tematy lekcji zapisane przez nauczycieli.</p>
        </div>
      </div>

      <section class="card">

        ${students.length ? `
          <label>Uczeń</label>

          ${studentLocked ? `
            <div class="sync-note">
              <b>${esc(student?.name||'Uczeń')}</b>
            </div>
          ` : `
            <select
              id="realizedStudent"
              onchange="
                localStorage.setItem('wolfEduRealizedStudent',this.value);
                realizedLessons();
              ">
              ${students.map(s=>`
                <option
                  value="${esc(s.id)}"
                  ${String(s.id)===String(selectedStudent)?'selected':''}>
                  ${esc(s.name||'Uczeń')}
                </option>
              `).join('')}
            </select>
          `}
        ` : `
          <div class="sync-note">
            Brak dostępnego ucznia.
          </div>
        `}

        <label>Przedmiot</label>
        <select
          id="realizedSubject"
          onchange="
            localStorage.setItem('wolfEduRealizedSubject',this.value);
            realizedLessons();
          ">
          <option value="">Wszystkie przedmioty</option>

          ${(wolfSchool.subjects||[]).map(subject=>`
            <option
              value="${esc(subject.id)}"
              ${String(subject.id)===selectedSubject?'selected':''}>
              ${esc(subject.name)}
            </option>
          `).join('')}
        </select>

        <div class="grid">
          <div>
            <label>Od</label>
            <input
              type="date"
              value="${esc(selectedFrom)}"
              onchange="
                localStorage.setItem('wolfEduRealizedFrom',this.value);
                realizedLessons();
              ">
          </div>

          <div>
            <label>Do</label>
            <input
              type="date"
              value="${esc(selectedTo)}"
              onchange="
                localStorage.setItem('wolfEduRealizedTo',this.value);
                realizedLessons();
              ">
          </div>
        </div>

      </section>

      <section class="plan-list">

        ${records.length ? records.map(record=>{
          const attendance=selectedStudent
            ? realizedLessonAttendance(selectedStudent,record)
            : null;

          const change=realizedLessonSourceChange(record);

          const changeType=String(change?.type||'').toLowerCase();

          const badge=changeType==='substitution'
            ? 'ZASTĘPSTWO'
            : changeType==='added'
              ? 'DODATKOWA'
              : changeType==='roomchange'
                ? 'ZMIANA SALI'
                : '';

          const teacher=realizedLessonTeacherName(record.teacherId);

          return `
            <article class="card">

              <div class="plan-title-row">
                <div>
                  <small>${esc(realizedLessonDateLabel(record.date))}</small>
                  <h3>
                    ${esc(record.lesson||'')}. ${esc(realizedLessonSubjectName(record.subjectId))}
                  </h3>
                </div>

                ${badge?`<em>${esc(badge)}</em>`:''}
              </div>

              <div class="plan-topic">
                <small>TEMAT LEKCJI</small>
                <b>${esc(record.topic)}</b>
              </div>

              ${teacher?`
                <p class="muted">
                  Nauczyciel: ${esc(teacher)}
                </p>
              `:''}

              ${attendance?`
                <div class="sync-note">
                  <b>Frekwencja:</b>
                  ${esc(attendance.state||'—')}
                </div>
              `:selectedStudent?`
                <div class="sync-note">
                  Frekwencja: brak wpisu
                </div>
              `:''}

              ${change?.note?`
                <p class="muted">${esc(change.note)}</p>
              `:''}

            </article>
          `;
        }).join('') : `
          <div class="card">
            <b>Brak zrealizowanych lekcji</b>
            <p class="muted">
              Dla wybranych filtrów nie znaleziono jeszcze żadnych tematów.
            </p>
          </div>
        `}

      </section>

    </section>`;
}
