function applyTheme(){document.documentElement.dataset.theme=localStorage.getItem('wolfEduTheme')||'light'}function toggleTheme(){localStorage.setItem('wolfEduTheme',localStorage.getItem('wolfEduTheme')==='dark'?'light':'dark');applyTheme();settings()}applyTheme();document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>render(b.dataset.page));render();if(hasSyncBridge())setTimeout(()=>{
  try{WolfSync.requestAuthState()}catch(e){console.error('requestAuthState',e)}
  WolfSync.requestRemoteData();
  WolfSync.requestSchoolData();
},450);setTimeout(()=>document.getElementById('splash')?.classList.add('hide'),700);;if(typeof initWolfUpdates==='function')initWolfUpdates();
