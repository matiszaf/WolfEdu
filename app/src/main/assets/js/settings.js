function settings(){
  setHead('Ustawienia',wolfSchool.schoolName||db.school);

  const dark=localStorage.getItem('wolfEduTheme')==='dark';

  const schoolOptions=(wolfSchool.schools||[])
    .map(s=>`
      <option
        value="${esc(s.id)}"
        ${s.id===wolfSchool.activeSchoolId?'selected':''}>
        ${esc(s.name||'Szkoła')}
      </option>
    `)
    .join('');

  const profileInitial=esc(
    (syncEmail||wolfSchool.schoolName||db.school||'W')
      .charAt(0)
      .toUpperCase()
  );

  const profileRole=esc(wolfSchool.role||'brak');
  const profileSchool=esc(wolfSchool.schoolName||'brak aktywnej szkoły');
  const invitesCount=(wolfSchool.myInvites||[]).length;

  app.innerHTML=`
    <section class="settings-page">

      <section class="settings-profile-card">
        <div class="settings-profile-main">
          <div class="settings-avatar">${profileInitial}</div>

          <div class="settings-profile-copy">
            <div class="settings-eyebrow">PROFIL WOLFEDU</div>

            <h2>
              ${syncLoggedIn
                ? esc(syncEmail||'Konto WolfEdu')
                : 'Nie połączono z WolfCloud'}
            </h2>

            <p>
              ${syncLoggedIn
                ? `${profileRole} · ${profileSchool}`
                : 'Zaloguj się, aby synchronizować dane między urządzeniami.'}
            </p>
          </div>
        </div>

        ${syncLoggedIn
          ? `
            <div class="settings-school-picker">
              <label for="activeSchoolSelect">Aktywna szkoła</label>

              ${schoolOptions
                ? `
                  <select
                    id="activeSchoolSelect"
                    onchange="changeActiveSchool(this.value)">
                    ${schoolOptions}
                  </select>
                `
                : `
                  <div class="settings-inline-warning">
                    Nie znaleziono szkół przypisanych do tego konta.
                  </div>
                `
              }
            </div>
          `
          : ''
        }
      </section>

      <section class="settings-grid">

        <div class="settings-card settings-card-wide">
          <div class="settings-card-head">
            <div>
              <div class="settings-icon">☁</div>
              <div>
                <h3>WolfCloud</h3>
                <p>Synchronizacja danych i logowanie</p>
              </div>
            </div>

            ${syncLoggedIn
              ? `<span class="settings-status ${syncState}">${esc(syncTitle)}</span>`
              : `<span class="settings-status offline">offline</span>`
            }
          </div>

          ${syncLoggedIn
            ? `
              <div class="settings-sync-row">
                <span class="bigdot ${syncState}"></span>

                <div>
                  <b>${esc(syncTitle)}</b>
                  <small>${esc(syncDetail)}</small>
                </div>
              </div>

              <div class="settings-sync-email">
                ${esc(syncEmail)}
              </div>

              <div class="settings-actions-two">
                <button onclick="syncNow(this)">
                  Synchronizuj teraz
                </button>

                <button class="secondary" onclick="logoutSync(this)">
                  Wyloguj
                </button>
              </div>

              <div class="settings-note">
                Szkoła, klasy, uczniowie, przedmioty, nauczyciele,
                plan, oceny, zadania i frekwencja korzystają z WolfCloud realtime.
              </div>
            `
            : `
              <div class="settings-login-box">
                <div class="settings-sync-row">
                  <span class="bigdot"></span>

                  <div>
                    <b>Połącz urządzenia</b>
                    <small>Zaloguj się lub utwórz konto WolfEdu.</small>
                  </div>
                </div>

                <input
                  id="syncEmail"
                  type="email"
                  autocomplete="email"
                  placeholder="Adres e-mail">

                <input
                  id="syncPassword"
                  type="password"
                  autocomplete="current-password"
                  placeholder="Hasło (minimum 6 znaków)">

                <div class="settings-actions-two">
                  <button onclick="loginSync(this)">Zaloguj</button>
                  <button class="secondary" onclick="registerSync(this)">
                    Utwórz konto
                  </button>
                </div>
              </div>
            `
          }
        </div>


        ${syncLoggedIn && invitesCount
          ? `
            <div class="settings-card">
              <div class="settings-card-head">
                <div>
                  <div class="settings-icon">✉</div>
                  <div>
                    <h3>Zaproszenia</h3>
                    <p>Oczekujące dostępy do szkół</p>
                  </div>
                </div>

                <span class="settings-count">${invitesCount}</span>
              </div>

              <div class="settings-list-row">
                <div>
                  <b>
                    ${invitesCount===1
                      ? 'Masz 1 oczekujące zaproszenie'
                      : `Masz ${invitesCount} oczekujących zaproszeń`}
                  </b>
                  <small>Zaakceptuj albo odrzuć dostęp.</small>
                </div>

                <button onclick="render('myInvitesPage')">Otwórz</button>
              </div>
            </div>
          `
          : ''
        }

        <div class="settings-card settings-card-wide">
          ${typeof updateCardHtml==='function'
            ? updateCardHtml()
            : `
              <div class="settings-card-head">
                <div>
                  <div class="settings-icon">↻</div>
                  <div>
                    <h3>Aktualizacje</h3>
                    <p>Moduł aktualizacji jest niedostępny.</p>
                  </div>
                </div>
              </div>
            `
          }
        </div>

        <div class="settings-card">
          <div class="settings-card-head">
            <div>
              <div class="settings-icon">◐</div>
              <div>
                <h3>Wygląd</h3>
                <p>Motyw aplikacji</p>
              </div>
            </div>
          </div>

          <div class="settings-list-row">
            <div>
              <b>Tryb ciemny</b>
              <small>${dark?'Włączony':'Wyłączony'}</small>
            </div>

            <button class="secondary" onclick="toggleTheme()">
              ${dark?'Wyłącz':'Włącz'}
            </button>
          </div>
        </div>

        <div class="settings-card">
          <div class="settings-card-head">
            <div>
              <div class="settings-icon">⇩</div>
              <div>
                <h3>Kopia danych</h3>
                <p>Eksport i import lokalnej kopii</p>
              </div>
            </div>
          </div>

          <div class="settings-note">
            Eksport zapisuje lokalną kopię awaryjną.
            Dane WolfCloud pozostają w Firestore.
          </div>

          <button
            class="btn-full"
            style="margin-top:12px"
            onclick="exportData(this)">
            Eksportuj kopię JSON
          </button>

          <label class="settings-file-label">
            <span>Importuj kopię JSON</span>
            <input
              id="importFile"
              type="file"
              accept="application/json"
              onchange="importData(event)">
          </label>
        </div>

        ${syncLoggedIn
          ? `
            <div class="settings-card settings-card-wide">
              <div class="settings-card-head">
                <div>
                  <div class="settings-icon">⌘</div>
                  <div>
                    <h3>Zaawansowane</h3>
                    <p>Informacje techniczne</p>
                  </div>
                </div>
              </div>

              <div class="settings-tech-grid">
                <div>
                  <small>UID konta</small>
                  <code>${esc(syncUid||'—')}</code>
                </div>

                <div>
                  <small>Baza Firestore</small>
                  <code>default</code>
                </div>

                <div>
                  <small>Aktywna szkoła</small>
                  <code>${esc(wolfSchool.activeSchoolId||'brak')}</code>
                </div>

                <div>
                  <small>Rola</small>
                  <code>${profileRole}</code>
                </div>
              </div>
            </div>
          `
          : ''
        }

      </section>

      <div class="settings-version">
        WolfEdu 0.10.5 · OTA v2
      </div>

    </section>
  `;
}

function changeActiveSchool(id){
  if(hasSyncBridge()&&id){
    WolfSync.setActiveSchool(id);
    toast('Zmieniam aktywną szkołę…');
  }
}

function renameSchool(){
  let v=$('#sName')?.value?.trim();
  if(v){
    db.school=v;
    save();
    settings();
    toast('Zapisano');
  }
}

function exportData(btn){
  if(btn){
    btn.classList.add('btn-busy');
    btn.textContent='Otwieram zapis…';
  }

  let json=JSON.stringify(db,null,2);

  if(typeof WolfNative!=='undefined'&&WolfNative.exportJson){
    WolfNative.exportJson(json);
  }else{
    let blob=new Blob([json],{type:'application/json'});
    let a=document.createElement('a');

    a.href=URL.createObjectURL(blob);
    a.download='wolfedu-kopia.json';
    a.click();

    setTimeout(()=>URL.revokeObjectURL(a.href),1000);

    if(btn){
      btn.classList.remove('btn-busy');
      btn.textContent='Eksportuj kopię JSON';
    }
  }
}

window.wolfNativeExportResult=function(ok,msg){
  toast(msg||(ok?'Kopia zapisana':'Nie udało się zapisać'));

  if(currentPage==='settings'){
    settings();
  }
};

function importData(e){
  let f=e.target.files[0];
  if(!f)return;

  let r=new FileReader();

  r.onload=()=>{
    try{
      db=JSON.parse(r.result);
      save();
      render('home');
      toast('Kopia wczytana');
    }catch{
      toast('Nieprawidłowy plik');
    }
  };

  r.readAsText(f);
}

function resetAll(){
  if(confirm('Na pewno usunąć cały dziennik lokalnie i w chmurze?')){
    db={
      school:'',
      classes:[],
      students:[],
      grades:[],
      attendance:[],
      lessons:[],
      tasks:[],
      _sync:{updatedAt:Date.now()}
    };

    save();
    setup();
  }
}
