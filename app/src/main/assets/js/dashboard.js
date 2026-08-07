function dashboardGreeting(){
  const h=new Date().getHours();
  if(h<11)return 'Dzień dobry';
  if(h<18)return 'Miłego dnia';
  return 'Dobry wieczór';
}

function dashboardTodayISO(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function dashboardTomorrowISO(){
  const d=new Date();
  d.setDate(d.getDate()+1);
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function dashboardFormatDate(value){
  if(!value)return 'bez daty';
  try{
    const d=new Date(value+'T12:00:00');
    return d.toLocaleDateString('pl-PL',{day:'numeric',month:'short'});
  }catch(e){
    return String(value);
  }
}

function dashboardSubjectName(subjectId,fallback=''){
  if(!subjectId)return fallback||'Przedmiot';
  const subject=(wolfSchool.subjects||[]).find(s=>s.id===subjectId);
  return subject?.name||fallback||'Przedmiot';
}

function dashboardStudentName(studentId){
  if(!studentId)return '';
  const student=(wolfSchool.students||[]).find(s=>s.id===studentId);
  return student?.name||
    [student?.firstName,student?.lastName].filter(Boolean).join(' ')||
    '';
}

function dashboardNextLesson(){
  if(!wolfSchool.activeSchoolId || !(wolfSchool.timetable||[]).length){
    return {state:'empty',title:'Brak lekcji na dziś',meta:'Plan pojawi się tutaj po synchronizacji.',start:''};
  }

  const day=new Date().getDay();
  if(day===0 || day===6){
    return {state:'weekend',title:'Dziś bez lekcji',meta:'Miłego weekendu.',start:''};
  }

  const selected=
    localStorage.getItem('wolfEduPlanClass')||
    wolfSchool.classes?.[0]?.id||
    '';

  if(!selected){
    return {state:'empty',title:'Wybierz klasę',meta:'Otwórz Plan lekcji i wybierz klasę.',start:''};
  }

  const now=new Date().toTimeString().slice(0,5);
  const lessons=(wolfSchool.timetable||[])
    .filter(l=>l.classId===selected && Number(l.day)===day)
    .sort((a,b)=>(a.start||'99:99').localeCompare(b.start||'99:99'));

  const next=lessons.find(l=>{
    if(l.end)return l.end>=now;
    if(l.start)return l.start>=now;
    return false;
  });

  if(!next){
    return {state:'done',title:'Lekcje na dziś zakończone',meta:'Sprawdź zadania i terminy na jutro.',start:''};
  }

  const subject=(wolfSchool.subjects||[]).find(s=>s.id===next.subjectId);
  const teacher=(wolfSchool.teachers||[]).find(t=>t.id===next.teacherId);

  const meta=[
    next.start ? `${next.start}${next.end?'–'+next.end:''}` : '',
    next.room ? `sala ${next.room}` : '',
    teacher?.name || ''
  ].filter(Boolean).join(' · ');

  return {
    state:'lesson',
    title:subject?.name||'Przedmiot',
    meta:meta||`Lekcja ${next.lesson||''}`,
    start:next.start||''
  };
}

function dashboardRecentGrades(grades){
  return [...grades]
    .sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))
    .slice(0,4);
}

function dashboardActiveTasks(tasks){
  return [...tasks]
    .filter(t=>!t.done)
    .sort((a,b)=>String(a.due||'9999-99-99').localeCompare(String(b.due||'9999-99-99')));
}

function dashboardTaskLabel(task){
  if(task.due===dashboardTodayISO())return 'Dzisiaj';
  if(task.due===dashboardTomorrowISO())return 'Jutro';
  return dashboardFormatDate(task.due);
}

function dashboardAttendancePercent(attendance){
  if(!attendance.length)return null;
  const present=attendance.filter(a=>String(a.state||'').toLowerCase()==='obecny').length;
  return Math.round(present/attendance.length*100);
}

function dashboardAverage(grades){
  const valid=grades.filter(g=>Number.isFinite(Number(g.value)));
  const totalWeight=valid.reduce((sum,g)=>sum+Number(g.weight||1),0);
  if(!totalWeight)return '—';
  const value=valid.reduce((sum,g)=>sum+Number(g.value||0)*Number(g.weight||1),0)/totalWeight;
  return value.toFixed(2);
}

function dashboardRoleLabel(role){
  const roles={
    owner:'Właściciel',
    admin:'Administrator',
    director:'Dyrekcja',
    teacher:'Nauczyciel',
    parent:'Rodzic',
    student:'Uczeń'
  };
  return roles[role]||role||'Brak roli';
}

function home(){
  const cloud=!!wolfSchool.activeSchoolId;
  const schoolName=wolfSchool.schoolName||db.school||'WolfEdu';

  const gradesSrc=cloud?(wolfSchool.grades||[]):(db.grades||[]);
  const tasksSrc=cloud?(wolfSchool.tasks||[]):(db.tasks||[]);
  const attendanceSrc=cloud?(wolfSchool.attendance||[]):(db.attendance||[]);
  const studentsSrc=cloud?(wolfSchool.students||[]):(db.students||[]);

  setHead('Start',schoolName);

  const avg=dashboardAverage(gradesSrc);
  const attendancePercent=dashboardAttendancePercent(attendanceSrc);
  const activeTasks=dashboardActiveTasks(tasksSrc);
  const recentGrades=dashboardRecentGrades(gradesSrc);
  const next=dashboardNextLesson();

  const emailLabel=syncLoggedIn&&syncEmail?syncEmail.split('@')[0]:'';

  const todayRaw=new Date().toLocaleDateString('pl-PL',{
    weekday:'long',day:'numeric',month:'long'
  });
  const today=todayRaw.charAt(0).toUpperCase()+todayRaw.slice(1);

  const todayTasks=activeTasks.filter(t=>t.due===dashboardTodayISO());
  const tomorrowTasks=activeTasks.filter(t=>t.due===dashboardTomorrowISO());

  app.innerHTML=`
    <section class="dashboard-top">
      <div class="dashboard-greeting">
        <div>
          <div class="dashboard-overline">${esc(today)}</div>
          <h2>${dashboardGreeting()}${emailLabel?', '+esc(emailLabel):''}</h2>
          <p>${cloud?`Połączono z ${esc(schoolName)}`:'Pracujesz obecnie w trybie lokalnym.'}</p>
        </div>

        <button class="dashboard-profile" onclick="render('settings')" aria-label="Ustawienia konta">
          ${esc((syncEmail||schoolName||'W').charAt(0).toUpperCase())}
        </button>
      </div>

      <div class="dashboard-cloudbar ${cloud?'online':'offline'}">
        <div class="dashboard-cloud-status">
          <span class="dashboard-status-dot"></span>
          <div>
            <b>${cloud?'WolfCloud online':'Tryb lokalny'}</b>
            <small>${cloud?`${dashboardRoleLabel(wolfSchool.role)} · dane synchronizowane`:'Połącz konto w Ustawieniach'}</small>
          </div>
        </div>
        <button class="dashboard-cloud-action" onclick="render('settings')">${cloud?'Konto':'Połącz'}</button>
      </div>
    </section>

    ${typeof updateHomeBannerHtml==='function'?updateHomeBannerHtml():''}

    <section class="dashboard-lesson ${esc(next.state)}" onclick="render('plan')">
      <div class="dashboard-lesson-top">
        <span>NAJBLIŻSZA LEKCJA</span>
        ${next.start?`<strong>${esc(next.start)}</strong>`:''}
      </div>
      <div class="dashboard-lesson-main">
        <div>
          <h2>${esc(next.title)}</h2>
          <p>${esc(next.meta)}</p>
        </div>
        <div class="dashboard-lesson-arrow">›</div>
      </div>
    </section>

    <section class="dashboard-metrics">
      <button class="dashboard-metric" onclick="render('grades')">
        <div class="dashboard-metric-icon">★</div>
        <div><small>Średnia</small><b>${avg}</b></div>
      </button>

      <button class="dashboard-metric" onclick="render('attendance')">
        <div class="dashboard-metric-icon">◷</div>
        <div><small>Frekwencja</small><b>${attendancePercent===null?'—':attendancePercent+'%'}</b></div>
      </button>

      <button class="dashboard-metric" onclick="render('tasks')">
        <div class="dashboard-metric-icon">✓</div>
        <div><small>Do zrobienia</small><b>${activeTasks.length}</b></div>
      </button>
    </section>

    ${(todayTasks.length||tomorrowTasks.length)?`
      <div class="dashboard-alerts">
        ${todayTasks.length?`
          <button class="dashboard-alert urgent" onclick="render('tasks')">
            <div><b>${todayTasks.length}</b><span>${todayTasks.length===1?'termin dzisiaj':'terminy dzisiaj'}</span></div>
            <strong>Sprawdź ›</strong>
          </button>`:''}
        ${tomorrowTasks.length?`
          <button class="dashboard-alert" onclick="render('tasks')">
            <div><b>${tomorrowTasks.length}</b><span>${tomorrowTasks.length===1?'termin jutro':'terminy jutro'}</span></div>
            <strong>Zobacz ›</strong>
          </button>`:''}
      </div>`:''}

    <div class="section-title"><h2>Skróty</h2></div>

    <section class="dashboard-actions">
      <button onclick="render('grades')"><span>★</span><b>Oceny</b></button>
      <button onclick="render('plan')"><span>▦</span><b>Plan</b></button>
      <button onclick="render('tasks')"><span>✓</span><b>Zadania</b></button>
      <button onclick="render('attendance')"><span>◷</span><b>Frekwencja</b></button>
    </section>

    <div class="dashboard-columns">
      <section>
        <div class="section-title">
          <h2>Ostatnie oceny</h2>
          <button class="linkbtn" onclick="render('grades')">Wszystkie</button>
        </div>

        <div class="card dashboard-list">
          ${recentGrades.length?recentGrades.map(g=>`
            <button class="dashboard-list-item" onclick="render('grades')">
              <div class="dashboard-grade-value">${esc(g.value??'—')}</div>
              <div class="dashboard-list-main">
                <b>${esc(dashboardSubjectName(g.subjectId,g.subject))}</b>
                <small>${[
                  g.date?dashboardFormatDate(g.date):'',
                  dashboardStudentName(g.studentId)
                ].filter(Boolean).map(esc).join(' · ')}</small>
              </div>
              ${g.weight?`<span class="dashboard-weight">×${esc(g.weight)}</span>`:''}
            </button>`).join(''):`
            <div class="dashboard-empty">
              <span>★</span><b>Brak ocen</b><small>Ostatnie oceny pojawią się tutaj.</small>
            </div>`}
        </div>
      </section>

      <section>
        <div class="section-title">
          <h2>Najbliższe terminy</h2>
          <button class="linkbtn" onclick="render('tasks')">Wszystkie</button>
        </div>

        <div class="card dashboard-list">
          ${activeTasks.length?activeTasks.slice(0,4).map(t=>`
            <button class="dashboard-list-item" onclick="render('tasks')">
              <div class="dashboard-date-box">${esc(dashboardTaskLabel(t))}</div>
              <div class="dashboard-list-main">
                <b>${esc(t.title||'Zadanie')}</b>
                <small>${esc(dashboardSubjectName(t.subjectId,t.subject||t.type||'Termin'))}</small>
              </div>
              <span class="dashboard-chevron">›</span>
            </button>`).join(''):`
            <div class="dashboard-empty">
              <span>✓</span><b>Wszystko zrobione</b><small>Nie masz aktywnych terminów.</small>
            </div>`}
        </div>
      </section>
    </div>

    <section class="dashboard-school-card">
      <div>
        <small>AKTYWNA SZKOŁA</small>
        <h3>${esc(schoolName)}</h3>
        <p>${cloud?`${studentsSrc.length} uczniów · ${dashboardRoleLabel(wolfSchool.role)}`:'Dane przechowywane lokalnie'}</p>
      </div>
      <button onclick="render('settings')">Ustawienia</button>
    </section>
  `;
}
