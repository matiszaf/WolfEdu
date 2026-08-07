let wolfUpdate={
  currentVersionName:'—',currentVersionCode:0,
  checking:false,available:false,ok:true,
  versionName:'',versionCode:0,apkUrl:'',changelog:'',mandatory:false,
  downloadState:'',message:''
};

function hasUpdateBridge(){return typeof WolfUpdate!=='undefined'&&WolfUpdate&&WolfUpdate.checkForUpdates}

function updateStatusText(){
  if(!hasUpdateBridge())return 'Aktualizacje dostępne tylko w aplikacji Android.';
  if(wolfUpdate.checking)return 'Sprawdzanie aktualizacji…';
  if(!wolfUpdate.ok)return wolfUpdate.message||'Nie udało się sprawdzić aktualizacji.';
  if(wolfUpdate.available)return `Dostępna wersja ${wolfUpdate.versionName}`;
  return `Masz aktualną wersję (${wolfUpdate.currentVersionName||'—'}).`;
}

function updateCardHtml(){
  const available=wolfUpdate.available;
  return `<div class="card"><h2>Aktualizacje WolfEdu</h2>
    <div class="row between"><div><b>${esc(updateStatusText())}</b><br><small>Aktualna: ${esc(wolfUpdate.currentVersionName||'—')} (${esc(wolfUpdate.currentVersionCode||0)})</small></div>${available?`<span class="badge">NOWA</span>`:''}</div>
    ${available&&wolfUpdate.changelog?`<div class="sync-note" style="margin-top:10px"><b>Co nowego:</b><br>${esc(wolfUpdate.changelog)}</div>`:''}
    ${wolfUpdate.downloadState?`<div class="sync-note" style="margin-top:10px">${esc(wolfUpdate.message||wolfUpdate.downloadState)}</div>`:''}
    <div class="sync-actions" style="margin-top:10px">
      <button class="secondary" onclick="checkWolfUpdate(true)" ${wolfUpdate.checking?'disabled':''}>Sprawdź aktualizacje</button>
      ${available?`<button onclick="installWolfUpdate()">${wolfUpdate.mandatory?'Zaktualizuj teraz':'Pobierz i zainstaluj'}</button>`:''}
    </div>
    <div class="sync-note">Aktualizacje są pobierane z oficjalnego hostingu WolfEdu i instalowane przez systemowy instalator Androida.</div>
  </div>`;
}

function updateHomeBannerHtml(){
  if(!wolfUpdate.available)return '';
  return `<div class="card" onclick="render('settings')" style="cursor:pointer"><div class="row between"><div><b>Dostępna aktualizacja ${esc(wolfUpdate.versionName)}</b><br><small>${wolfUpdate.mandatory?'Ta aktualizacja jest oznaczona jako wymagana.':'Dotknij, aby przejść do aktualizacji.'}</small></div><span class="badge">UPDATE</span></div></div>`;
}

let wolfUpdateTimeout=null;

function checkWolfUpdate(userInitiated=false){
  if(userInitiated){
    toast(
      typeof WolfUpdate==='undefined'
        ? 'DEBUG: WolfUpdate = undefined'
        : 'DEBUG: WolfUpdate dostępny'
    );
  }

  if(!hasUpdateBridge()){
    if(userInitiated)toast('Aktualizacje są dostępne w aplikacji Android');
    return;
  }

  if(wolfUpdateTimeout){
    clearTimeout(wolfUpdateTimeout);
    wolfUpdateTimeout=null;
  }

  // Tylko ręczne sprawdzanie blokuje przycisk. Automatyczne sprawdzanie
  // przy starcie działa w tle i nie unieruchamia interfejsu.
  wolfUpdate.checking=!!userInitiated;
  wolfUpdate.message='';

  if(currentPage==='settings')settings();

  try{
    WolfUpdate.getCurrentVersion();
  }catch(e){
    toast('DEBUG getCurrentVersion: '+String(e));
  }

  try{
    WolfUpdate.checkForUpdates(!!userInitiated);
    if(userInitiated)toast('DEBUG: wywołanie checkForUpdates wysłane');
  }catch(e){
    wolfUpdate.checking=false;
    wolfUpdate.ok=false;
    wolfUpdate.message='DEBUG checkForUpdates: '+String(e);

    if(currentPage==='settings')settings();
    toast(wolfUpdate.message);
    return;
  }

  if(userInitiated){
    wolfUpdateTimeout=setTimeout(()=>{
      if(!wolfUpdate.checking)return;

      wolfUpdate.checking=false;
      wolfUpdate.ok=false;
      wolfUpdate.message='Przekroczono czas sprawdzania aktualizacji (15 s). Spróbuj ponownie.';

      if(currentPage==='settings')settings();
      toast(wolfUpdate.message);
    },15000);
  }
}

function installWolfUpdate(){
  if(!hasUpdateBridge()||!wolfUpdate.available||!wolfUpdate.apkUrl)return;
  wolfUpdate.downloadState='starting';wolfUpdate.message='Przygotowuję pobieranie…';
  if(currentPage==='settings')settings();
  WolfUpdate.downloadAndInstall(wolfUpdate.apkUrl,wolfUpdate.versionName||'aktualizacja');
}

window.wolfUpdateCurrent=function(info){
  info=info||{};
  wolfUpdate.currentVersionName=info.versionName||wolfUpdate.currentVersionName;
  wolfUpdate.currentVersionCode=Number(info.versionCode||wolfUpdate.currentVersionCode||0);
  if(currentPage==='settings')settings();
};

window.wolfUpdateResult=function(result){
  if(wolfUpdateTimeout){
    clearTimeout(wolfUpdateTimeout);
    wolfUpdateTimeout=null;
  }

  result=result||{};
  wolfUpdate.checking=false;
  wolfUpdate.ok=!!result.ok;
  wolfUpdate.available=!!result.available;
  wolfUpdate.currentVersionName=result.currentVersionName||wolfUpdate.currentVersionName;
  wolfUpdate.currentVersionCode=Number(result.currentVersionCode||wolfUpdate.currentVersionCode||0);
  wolfUpdate.versionName=result.versionName||'';
  wolfUpdate.versionCode=Number(result.versionCode||0);
  wolfUpdate.apkUrl=result.apkUrl||'';
  wolfUpdate.changelog=result.changelog||'';
  wolfUpdate.mandatory=!!result.mandatory;
  wolfUpdate.message=result.message||'';

  if(result.userInitiated){
    toast(wolfUpdate.ok?(wolfUpdate.available?`Dostępna aktualizacja ${wolfUpdate.versionName}`:'WolfEdu jest aktualne'):(wolfUpdate.message||'Nie udało się sprawdzić aktualizacji'));
  }else if(wolfUpdate.available){
    toast(`Dostępna aktualizacja WolfEdu ${wolfUpdate.versionName}`);
  }
  if(currentPage==='settings')settings();
  if(currentPage==='home'&&typeof home==='function')home();
};

window.wolfUpdateDownload=function(result){
  result=result||{};
  wolfUpdate.downloadState=result.state||'';
  wolfUpdate.message=result.message||'';
  if(result.message)toast(result.message);
  if(currentPage==='settings')settings();
};

function initWolfUpdates(){
  if(!hasUpdateBridge())return;
  WolfUpdate.getCurrentVersion();
  setTimeout(()=>checkWolfUpdate(false),1800);
}
