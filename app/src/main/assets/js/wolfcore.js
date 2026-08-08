(function(){
  const timers=new Map();

  function notify(message){
    try{
      if(typeof toast==='function')toast(message);
      else console.warn('[WolfCore]',message);
    }catch(_){console.warn('[WolfCore]',message)}
  }

  function clearWatch(key){
    const timer=timers.get(key);
    if(timer)clearTimeout(timer);
    timers.delete(key);
  }

  function watch(key,ms=15000,message='Operacja trwała zbyt długo.',onTimeout=null){
    clearWatch(key);
    const timer=setTimeout(()=>{
      timers.delete(key);
      try{if(typeof onTimeout==='function')onTimeout()}catch(e){console.error(e)}
      notify(message);
    },ms);
    timers.set(key,timer);
    return key;
  }

  async function withTimeout(promise,ms=15000,message='Operacja trwała zbyt długo.'){
    let timer;
    try{
      return await Promise.race([
        Promise.resolve(promise),
        new Promise((_,reject)=>{
          timer=setTimeout(()=>reject(new Error(message)),ms);
        })
      ]);
    }finally{
      if(timer)clearTimeout(timer);
    }
  }

  async function fetchWithTimeout(url,options={},ms=15000,message='Serwer nie odpowiedział w wymaganym czasie.'){
    return withTimeout(fetch(url,options),ms,message);
  }

  function bridgeTask(key,invoke,{ms=15000,message='Operacja nie odpowiedziała.',onTimeout=null}={}){
    watch(key,ms,message,onTimeout);
    try{
      invoke();
      return true;
    }catch(e){
      clearWatch(key);
      notify((e&&e.message)?e.message:String(e));
      return false;
    }
  }

  function finish(key){clearWatch(key)}
  function finishPrefix(prefix){
    [...timers.keys()].filter(k=>String(k).startsWith(prefix)).forEach(clearWatch);
  }

  window.WolfCore={
    withTimeout,
    fetch:fetchWithTimeout,
    watch,
    finish,
    finishPrefix,
    bridgeTask,
    timeouts:{network:15000,sync:20000,download:180000}
  };
})();
