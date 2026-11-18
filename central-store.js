// Dormant development adapter: not imported by the no-account production UI.
// The assistant uses server-side connected tools to maintain the central database.
// Do not embed database endpoint, public credentials or secret/service keys in the site.
const allowed=new Set(['north','south']);
function projectId(id){if(!allowed.has(id))throw new Error('不支援的標段');return id;}
export function createCentralStore({api,key,transport=fetch}={}){
  if(!api||!key)throw new Error('中央資料庫設定未提供');
  let token=null,refreshToken=null,expiry=0;
  const headers=(prefer)=>({'apikey':key,'Authorization':'Bearer '+(token||key),
    'Content-Type':'application/json',...(prefer?{'Prefer':prefer}:{})});
  const request=async(path,{method='GET',body,prefer}={})=>{
    if(!token)throw new Error('請先登入共用資料庫');
    const response=await transport(api+path,{method,headers:headers(prefer),...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
    if(!response.ok)throw new Error('中央資料庫回應 '+response.status+'；請確認帳號權限與網路狀態');
    return response.status===204?[]:response.json();
  };
  const clear=()=>{token=null;refreshToken=null;expiry=0;};
  const login=async(email,password)=>{
    clear();
    const response=await transport(api+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'apikey':key,'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),cache:'no-store'});
    if(!response.ok)throw new Error('登入失敗，請確認帳號及密碼');
    const data=await response.json();
    token=data.access_token;refreshToken=data.refresh_token;
    expiry=Date.now()+(Number(data.expires_in||3600)*1000);
    return true;
  };
  const refresh=async()=>{
    if(!token)throw new Error('尚未登入');
    if(expiry-Date.now()>60000)return;
    if(!refreshToken){clear();throw new Error('登入期限已到，請重新登入');}
    const response=await transport(api+'/auth/v1/token?grant_type=refresh_token',{method:'POST',
      headers:{'apikey':key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refreshToken}),cache:'no-store'});
    if(!response.ok){clear();throw new Error('登入期限已到，請重新登入');}
    const data=await response.json();token=data.access_token;refreshToken=data.refresh_token;expiry=Date.now()+Number(data.expires_in||3600)*1000;
  };
  const memberships=async()=>{await refresh();return request('/rest/v1/rail_control_members?select=project_key,role');};
  const load=async(id)=>{await refresh();const rows=await request('/rest/v1/rail_control_snapshots?project_key=eq.'+projectId(id)+'&select=project_key,revision,document');if(rows.length!==1)throw new Error('此帳號無權讀取標段 '+id);return rows[0];};
  const save=async(id,document,expectedRevision)=>{
    await refresh();
    projectId(id);
    if(document?.id!==id)throw new Error('標段識別碼不符');
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw new Error('缺少合法的版本號');
    const rows=await request('/rest/v1/rail_control_snapshots?project_key=eq.'+id+'&revision=eq.'+expectedRevision+'&select=project_key,revision',
      {method:'PATCH',body:{document,revision:expectedRevision+1},prefer:'return=representation'});
    if(rows.length!==1)throw new Error('其他使用者已更新資料；請重新載入後比較差異，不可覆寫');
    return rows[0].revision;
  };
  return {login,logout:clear,memberships,load,save,isLoggedIn:()=>Boolean(token)};
}
