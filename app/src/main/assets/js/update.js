const WOLF_UPDATE_CHECK_TIMEOUT_MS=20000;
const WOLF_UPDATE_DOWNLOAD_TIMEOUT_MS=180000;

let wolfUpdate={
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
  message:'',
  userInitiated:false
};

let wolfUpdateCheckTimer=null;
let wolfUpdateDownloadTimer=null;

function hasUpdateBridge(){
  return typeof WolfUpdate!=='undefined'
    && WolfUpdate
    && typeof WolfUpdate.getCurrentVersion==='function'
    && typeof WolfUpdate.checkForUpdates==='function'
    && typeof WolfUpdate.downloadAndInstall==='function';
}

function updateStatusText(){
  switch(wolfUpdate.phase){
    case 'checking': return 'Sprawdzanie aktualizacji…';
    case 'available': return `Dostępna wersja ${wolfUpdate.versionName}`;
    case 'upToDate': return `Masz aktualną wersję (${wolfUpdate.currentVersionName||'—'}).`;
    case 'error': return wolfUpdate.message||'Nie udało się sprawdzić aktualizacji.';
    case 'downloading': return wolfUpdate.message||'Pobieranie aktualizacji…';
    case 'downloaded': return wolfUpdate.message||'Aktualizacja pobrana.';
    case 'permission': return wolfUpdate.message||'Wymagana zgoda na instalowanie aplikacji.';
    case 'installing': return wolfUpdate.message||'Otwieram instalator Androida…';
    default:
      return hasUpdateBridge()
        ? `Aktualna wersja: ${wolfUpdate.currentVersionName||'—'}`
        : 'Aktualizacje dostępne tylko w aplikacji Android.';
  }
}

function updateCardHtml(){
  const checking=wolfUpdate.phase==='checking';
  const available=wolfUpdate.available && wolfUpdate.phase!=='error';

  return `<div class="card"><h2>Aktualizacje WolfEdu</h2>
    <div class="row between">
      <div><b>${esc(updateStatusText())}</b><br>
        <small>Aktualna: ${esc(wolfUpdate.currentVersionName||'—')} (${esc(wolfUpdate.currentVersionCode||0)})</small>
      </div>
      ${available?'<span class="badge">NOWA</span>':''}
    </div>

    ${available&&wolfUpdate.changelog?`<div class="sync-note" style="margin-top:10px"><b>Co nowego:</b><br>${esc(wolfUpdate.changelog)}</div>`:''}
    ${wolfUpdate.message&&['downloading','downloaded','permission','installing','error'].includes(wolfUpdate.phase)?`<div class="sync-note" style="margin-top:10px">${esc(wolfUpdate.message)}</div>`:''}

    <div class="sync-actions" style="margin-top:10px">
      <button class="secondary" onclick="checkWolfUpdate(true)" ${checking?'disabled':''}>${checking?'Sprawdzanie…':'Sprawdź aktualizacje'}</button>
      ${available?`<button onclick="installWolfUpdate()">${wolfUpdate.mandatory?'Zaktualizuj teraz':'Pobierz i zainstaluj'}</button>`:''}
    </div>

    <div class="sync-note">Aktualizacje są pobierane z oficjalnego WolfEdu-Releases i instalowane przez systemowy instalator Androida.</div>
  </div>`;
}

function mountUpdateCard(){
  const mount=document.getElementById('updateCardMount');
  if(mount)mount.innerHTML=updateCardHtml();
}

function renderUpdateUi(){
  mountUpdateCard();
  if(currentPage==='home'&&typeof home==='function'&&wolfUpdate.phase==='available')home();
}

function updateHomeBannerHtml(){
  if(!wolfUpdate.available||wolfUpdate.phase!=='available')return '';
  return `<div class="card" onclick="render('settings')" style="cursor:pointer"><div class="row between"><div><b>Dostępna aktualizacja ${esc(wolfUpdate.versionName)}</b><br><small>${wolfUpdate.mandatory?'Ta aktualizacja jest oznaczona jako wymagana.':'Dotknij, aby przejść do aktualizacji.'}</small></div><span class="badge">UPDATE</span></div></div>`;
}

function clearUpdateCheckTimer(){
  if(wolfUpdateCheckTimer){
    clearTimeout(wolfUpdateCheckTimer);
    wolfUpdateCheckTimer=null;
  }
}

function clearUpdateDownloadTimer(){
  if(wolfUpdateDownloadTimer){
    clearTimeout(wolfUpdateDownloadTimer);
    wolfUpdateDownloadTimer=null;
  }
}

function failUpdateCheck(message,showToast=true){
  clearUpdateCheckTimer();
  wolfUpdate.phase='error';
  wolfUpdate.available=false;
  wolfUpdate.message=message||'Nie udało się sprawdzić aktualizacji.';
  renderUpdateUi();
  if(showToast)toast(wolfUpdate.message);
}

function checkWolfUpdate(userInitiated=false){
  if(wolfUpdate.phase==='checking')return;

  if(!hasUpdateBridge()){
    if(userInitiated)toast('Aktualizacje są dostępne tylko w aplikacji Android.');
    return;
  }

  clearUpdateCheckTimer();
  wolfUpdate.phase='checking';
  wolfUpdate.message='';
  wolfUpdate.userInitiated=!!userInitiated;
  renderUpdateUi();

  wolfUpdateCheckTimer=setTimeout(()=>{
    if(wolfUpdate.phase==='checking'){
      failUpdateCheck('Przekroczono czas sprawdzania aktualizacji.',true);
    }
  },WOLF_UPDATE_CHECK_TIMEOUT_MS);

  try{
    WolfUpdate.checkForUpdates(!!userInitiated);
  }catch(e){
    failUpdateCheck('Nie udało się uruchomić sprawdzania: '+String(e),true);
  }
}

function installWolfUpdate(){
  if(!hasUpdateBridge()||!wolfUpdate.available||!wolfUpdate.apkUrl)return;

  clearUpdateDownloadTimer();
  wolfUpdate.phase='downloading';
  wolfUpdate.downloadState='starting';
  wolfUpdate.message='Przygotowuję pobieranie…';
  renderUpdateUi();

  wolfUpdateDownloadTimer=setTimeout(()=>{
    if(wolfUpdate.phase==='downloading'){
      wolfUpdate.phase='error';
      wolfUpdate.message='Pobieranie aktualizacji trwało zbyt długo. Możesz spróbować ponownie.';
      renderUpdateUi();
      toast(wolfUpdate.message);
    }
  },WOLF_UPDATE_DOWNLOAD_TIMEOUT_MS);

  try{
    WolfUpdate.downloadAndInstall(wolfUpdate.apkUrl,wolfUpdate.versionName||'aktualizacja');
  }catch(e){
    clearUpdateDownloadTimer();
    wolfUpdate.phase='error';
    wolfUpdate.message='Nie udało się rozpocząć pobierania: '+String(e);
    renderUpdateUi();
    toast(wolfUpdate.message);
  }
}

window.wolfUpdateCurrent=function(info){
  info=info||{};
  wolfUpdate.currentVersionName=info.versionName||wolfUpdate.currentVersionName;
  wolfUpdate.currentVersionCode=Number(info.versionCode||wolfUpdate.currentVersionCode||0);
  renderUpdateUi();
};

window.wolfUpdateResult=function(result){
  result=result||{};
  clearUpdateCheckTimer();

  wolfUpdate.currentVersionName=result.currentVersionName||wolfUpdate.currentVersionName;
  wolfUpdate.currentVersionCode=Number(result.currentVersionCode||wolfUpdate.currentVersionCode||0);

  if(!result.ok){
    wolfUpdate.phase='error';
    wolfUpdate.available=false;
    wolfUpdate.message=result.message||'Nie udało się sprawdzić aktualizacji.';
    renderUpdateUi();
    if(result.userInitiated)toast(wolfUpdate.message);
    return;
  }

  wolfUpdate.available=!!result.available;
  wolfUpdate.versionName=result.versionName||'';
  wolfUpdate.versionCode=Number(result.versionCode||0);
  wolfUpdate.apkUrl=result.apkUrl||'';
  wolfUpdate.changelog=result.changelog||'';
  wolfUpdate.mandatory=!!result.mandatory;
  wolfUpdate.message='';
  wolfUpdate.phase=wolfUpdate.available?'available':'upToDate';
  renderUpdateUi();

  if(result.userInitiated){
    toast(wolfUpdate.available?`Dostępna aktualizacja ${wolfUpdate.versionName}`:'WolfEdu jest aktualne');
  }
};

window.wolfUpdateDownload=function(result){
  result=result||{};
  const state=result.state||'';
  wolfUpdate.downloadState=state;
  wolfUpdate.message=result.message||'';

  if(state==='downloading'){
    wolfUpdate.phase='downloading';
  }else if(state==='downloaded'){
    clearUpdateDownloadTimer();
    wolfUpdate.phase='downloaded';
  }else if(state==='permission'){
    clearUpdateDownloadTimer();
    wolfUpdate.phase='permission';
  }else if(state==='installing'){
    clearUpdateDownloadTimer();
    wolfUpdate.phase='installing';
  }else if(state==='error'){
    clearUpdateDownloadTimer();
    wolfUpdate.phase='error';
  }

  renderUpdateUi();
  if(result.message&&state!=='downloading')toast(result.message);
};

function initWolfUpdates(){
  if(!hasUpdateBridge())return;
  try{WolfUpdate.getCurrentVersion()}catch(e){
    wolfUpdate.phase='error';
    wolfUpdate.message='Nie udało się odczytać wersji aplikacji.';
  }
}
