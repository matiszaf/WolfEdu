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

async function checkWolfUpdate(userInitiated=false){
  if(wolfUpdate.checking)return;
  wolfUpdate.checking=true;wolfUpdate.ok=true;wolfUpdate.message='';
  if(currentPage==='settings')settings();
  try{
    if(typeof WolfUpdate!=='undefined'&&WolfUpdate&&WolfUpdate.getCurrentVersion)WolfUpdate.getCurrentVersion();
    const url='https://raw.githubusercontent.com/matiszaf/WolfEdu-Releases/main/version.json?t='+Date.now();
    const response=await WolfCore.fetch(url,{method:'GET',cache:'no-store'},15000,'Przekroczono czas sprawdzania aktualizacji.');
    if(!response.ok)throw new Error('HTTP '+response.status);
    const result=await WolfCore.withTimeout(response.json(),5000,'Nie udało się odczytać manifestu aktualizacji.');
    wolfUpdate.versionName=result.versionName||'';
    wolfUpdate.versionCode=Number(result.versionCode||0);
    wolfUpdate.apkUrl=result.apkUrl||'';
    wolfUpdate.changelog=result.changelog||'';
    wolfUpdate.mandatory=!!result.mandatory;
    wolfUpdate.available=wolfUpdate.versionCode>Number(wolfUpdate.currentVersionCode||0)&&!!wolfUpdate.apkUrl;
    wolfUpdate.ok=true;
    if(userInitiated)toast(wolfUpdate.available?`Dostępna aktualizacja ${wolfUpdate.versionName}`:'WolfEdu jest aktualne');
    else if(wolfUpdate.available)toast(`Dostępna aktualizacja WolfEdu ${wolfUpdate.versionName}`);
  }catch(e){
    wolfUpdate.ok=false;
    wolfUpdate.message=(e&&e.message)?e.message:'Nie udało się sprawdzić aktualizacji.';
    if(userInitiated)toast(wolfUpdate.message);
  }finally{
    wolfUpdate.checking=false;
    if(currentPage==='settings')settings();
    if(currentPage==='home'&&typeof home==='function')home();
  }
}
function installWolfUpdate(){
  if(!hasUpdateBridge()||!wolfUpdate.available||!wolfUpdate.apkUrl)return;
  wolfUpdate.downloadState='starting';wolfUpdate.message='Przygotowuję pobieranie…';
  if(currentPage==='settings')settings();
  WolfCore.watch('ota-download',WolfCore.timeouts.download,'Pobieranie aktualizacji trwało zbyt długo.',()=>{wolfUpdate.downloadState='timeout';wolfUpdate.message='Pobieranie przekroczyło limit czasu. Możesz spróbować ponownie.';if(currentPage==='settings')settings()});
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
  if(['downloaded','error','installing','permission'].includes(result.state||''))WolfCore.finish('ota-download');
  wolfUpdate.downloadState=result.state||'';
  wolfUpdate.message=result.message||'';
  if(result.message)toast(result.message);
  if(currentPage==='settings')settings();
};

function initWolfUpdates(){
  if(!hasUpdateBridge())return;
  WolfUpdate.getCurrentVersion();
}
