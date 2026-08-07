function dashboardGreeting(){
  const h=new Date().getHours();
  if(h<11)return 'Dzień dobry';
  if(h<18)return 'Miłego dnia';
  return 'Dobry wieczór';
}

function dashboardNextLesson(){
  if(!wolfSchool.activeSchoolId || !wolfSchool.timetable?.length){
    return {title:'Brak lekcji na dziś',meta:'Plan pojawi się tutaj po synchronizacji ze szkołą.'};
  }

  let day=new Date().getDay();
  if(day===0 || day===6)return {title:'Dziś bez lekcji',meta:'Miłego weekendu.'};

  let selected=localStorage.getItem('wolfEduPlanClass')||wolfSchool.classes?.[0]?.id||'';
  if(!selected)return {title:'Wybierz klasę',meta:'Otwórz Plan lekcji i wybierz klasę.'};

  let now=new Date().toTimeString().slice(0,5);
  let lessons=wolfSchool.timetable
    .filter(l=>l.classId===selected && Number(l.day)===day)
    .sort((a,b)=>(a.start||'99:99').localeCompare(b.start||'99:99'));

  let next=lessons.find(l=>!l.end || l.end>=now);
  if(!next)return {title:'Lekcje na dziś zakończone',meta:'Sprawdź zadania i terminy na jutro.'};

  let subject=wolfSchool.subjects.find(s=>s.id===next.subjectId);
  let teacher=wolfSchool.teachers.find(t=>t.id===next.teacherId);
  let meta=[
    next.start ? `${next.start}${next.end?'–'+next.end:''}` : '',
    next.room ? `sala ${next.room}` : '',
    teacher?.name || ''
  ].filter(Boolean).join(' · ');

  return {title:subject?.name||'Przedmiot',meta:meta||`Lekcja ${next.lesson||''}`};
}

function home(){
  const cloud=!!wolfSchool.activeSchoolId;
  const schoolName=wolfSchool.schoolName||db.school||'WolfEdu';
  const gradesSrc=cloud?(wolfSchool.grades||[]):db.grades;
  const tasksSrc=cloud?(wolfSchool.tasks||[]):db.tasks;
  const attendanceSrc=cloud?(wolfSchool.attendance||[]):db.attendance;
  const studentsSrc=cloud?(wolfSchool.students||[]):db.students;

  setHead('Start',schoolName);

  const totalWeight=gradesSrc.reduce((sum,g)=>sum+Number(g.weight||1),0);
  const avg=totalWeight
    ? (gradesSrc.reduce((sum,g)=>sum+Number(g.value||0)*Number(g.weight||1),0)/totalWeight).toFixed(2)
    : '—';

  const attendanceTotal=attendanceSrc.length;
  const present=attendanceSrc.filter(a=>a.state==='Obecny').length;
  const attendancePercent=attendanceTotal?Math.round(present/attendanceTotal*100):null;

  const activeTasks=tasksSrc
    .filter(t=>!t.done)
    .sort((a,b)=>String(a.due||'9999').localeCompare(String(b.due||'9999')));

  const next=dashboardNextLesson();
  const emailLabel=syncLoggedIn && syncEmail ? syncEmail.split('@')[0] : '';
  const today=new Date().toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long'});

  app.innerHTML=`
    <section class="dashboard-greeting">
      <div>
        <h2>${dashboardGreeting()}${emailLabel?', '+esc(emailLabel):''}</h2>
        <p>${esc(today.charAt(0).toUpperCase()+today.slice(1))}</p>
      </div>
      <span class="cloud-chip ${cloud?'online':''}">
        <span class="dot"></span>${cloud?'WolfCloud online':'Tryb lokalny'}
      </span>
    </section>

    ${typeof updateHomeBannerHtml==='function'?updateHomeBannerHtml():''}

    <section class="dashboard-hero">
      <div class="eyebrow">${esc(schoolName)}</div>
      <h2>Najbliższa lekcja</h2>
      <div class="lesson-main">${esc(next.title)}</div>
      <div class="lesson-meta">${esc(next.meta)}</div>
    </section>

    <div class="metric-grid">
      <button class="metric-card" onclick="render('grades')">
        <small>Średnia ocen</small><b>${avg}</b>
      </button>
      <button class="metric-card" onclick="render('attendance')">
        <small>Frekwencja</small><b>${attendancePercent===null?'—':attendancePercent+'%'}</b>
      </button>
      <button class="metric-card" onclick="render('tasks')">
        <small>Do zrobienia</small><b>${activeTasks.length}</b>
      </button>
    </div>

    <div class="section-title"><h2>Szybkie akcje</h2></div>
    <div class="action-grid">
      <button class="action-card" onclick="render('grades')"><span class="action-icon">★</span><b>Oceny</b><small>Wyniki i średnie</small></button>
      <button class="action-card" onclick="render('plan')"><span class="action-icon">▦</span><b>Plan lekcji</b><small>Dzisiaj i cały tydzień</small></button>
      <button class="action-card" onclick="render('tasks')"><span class="action-icon">✓</span><b>Zadania</b><small>Terminy i sprawdziany</small></button>
      <button class="action-card" onclick="render('attendance')"><span class="action-icon">◷</span><b>Frekwencja</b><small>Obecności i nieobecności</small></button>
      <button class="action-card" onclick="render('classes')"><span class="action-icon">♙</span><b>Klasy</b><small>${studentsSrc.length} uczniów</small></button>
      <button class="action-card" onclick="render('settings')"><span class="action-icon">⚙</span><b>Ustawienia</b><small>Konto i WolfCloud</small></button>
    </div>

    <div class="section-title">
      <h2>Najbliższe terminy</h2>
      <button class="linkbtn" onclick="render('tasks')">Wszystkie</button>
    </div>
    <div class="card deadline-list">
      ${activeTasks.slice(0,4).map(t=>`
        <div class="item row between">
          <div>
            <b>${esc(t.title||'Zadanie')}</b><br>
            <small>${esc((wolfSchool.subjects||[]).find(s=>s.id===t.subjectId)?.name||t.subject||t.type||'Termin')}</small>
          </div>
          <span class="deadline-date">${esc(t.due||'bez daty')}</span>
        </div>`).join('') || `<div class="dashboard-empty">Brak aktywnych terminów.</div>`}
    </div>

    <div class="card">
      <div class="row between">
        <div>
          <h3>WolfCloud</h3>
          <small>${cloud?'Dane szkoły aktualizują się automatycznie.':'Zaloguj się w Ustawieniach, aby synchronizować dane.'}</small>
        </div>
        <span class="badge">${cloud?esc(wolfSchool.role||'połączono'):'offline'}</span>
      </div>
    </div>`;
}
