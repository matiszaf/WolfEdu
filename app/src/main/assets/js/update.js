const WOLF_OTA={
  checkWatchdogMs:18000,
  state:{
    phase:'idle',
    currentVersionName:'—',
    currentVersionCode:0,
    available:false,
    versionName:'',
    versionCode:0,
    apkUrl:'',
    changelog:'',
    mandatory:false,
    downloadState:'',
    message:''
  },
  checkTimer:null,
  userInitiated:false
};

function hasUpdateBridge(){
  return typeof WolfUpdate!=='undefined'
    && WolfUpdate
    && typeof WolfUpdate.getCurrentVersion==='function'
    && typeof WolfUpdate.checkForUpdates==='function'
    && typeof WolfUpdate.downloadAndInstall==='function';
}

function updateStatusText(){
  const s=WOLF_OTA.state;
  if(!hasUpdateBridge())return 'Aktualizacje dostępne tylko w aplikacji Android.';
  if(s.phase==='checking')return 'Sprawdzanie aktualizacji…';
  if(s.phase==='error')return s.message||'Nie udało się sprawdzić aktualizacji.';
  if(s.phase==='available')return `Dostępna wersja ${s.versionName}`;
  if(s.phase==='upToDate')return `Masz aktualną wersję (${s.currentVersionName||'—'}).`;
  return 'Gotowe do sprawdzenia aktualizacji.';
}

function updateCardHtml(){
  const s=WOLF_OTA.state;
  const checking=s.phase==='checking';
  const available=s.phase==='available'&&s.available;

  return `<div id="wolf-update-card" class="card">
    <h2>Aktualizacje WolfEdu</h2>
    <div class="row between">
      <div>
        <b>${esc(updateStatusText())}</b><br>
        <small>Aktualna: ${esc(s.currentVersionName||'—')} (${esc(s.currentVersionCode||0)})</small>
      </div>
      ${available?'<span class="badge">NOWA</span>':''}
    </div>

    ${available&&s.changelog?`<div class="sync-note" style="margin-top:10px"><b>Co nowego:</b><br>${esc(s.changelog)}</div>`:''}
    ${s.downloadState?`<div class="sync-note" style="margin-top:10px">${esc(s.message||s.downloadState)}</div>`:''}

    <div class="sync-actions" style="margin-top:10px">
      <button class="secondary" onclick="checkWolfUpdate(true)" ${checking?'disabled':''}>
        ${checking?'Sprawdzanie…':'Sprawdź aktualizacje'}
      </button>
      ${available?`<button onclick="installWolfUpdate()">${s.mandatory?'Zaktualizuj teraz':'Pobierz i zainstaluj'}</button>`:''}
    </div>

    <div class="sync-note">Manifest aktualizacji jest sprawdzany natywnie przez Androida. APK jest instalowane przez systemowy instalator.</div>
  </div>`;
}

function refreshUpdateCard(){
  const old=document.getElementById('wolf-update-card');
  if(!old)return;
  const box=document.createElement('div');
  box.innerHTML=updateCardHtml().trim();
  const fresh=box.firstElementChild;
  if(fresh)old.replaceWith(fresh);
}

function updateHomeBannerHtml(){
  const s=WOLF_OTA.state;
  if(!(s.phase==='available'&&s.available))return '';
  return `<div class="card" onclick="render('settings')" style="cursor:pointer"><div class="row between"><div><b>Dostępna aktualizacja ${esc(s.versionName)}</b><br><small>${s.mandatory?'Ta aktualizacja jest oznaczona jako wymagana.':'Dotknij, aby przejść do aktualizacji.'}</small></div><span class="badge">UPDATE</span></div></div>`;
}

function clearOtaCheckWatchdog(){
  if(WOLF_OTA.checkTimer){
    clearTimeout(WOLF_OTA.checkTimer);
    WOLF_OTA.checkTimer=null;
  }
}

function checkWolfUpdate(userInitiated=false){
  const s=WOLF_OTA.state;
  if(s.phase==='checking')return;

  if(!hasUpdateBridge()){
    s.phase='error';
    s.message='Natywny moduł aktualizacji jest niedostępny.';
    refreshUpdateCard();
    if(userInitiated)toast(s.message);
    return;
  }

  WOLF_OTA.userInitiated=!!userInitiated;
  s.phase='checking';
  s.message='';
  refreshUpdateCard();

  clearOtaCheckWatchdog();
  WOLF_OTA.checkTimer=setTimeout(()=>{
    if(s.phase!=='checking')return;
    s.phase='error';
    s.available=false;
    s.message='Moduł aktualizacji nie odpowiedział w ciągu 18 sekund.';
    refreshUpdateCard();
    if(WOLF_OTA.userInitiated)toast(s.message);
  },WOLF_OTA.checkWatchdogMs);

  try{
    // Najprostszy możliwy JS bridge: metoda bez argumentów.
    WolfUpdate.checkForUpdates();
  }catch(e){
    clearOtaCheckWatchdog();
    s.phase='error';
    s.available=false;
    s.message='Nie udało się uruchomić sprawdzania: '+String(e);
    refreshUpdateCard();
    if(userInitiated)toast(s.message);
  }
}

function installWolfUpdate(){
  const s=WOLF_OTA.state;
  if(!hasUpdateBridge()||!s.available||!s.apkUrl)return;

  s.downloadState='starting';
  s.message='Przygotowuję pobieranie…';
  refreshUpdateCard();

  try{
    WolfUpdate.downloadAndInstall(s.apkUrl);
  }catch(e){
    s.downloadState='error';
    s.message='Nie udało się uruchomić pobierania: '+String(e);
    refreshUpdateCard();
    toast(s.message);
  }
}

window.wolfOtaNativeVersion=function(info){
  const s=WOLF_OTA.state;
  info=info||{};
  s.currentVersionName=info.versionName||s.currentVersionName;
  s.currentVersionCode=Number(info.versionCode||s.currentVersionCode||0);
  refreshUpdateCard();
};

window.wolfOtaCheckResult=function(result){
  clearOtaCheckWatchdog();
  const s=WOLF_OTA.state;
  result=result||{};

  s.currentVersionName=result.currentVersionName||s.currentVersionName;
  s.currentVersionCode=Number(result.currentVersionCode||s.currentVersionCode||0);
  s.message=result.message||'';

  if(!result.ok){
    s.phase='error';
    s.available=false;
    refreshUpdateCard();
    if(WOLF_OTA.userInitiated)toast(s.message||'Nie udało się sprawdzić aktualizacji.');
    return;
  }

  s.available=!!result.available;
  s.versionName=result.versionName||'';
  s.versionCode=Number(result.versionCode||0);
  s.apkUrl=result.apkUrl||'';
  s.changelog=result.changelog||'';
  s.mandatory=!!result.mandatory;
  s.phase=s.available?'available':'upToDate';

  refreshUpdateCard();
  if(WOLF_OTA.userInitiated){
    toast(s.available?`Dostępna aktualizacja ${s.versionName}`:'WolfEdu jest aktualne');
  }
};

window.wolfOtaDownloadResult=function(result){
  const s=WOLF_OTA.state;
  result=result||{};
  s.downloadState=result.state||'';
  s.message=result.message||'';
  refreshUpdateCard();
  if(result.message)toast(result.message);
};

function initWolfUpdates(){
  if(!hasUpdateBridge())return;
  try{WolfUpdate.getCurrentVersion()}catch(e){}
  // OTA v2 nie sprawdza automatycznie przy starcie. Najpierw stabilny ręczny flow.
}
