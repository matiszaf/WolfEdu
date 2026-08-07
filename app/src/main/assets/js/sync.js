let wolfSchool={activeSchoolId:'',schoolName:'',role:'',schools:[],classes:[],students:[],subjects:[],teachers:[],grades:[],tasks:[],attendance:[],timetable:[],members:[],invites:[],myInvites:[]};
window.wolfSchoolData=function(payload){try{wolfSchool=Object.assign({activeSchoolId:'',schoolName:'',role:'',schools:[],classes:[],students:[],subjects:[],teachers:[],grades:[],tasks:[],attendance:[],timetable:[],members:[],invites:[],myInvites:[]},payload||{});if(wolfSchool.schoolName&&!db.school){db.school=wolfSchool.schoolName;localStorage.setItem(KEY,JSON.stringify(db))}if(['plan','settings','home','classes','grades','tasks','attendance'].includes(currentPage))render(currentPage||'home')}catch(e){console.error(e)}};
window.wolfSchoolError=function(message){toast(message||'Nie udało się pobrać danych szkoły')};
let syncLoggedIn=false,syncEmail='',syncState='offline',syncTitle='Tylko lokalnie',syncDetail='Zaloguj się, aby synchronizować.',syncTimer=null,applyingRemote=false;
function hasSyncBridge(){return typeof WolfSync!=='undefined'}
function updateSyncPill(){let pill=$('#syncPill'),txt=$('#syncPillText');if(!pill||!txt)return;pill.className='sync-pill '+syncState;txt.textContent=syncTitle}
function scheduleCloudSync(){if(applyingRemote||!syncLoggedIn||!hasSyncBridge())return;clearTimeout(syncTimer);syncState='syncing';syncTitle='Oczekuje na synchronizację';syncDetail='Zmiana zostanie wysłana automatycznie.';updateSyncPill();syncTimer=setTimeout(()=>WolfSync.syncData(JSON.stringify(db),Number(db?._sync?.updatedAt||Date.now())),650)}
function syncNow(btn){
  if(!syncLoggedIn)return toast('Najpierw się zaloguj');
  if(btn){btn.classList.add('btn-busy');btn.textContent='Synchronizuję…'}
  db._sync=db._sync||{};db._sync.updatedAt=Date.now();localStorage.setItem(KEY,JSON.stringify(db));
  if(hasSyncBridge()){
    WolfSync.syncData(JSON.stringify(db),db._sync.updatedAt);
    WolfSync.requestRemoteData();
    WolfSync.requestSchoolData();
  }
  setTimeout(()=>{if(currentPage==='settings')settings()},900);
}
function loginSync(btn){
  let e=$('#syncEmail')?.value.trim(),p=$('#syncPassword')?.value||'';
  if(!e||p.length<6)return toast('Wpisz e-mail i hasło min. 6 znaków');
  if(btn){btn.classList.add('btn-busy');btn.textContent='Logowanie…'}
  WolfSync.login(e,p);syncState='syncing';syncTitle='Logowanie…';updateSyncPill()
}
function registerSync(btn){
  let e=$('#syncEmail')?.value.trim(),p=$('#syncPassword')?.value||'';
  if(!e||p.length<6)return toast('Wpisz e-mail i hasło min. 6 znaków');
  if(btn){btn.classList.add('btn-busy');btn.textContent='Tworzenie…'}
  WolfSync.register(e,p);syncState='syncing';syncTitle='Tworzenie konta…';updateSyncPill()
}
function logoutSync(btn){
  if(!syncLoggedIn)return;
  if(btn){btn.classList.add('btn-busy');btn.textContent='Wylogowuję…'}
  syncState='syncing';syncTitle='Wylogowywanie…';syncDetail='Kończenie sesji WolfCloud.';updateSyncPill();
  WolfSync.logout();
}
window.wolfSyncAuth=function(logged,email){syncLoggedIn=!!logged;syncEmail=email||'';syncState=logged?'online':'offline';syncTitle=logged?'Połączono':'Tylko lokalnie';syncDetail=logged?'Synchronizacja jest aktywna.':'Zaloguj się, aby synchronizować.';updateSyncPill();if(logged&&hasSyncBridge()){WolfSync.requestRemoteData();WolfSync.requestSchoolData();}if(currentPage==='settings')settings()}
window.wolfSyncStatus=function(title,detail,state){syncTitle=title||'Synchronizacja';syncDetail=detail||'';syncState=state||'offline';updateSyncPill();if(currentPage==='settings')settings()}
window.wolfSyncError=function(message){syncState='pending';syncTitle='Błąd synchronizacji';syncDetail=message||'Nie udało się połączyć.';updateSyncPill();toast(syncDetail);if(currentPage==='settings')settings()}
window.wolfSyncRemote=function(json,updatedAt){try{let remote=JSON.parse(json),localTime=Number(db?._sync?.updatedAt||0),remoteTime=Number(updatedAt||remote?._sync?.updatedAt||0);if(remoteTime>localTime){applyingRemote=true;db=remote;db._sync=db._sync||{};db._sync.updatedAt=remoteTime;localStorage.setItem(KEY,JSON.stringify(db));applyingRemote=false;render(currentPage||'home');toast('Pobrano nowsze dane z chmury')}syncState='online';syncTitle='Zsynchronizowano';syncDetail='Wszystkie zmiany są aktualne.';updateSyncPill()}catch(e){window.wolfSyncError('Nie udało się odczytać danych z chmury.')}}

migrate();
