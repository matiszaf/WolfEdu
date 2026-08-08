const days=['Poniedziałek','Wtorek','Środa','Czwartek','Piątek'];
let wolfPlanDay=null;

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
function planClassLessons(classId,day){
  return (wolfSchool.timetable||[])
    .filter(l=>l.classId===classId&&Number(l.day)===Number(day))
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
  return `<div class="plan-lesson ${state}" ${canManageSchool()?`onclick="openMobileLessonEditor('${esc(l.id)}','${esc(selected)}',${Number(l.day)},${Number(l.lesson)})"`:''}>
    <div class="plan-time"><b>${esc(l.start||('#'+l.lesson))}</b><small>${esc(l.end||'')}</small></div>
    <div class="plan-line"><span></span></div>
    <div class="plan-copy"><div class="plan-title-row"><b>${esc(planSubject(l))}</b>
      ${state==='current'?'<em>TERAZ</em>':''}</div>
      <small>${esc(meta||'Brak sali i nauczyciela')}</small>
    </div>
    <div class="plan-lesson-no">${esc(l.lesson||'')}</div>
  </div>`;
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
      <section class="plan-toolbar">
        <div><small>Plan klasy</small><select id="cloudPlanClass" onchange="changeCloudPlanClass(this.value)">${classOptions}</select></div>
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
      ${canManageSchool()?`<button class="plan-add" onclick="openMobileLessonEditor('', '${esc(selected)}', ${selectedDay}, ${Math.max(1,lessons.length+1)})">＋ Dodaj lekcję</button>`:''}
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

function openMobileLessonEditor(id,classId,day,lesson){
  if(!canManageSchool())return;
  const existing=(wolfSchool.timetable||[]).find(x=>x.id===id);
  const selectedClass=classId||localStorage.getItem('wolfEduPlanClass')||wolfSchool.classes?.[0]?.id||'';
  app.innerHTML=`<section class="plan-page"><div class="plan-editor">
    <div class="plan-editor-head"><div><small>WOLFCLOUD</small><h2>${existing?'Edytuj lekcję':'Dodaj lekcję'}</h2></div><button class="secondary mini" onclick="plan()">Wróć</button></div>
    <select id="mlClass">${(wolfSchool.classes||[]).map(c=>`<option value="${esc(c.id)}" ${c.id===selectedClass?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
    <div class="grid"><select id="mlDay">${days.map((d,i)=>`<option value="${i+1}" ${Number(existing?.day||day)===i+1?'selected':''}>${d}</option>`).join('')}</select><input id="mlLesson" type="number" min="1" max="20" value="${esc(existing?.lesson||lesson||1)}"></div>
    <select id="mlSubject"><option value="">Przedmiot</option>${(wolfSchool.subjects||[]).map(s=>`<option value="${esc(s.id)}" ${s.id===existing?.subjectId?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
    <select id="mlTeacher"><option value="">Nauczyciel (opcjonalnie)</option>${(wolfSchool.teachers||[]).map(t=>`<option value="${esc(t.id)}" ${t.id===existing?.teacherId?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
    <input id="mlRoom" placeholder="Sala" value="${esc(existing?.room||'')}">
    <div class="grid"><input id="mlStart" type="time" value="${esc(existing?.start||'')}"><input id="mlEnd" type="time" value="${esc(existing?.end||'')}"></div>
    <button class="btn-full" onclick="saveMobileCloudLesson('${esc(id||'')}')">Zapisz</button>
    ${existing?`<button class="danger btn-full" onclick="deleteMobileCloudLesson('${esc(id)}')">Usuń lekcję</button>`:''}
  </div></section>`;
}
function saveMobileCloudLesson(id){
  const classId=$('#mlClass').value,subjectId=$('#mlSubject').value;
  if(!classId||!subjectId)return toast('Wybierz klasę i przedmiot');
  WolfSync.saveCloudLesson(id,classId,Number($('#mlDay').value),Number($('#mlLesson').value),subjectId,$('#mlTeacher').value,$('#mlRoom').value.trim(),$('#mlStart').value,$('#mlEnd').value);
  toast('Zapisuję lekcję…');
}
function deleteMobileCloudLesson(id){
  if(confirm('Usunąć tę lekcję?')){WolfSync.deleteCloudLesson(id);toast('Usuwam lekcję…')}
}
