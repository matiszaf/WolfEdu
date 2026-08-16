let syncUid='';
let wolfSchool={activeSchoolId:'',schoolName:'',role:'',personType:'',personId:'',systemStatus:'active',systemStatusReason:'',schools:[],classes:[],students:[],parents:[],subjects:[],teachers:[],grades:[],tasks:[],attendance:[],timetable:[],lessonRecords:[],lessonChanges:[],lessonHours:[],members:[],invites:[],myInvites:[]};
window.wolfSchoolData=function(payload){
  WolfCore.finish('school-data');

  try{
    wolfSchool=Object.assign({
      activeSchoolId:'',
      schoolName:'',
      role:'',
      personType:'',
      personId:'',
      systemStatus:'active',
      systemStatusReason:'',
      schools:[],
      classes:[],
      students:[],
      parents:[],
      subjects:[],
      teachers:[],
      grades:[],
      tasks:[],
      attendance:[],
      timetable:[],
      lessonRecords:[],
      lessonChanges:[],
      lessonHours:[],
      members:[],
      invites:[],
      myInvites:[]
    },payload||{});

    if(wolfSchool.schoolName&&!db.school){
      db.school=wolfSchool.schoolName;
      localStorage.setItem(KEY,JSON.stringify(db));
    }

    schedulePageRefresh();
  }catch(e){
    console.error('wolfSchoolData',e);
  }
};
window.wolfSchoolError=function(message){WolfCore.finish('school-data');toast(message||'Nie udało się pobrać danych szkoły')};
let syncLoggedIn=false,syncEmail='',syncState='offline',syncTitle='Tylko lokalnie',syncDetail='Zaloguj się, aby synchronizować.',syncTimer=null,applyingRemote=false;
function hasSyncBridge(){return typeof WolfSync!=='undefined'}
function updateSyncPill(){let pill=$('#syncPill'),txt=$('#syncPillText');if(!pill||!txt)return;pill.className='sync-pill '+syncState;txt.textContent=syncTitle}
function scheduleCloudSync(){if(applyingRemote||!syncLoggedIn||!hasSyncBridge())return;clearTimeout(syncTimer);syncState='syncing';syncTitle='Oczekuje na synchronizację';syncDetail='Zmiana zostanie wysłana automatycznie.';updateSyncPill();syncTimer=setTimeout(()=>WolfSync.syncData(JSON.stringify(db),Number(db?._sync?.updatedAt||Date.now())),650)}
function syncNow(btn){
  if(!syncLoggedIn)return toast('Najpierw się zaloguj');
  if(btn){btn.classList.add('btn-busy');btn.textContent='Synchronizuję…'}
  db._sync=db._sync||{};db._sync.updatedAt=Date.now();localStorage.setItem(KEY,JSON.stringify(db));
  if(hasSyncBridge()){
    WolfCore.bridgeTask('sync-manual',()=>{
      WolfSync.syncData(JSON.stringify(db),db._sync.updatedAt);
      WolfSync.requestRemoteData();
      WolfSync.requestSchoolData();
    },{
      ms:WolfCore.timeouts.sync,
      message:'Synchronizacja trwała zbyt długo. Spróbuj ponownie.',
      onTimeout:()=>{
        syncState='pending';syncTitle='Brak odpowiedzi';syncDetail='Synchronizacja przekroczyła limit czasu.';
        updateSyncPill();if(currentPage==='settings')schedulePageRefresh();
      }
    });
  }
  setTimeout(()=>{if(currentPage==='settings')schedulePageRefresh()},900);
}
function loginSync(btn){
  let e=$('#syncEmail')?.value.trim(),p=$('#syncPassword')?.value||'';
  if(!e||p.length<6)return toast('Wpisz e-mail i hasło min. 6 znaków');
  if(btn){btn.classList.add('btn-busy');btn.textContent='Logowanie…'}
  WolfCore.bridgeTask('auth',()=>WolfSync.login(e,p),{ms:15000,message:'Logowanie trwało zbyt długo.',onTimeout:()=>{syncState='pending';syncTitle='Brak odpowiedzi';updateSyncPill();if(currentPage==='settings')schedulePageRefresh()}});syncState='syncing';syncTitle='Logowanie…';updateSyncPill()
}
function registerSync(btn){
  let e=$('#syncEmail')?.value.trim(),p=$('#syncPassword')?.value||'';
  if(!e||p.length<6)return toast('Wpisz e-mail i hasło min. 6 znaków');
  if(btn){btn.classList.add('btn-busy');btn.textContent='Tworzenie…'}
  WolfCore.bridgeTask('auth',()=>WolfSync.register(e,p),{ms:15000,message:'Tworzenie konta trwało zbyt długo.',onTimeout:()=>{syncState='pending';syncTitle='Brak odpowiedzi';updateSyncPill();if(currentPage==='settings')schedulePageRefresh()}});syncState='syncing';syncTitle='Tworzenie konta…';updateSyncPill()
}
function logoutSync(btn){
  if(!syncLoggedIn)return;
  if(btn){btn.classList.add('btn-busy');btn.textContent='Wylogowuję…'}
  syncState='syncing';syncTitle='Wylogowywanie…';syncDetail='Kończenie sesji WolfCloud.';updateSyncPill();
  WolfCore.bridgeTask('auth',()=>WolfSync.logout(),{ms:12000,message:'Wylogowanie trwało zbyt długo.',onTimeout:()=>{syncState='pending';syncTitle='Brak odpowiedzi';updateSyncPill();if(currentPage==='settings')schedulePageRefresh()}});
}
window.wolfSyncAuth=function(logged,email,uid){
  WolfCore.finish('auth');

  syncLoggedIn=!!logged;
  syncEmail=email||'';
  syncUid=uid||'';

  syncState=logged?'online':'offline';
  syncTitle=logged?'Połączono':'Tylko lokalnie';
  syncDetail=logged
    ? 'Synchronizacja jest aktywna.'
    : 'Zaloguj się, aby synchronizować.';

  updateSyncPill();

  if(logged&&hasSyncBridge()){
    WolfCore.watch(
      'school-data',
      20000,
      'Dane szkoły nie odpowiedziały w czasie.',
      ()=>schedulePageRefresh()
    );

    WolfSync.requestRemoteData();
    WolfSync.requestSchoolData();
  }

  schedulePageRefresh();
};
window.wolfSyncStatus=function(title,detail,state){
  if(state&&state!=='syncing'){
    WolfCore.finish('sync-manual');
  }

  syncTitle=title||'Synchronizacja';
  syncDetail=detail||'';
  syncState=state||'offline';

  updateSyncPill();
  schedulePageRefresh();
};
window.wolfSyncError=function(message){
  WolfCore.finish('auth');
  WolfCore.finish('sync-manual');
  WolfCore.finish('school-data');

  syncState='pending';
  syncTitle='Błąd synchronizacji';
  syncDetail=message||'Nie udało się połączyć.';

  updateSyncPill();
  toast(syncDetail);
  schedulePageRefresh();
};
window.wolfSyncRemote=function(json,updatedAt){
  WolfCore.finish('sync-manual');

  try{
    const remote=JSON.parse(json);
    const localTime=Number(db?._sync?.updatedAt||0);
    const remoteTime=Number(
      updatedAt||
      remote?._sync?.updatedAt||
      0
    );

    if(remoteTime>localTime){
      applyingRemote=true;
      db=remote;
      db._sync=db._sync||{};
      db._sync.updatedAt=remoteTime;
      localStorage.setItem(KEY,JSON.stringify(db));
      applyingRemote=false;
      toast('Pobrano nowsze dane z chmury');
    }

    syncState='online';
    syncTitle='Zsynchronizowano';
    syncDetail='Wszystkie zmiany są aktualne.';
    updateSyncPill();

    schedulePageRefresh();
  }catch(e){
    applyingRemote=false;
    window.wolfSyncError(
      'Nie udało się odczytać danych z chmury.'
    );
  }
};

migrate();
