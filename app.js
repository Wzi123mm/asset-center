const DB_NAME='asset-center-db', STORE='state';
let state={assets:[],flows:[],rate:7.2};
let currentFilter='all';
const $=s=>document.querySelector(s);
const money=(n,c='CNY')=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:c,maximumFractionDigits:2}).format(Number(n)||0);
const toCNY=(n,c)=>c==='USD'?Number(n)*state.rate:Number(n);
const uid=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random();
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function load(){try{const db=await openDB();const value=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const r=tx.objectStore(STORE).get('main');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});if(value)state=value;db.close()}catch(e){console.warn(e)}}
async function save(){try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(state,'main');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch(e){toast('保存失败：请检查 Safari 存储权限')}}
function toast(msg){const el=$('#toast');el.textContent=msg;el.style.display='block';setTimeout(()=>el.style.display='none',2200)}
function cnyAssets(){return state.assets.reduce((s,a)=>s+toCNY(assetValue(a),a.currency),0)}
function assetValue(a){return ['A股','美股','基金'].includes(a.category)?Number(a.quantity||0)*Number(a.price||0):Number(a.price||0)}
function monthFlows(type){const now=new Date();return state.flows.filter(f=>f.type===type&&new Date(f.date+'T12:00:00').getMonth()===now.getMonth()&&new Date(f.date+'T12:00:00').getFullYear()===now.getFullYear()).reduce((s,f)=>s+toCNY(f.amount,f.currency),0)}
function render(){
  $('#total').textContent=money(cnyAssets());
  const usd=state.assets.filter(a=>a.currency==='USD').reduce((s,a)=>s+assetValue(a),0);
  $('#usdtotal').textContent=`美元资产 ${money(usd,'USD')}`;
  $('#assetcount').textContent=`${state.assets.length} 项资产`;
  $('#rateLabel').textContent=`USD/CNY ${Number(state.rate).toFixed(4)}`;
  $('#monthIncome').textContent=money(monthFlows('收入'));
  $('#monthExpense').textContent=money(monthFlows('支出'));
  $('#investmentTotal').textContent=money(state.assets.filter(a=>['A股','美股','基金'].includes(a.category)).reduce((s,a)=>s+toCNY(assetValue(a),a.currency),0));
  $('#cashTotal').textContent=money(state.assets.filter(a=>!['A股','美股','基金'].includes(a.category)).reduce((s,a)=>s+toCNY(assetValue(a),a.currency),0));
  $('#assetNum').textContent=`${state.assets.length} 项`;
  const cats=[...new Set(state.assets.map(a=>a.category))].map(cat=>({cat,val:state.assets.filter(a=>a.category===cat).reduce((s,a)=>s+toCNY(assetValue(a),a.currency),0)})).sort((a,b)=>b.val-a.val);
  const sum=cnyAssets();
  $('#allocation').innerHTML=cats.length?cats.map(x=>`<div class="barrow"><span>${esc(x.cat)}</span><div class="track"><div class="fill" style="width:${sum?Math.max(1,x.val/sum*100):0}%"></div></div><b>${money(x.val)}</b></div>`).join(''):'<div class="empty">添加资产后，这里会显示资产分布</div>';
  $('#assetList').innerHTML=state.assets.length?state.assets.map(a=>`<div class="item"><div class="ico">${icon(a.category)}</div><div class="grow"><div class="name">${esc(a.name)}</div><div class="meta">${esc(a.category)}${a.code?' · '+esc(a.code):''}${a.category==='定期存款'&&a.maturity?' · 到期 '+esc(a.maturity):''}</div></div><div class="amount">${money(assetValue(a),a.currency)}<small>${a.currency==='USD'?money(toCNY(assetValue(a),a.currency)):a.category==='A股'||a.category==='美股'||a.category==='基金'?`${a.quantity} × ${money(a.price,a.currency)}`:'折合 '+money(toCNY(assetValue(a),a.currency))}</small></div><button class="x" aria-label="删除" onclick="deleteAsset('${a.id}')">×</button></div>`).join(''):'<div class="empty">还没有资产，点击上方添加</div>';
  const flows=[...state.flows].sort((a,b)=>b.date.localeCompare(a.date));
  $('#recentFlows').innerHTML=flows.slice(0,3).map(flowHTML).join('')||'<div class="empty">还没有流水记录</div>';
  const shown=flows.filter(f=>currentFilter==='all'||f.type===currentFilter);
  $('#flowList').innerHTML=shown.map(f=>flowHTML(f,true)).join('')||'<div class="empty">没有符合条件的流水</div>';
  $('#exchangeRate').value=state.rate;
}
function icon(cat){return ({'现金':'＄','银行存款':'▤','定期存款':'◷','A股':'📈','美股':'📊','基金':'◩','其他资产':'◇'})[cat]||'◇'}
function flowHTML(f,del=false){const sign=f.type==='收入'?'+':f.type==='支出'?'−':'';const cls=f.type==='收入'?'green':f.type==='支出'?'red':'gold';return `<div class="item"><div class="ico">${f.type==='收入'?'↓':f.type==='支出'?'↑':'⇄'}</div><div class="grow"><div class="name">${esc(f.title)}</div><div class="meta">${esc(f.date)} · ${esc(f.type)}${f.note?' · '+esc(f.note):''}</div></div><div class="amount ${cls}">${sign}${money(f.amount,f.currency)}</div>${del?`<button class="x" onclick="deleteFlow('${f.id}')">×</button>`:''}</div>`}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
window.deleteAsset=async id=>{if(confirm('确定删除这项资产？')){state.assets=state.assets.filter(a=>a.id!==id);await save();render()}};
window.deleteFlow=async id=>{if(confirm('确定删除这条流水？')){state.flows=state.flows.filter(f=>f.id!==id);await save();render()}};
function go(id){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.go===id));window.scrollTo(0,0)}
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.close).close()));
$('#addAsset').onclick=()=>$('#assetDialog').showModal();$('#addFlow').onclick=()=>{$('#flowForm').elements.date.value=new Date().toISOString().slice(0,10);$('#flowDialog').showModal()};
function updateAssetFields(){const cat=$('#assetCategory').value,inv=['A股','美股','基金'].includes(cat),dep=cat==='定期存款';$('#codeWrap').hidden=!inv;$('#quantityWrap').hidden=!inv;$('#rateWrap').hidden=!dep;$('#maturityWrap').hidden=!dep;$('#priceLabel').textContent=inv?'当前单价': '金额 / 本金';}
$('#assetCategory').onchange=updateAssetFields;updateAssetFields();
$('#assetForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),cat=f.get('category');const item={id:uid(),name:f.get('name').trim(),category:cat,code:f.get('code').trim(),quantity:Number(f.get('quantity')||1),price:Number(f.get('price')),currency:f.get('currency'),annualRate:Number(f.get('annualRate')||0),maturity:f.get('maturity')||''};if(!item.name||!Number.isFinite(item.price)||item.price<0||(['A股','美股','基金'].includes(cat)&&(!Number.isFinite(item.quantity)||item.quantity<=0)))return toast('请检查填写内容');state.assets.push(item);await save();render();e.target.reset();updateAssetFields();$('#assetDialog').close();toast('资产已保存到本机')};
$('#flowForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const item={id:uid(),title:f.get('title').trim(),type:f.get('type'),date:f.get('date'),amount:Number(f.get('amount')),currency:f.get('currency'),note:f.get('note').trim()};if(!item.title||!item.date||!Number.isFinite(item.amount)||item.amount<=0)return toast('请检查填写内容');state.flows.push(item);await save();render();e.target.reset();$('#flowDialog').close();toast('流水已保存到本机')};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{currentFilter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));render()});
$('#saveRate').onclick=async()=>{const r=Number($('#exchangeRate').value);if(!Number.isFinite(r)||r<=0)return toast('请输入有效汇率');state.rate=r;await save();render();toast('汇率已更新')};
$('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='asset-center-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);};
$('#importData').onclick=()=>$('#importFile').click();
$('#importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed.assets)||!Array.isArray(parsed.flows)||!(Number(parsed.rate)>0))throw Error();if(!confirm('导入将覆盖当前全部数据，确定继续？'))return;state=parsed;await save();render();toast('备份导入成功')}catch{toast('文件格式无效或无法读取')}e.target.value=''};
$('#resetData').onclick=async()=>{if(confirm('确定清空所有本机资产和流水？此操作不可撤销。')){state={assets:[],flows:[],rate:7.2};await save();render();toast('本机数据已清空')}};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
(async()=>{await load();render()})();
