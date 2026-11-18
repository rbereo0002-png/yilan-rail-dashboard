// One ephemeral sign-in screen shared by executive and operator pages.
// Never writes authentication tokens or project payloads to localStorage/sessionStorage.
export function requireCentralLogin(store,onReady){
  let panel=document.getElementById('centralLoginPanel');
  if(!panel){
    panel=document.createElement('section');
    panel.id='centralLoginPanel';
    panel.setAttribute('role','region');
    panel.setAttribute('aria-label','中央資料庫登入');
    panel.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#e8eff7;padding:20px';
    panel.innerHTML=`<form id="centralLoginForm" style="width:min(440px,100%);background:white;border-radius:14px;padding:30px;box-shadow:0 8px 36px #0002">
      <h2 style="margin:0 0 12px">宜蘭高架｜統一履約管制</h2>
      <p>請使用已獲授權的測試資料庫帳號登入。登入資訊僅保留於目前頁面，不寫入瀏覽器儲存空間。</p>
      <label style="display:block;margin-top:16px">電子郵件<input name="email" type="email" required autocomplete="username" style="display:block;width:100%;box-sizing:border-box"></label>
      <label style="display:block;margin-top:14px">密碼<input name="password" type="password" required autocomplete="current-password" style="display:block;width:100%;box-sizing:border-box"></label>
      <button type="submit" style="display:block;width:100%;margin-top:20px;padding:12px">登入並載入中央資料</button>
      <p role="alert" id="centralLoginError" style="color:#9b1c1c"></p>
    </form>`;
    document.body.appendChild(panel);
  }
  panel.hidden=false;panel.style.display='flex';
  panel.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget,btn=form.querySelector('button'),error=form.querySelector('[role=alert]');
    btn.disabled=true;error.textContent='';
    try{
      await store.login(form.elements.email.value,form.elements.password.value);
      form.elements.password.value='';
      await onReady();
      panel.hidden=true;panel.style.display='none';
    }catch(e){store.logout();error.textContent=e.message||'登入失敗';}
    finally{btn.disabled=false;}
  },{once:false});
}
