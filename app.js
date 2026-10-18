'use strict';
const S={user:null,cfg:{},cart:[],disc:0,method:'cash',cust:null,paid:0,got:0};
let F={V:[]},RES=[],LQ=[],CL=[],CATS=[],SALE=null,PG=0,busy=false,RP={f:'',t:'',g:'day'};
const ICO={"home": "<path d=\"M3 10.5 12 3l9 7.5V21H3z\"/><path d=\"M9 21v-6h6v6\"/>", "cart": "<circle cx=\"9\" cy=\"20\" r=\"1.5\"/><circle cx=\"18\" cy=\"20\" r=\"1.5\"/><path d=\"M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H6\"/>", "shirt": "<path d=\"M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z\"/>", "plus": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 8v8M8 12h8\"/>", "import": "<path d=\"M12 3v12M7 10l5 5 5-5M4 21h16\"/>", "barcode": "<path d=\"M4 5v14M8 5v14M12 5v14M16 5v14M20 5v14\"/>", "box": "<path d=\"M21 8 12 3 3 8v8l9 5 9-5z\"/><path d=\"m3 8 9 5 9-5M12 13v8\"/>", "receipt": "<path d=\"M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z\"/><path d=\"M9 8h6M9 12h6\"/>", "users": "<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20a6.5 6.5 0 0 1 13 0\"/><path d=\"M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6\"/>", "wallet": "<path d=\"M3 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><path d=\"M3 7V6a2 2 0 0 1 2-2h12\"/><circle cx=\"16.5\" cy=\"14\" r=\"1.2\"/>", "chart": "<path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"/>", "lock": "<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>", "gear": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1\"/>", "camera": "<path d=\"M4 8h3l2-3h6l2 3h3v11H4z\"/><circle cx=\"12\" cy=\"13\" r=\"3.5\"/>", "printer": "<path d=\"M7 9V3h10v6M7 17H4v-7h16v7h-3\"/><path d=\"M7 14h10v7H7z\"/>", "moon": "<path d=\"M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z\"/>", "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5\"/>", "key": "<circle cx=\"8\" cy=\"15\" r=\"4\"/><path d=\"m11 12 9-9M16 7l3 3\"/>", "out": "<path d=\"M9 4H5v16h4M16 8l4 4-4 4M20 12H9\"/>", "pause": "<path d=\"M8 5v14M16 5v14\"/>", "down": "<path d=\"M12 4v11M7 11l5 5 5-5M5 20h14\"/>", "up": "<path d=\"M12 16V5M7 9l5-5 5 5M5 20h14\"/>"};
const ic=n=>`<svg class=i viewBox="0 0 24 24" aria-hidden=true>${ICO[n]}</svg>`;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('en-US');
const can=p=>!!S.user&&S.user.perms.includes(p);
const money=n=>fmt(n)+' '+(S.cfg.currency||'');
const today=()=>new Date().toLocaleDateString('sv-SE');
const addDays=(d,n)=>{const x=new Date(d+'T00:00:00');x.setDate(x.getDate()+n);return x.toLocaleDateString('sv-SE')};
const debounce=(f,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>f(...a),ms)}};
const vt=v=>esc([v.size,v.color].filter(Boolean).join(' / '));
let tt;const toast=(m,bad)=>{const t=$('#toast');t.textContent=m;t.className='show'+(bad?' bad':'');clearTimeout(tt);tt=setTimeout(()=>t.className='',3000)};
const modal=h=>{$('#modal').innerHTML=`<div class=ov onclick="if(event.target===this)closeModal()"><div class=dlg>${h}</div></div>`};
const closeModal=()=>{$('#modal').innerHTML=''};
const beep=()=>{try{const a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator();o.connect(a.destination);o.frequency.value=880;o.start();setTimeout(()=>{o.stop();a.close()},80)}catch{}};
const tb=(h,r)=>`<div class=tw><table class=tbl><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.map(x=>`<tr>${x.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
const MT={cash:'نقدي',card:'بطاقة',credit:'آجل'};
const MV={sale:'بيع',return:'مرتجع',add:'استلام',adjust:'جرد/تعديل',initial:'افتتاحي',import:'استيراد'};

async function api(u,o={}){
  try{return await Local.api(u,o)}
  catch(e){
    if(e.code===401&&S.user&&u!=='/login'){S.user=null;render()}
    throw e;
  }
}
addEventListener('unhandledrejection',e=>{e.preventDefault();const m=e.reason&&e.reason.message||'خطأ';toast(m,1)});

const dl=(name,text,mime)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime||'text/csv'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)};
const csv=rows=>'\uFEFF'+rows.map(r=>r.map(c=>{c=String(c??'');return /[",\n;]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\n');
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch{return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const applyTheme=()=>{const t=lsGet('pos_theme',null);if(t)document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme};
applyTheme();
const isDark=()=>document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme:dark)').matches);

/* ---------- printing ---------- */
function printHTML(body,css){
  const f=document.createElement('iframe');
  f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d=f.contentWindow.document;
  d.open();d.write(`<!doctype html><html dir=rtl><head><meta charset=utf-8><style>${css}</style></head><body>${body}</body></html>`);d.close();
  setTimeout(()=>{f.contentWindow.focus();f.contentWindow.print();setTimeout(()=>f.remove(),60000)},300);
}
function receiptHTML(s){
  const c=S.cfg,ret=s.type==='return';
  const rows=s.items.map(i=>`<tr><td>${esc(i.name)}${i.size||i.color?`<br><small>${vt(i)}</small>`:''}</td><td>${Math.abs(i.qty)}</td><td>${fmt(Math.abs(i.line_total))}</td></tr>`).join('');
  return `<div class=c><span class=t>${esc(c.shop_name)}</span><br>${esc(c.shop_phone)} ${esc(c.shop_address)}</div><hr><div>${ret?'وصل إرجاع':'وصل بيع'} #${s.id}<br>${esc(s.created_at)}<br>الكاشير: ${esc(s.cashier)}${s.customer?'<br>الزبون: '+esc(s.customer):''}</div><hr><table><tr><th>الصنف</th><th>عدد</th><th>مبلغ</th></tr>${rows}</table><hr>`+
   (s.discount?`<div class=r><span>المجموع</span><span>${fmt(s.subtotal)}</span></div><div class=r><span>الخصم</span><span>${fmt(s.discount)}</span></div>`:'')+
   `<div class="r t"><span>الإجمالي</span><span>${money(Math.abs(s.total))}</span></div>`+
   (s.method==='credit'&&!ret?`<div class=r><span>المدفوع</span><span>${fmt(s.paid)}</span></div><div class=r><span>المتبقي</span><span>${fmt(s.total-s.paid)}</span></div>`:'')+
   `<hr><div class=c>${esc(c.receipt_footer)}</div>`;
}
const RCSS=w=>`@page{size:${w}mm auto;margin:0}body{margin:0 auto;width:${w-8}mm;font:12px Tahoma,Arial,sans-serif;color:#000}table{width:100%;border-collapse:collapse}td,th{padding:2px 0;text-align:start;vertical-align:top}td:not(:first-child),th:not(:first-child){text-align:end;white-space:nowrap}hr{border:0;border-top:1px dashed #000}.c{text-align:center}.t{font-size:15px;font-weight:700}.r{display:flex;justify-content:space-between}small{font-size:10px}`;
const printReceipt=s=>printHTML(receiptHTML(s),RCSS(+S.cfg.paper_mm||80));
function printLabels(a){
  const c=S.cfg,w=+c.label_w||50,h=+c.label_h||30;let n=0,html='';
  for(const v of a)for(let i=0;i<(v.n||1)&&n<3000;i++,n++)
    html+=`<div class=lb>${c.label_name==='0'?'':`<div class=nm>${esc(v.name)}</div>`}<div class=bc>${barcodeSVG(v.barcode)}</div><div class=cd><span>${esc(v.barcode)}</span><span>${vt(v)}</span></div>${c.label_price==='0'?'':`<div class=pr>${fmt(v.price)}</div>`}</div>`;
  if(!n)return toast('لا توجد ملصقات للطباعة',1);
  printHTML(html,`@page{size:${w}mm ${h}mm;margin:0}body{margin:0}.lb{width:${w}mm;height:${h}mm;padding:1mm 2mm;box-sizing:border-box;page-break-after:always;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;font-family:Tahoma,Arial,sans-serif;text-align:center}.lb:last-child{page-break-after:auto}.nm{font-size:8pt;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bc{flex:1;min-height:0;margin:.5mm 0}.bc svg{width:100%;height:100%;display:block}.cd{font-size:7pt;display:flex;justify-content:space-between}.pr{font-size:10pt;font-weight:700}`);
  if(n>=3000)toast('تمت طباعة أول 3000 ملصق فقط',1);
}
async function scanCam(cb,keep){
  if(!('BarcodeDetector' in window))return toast('المتصفح لا يدعم مسح الكاميرا. استخدم Chrome أو قارئ باركود',1);
  let st;try{st=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})}catch{return toast('تعذر فتح الكاميرا (تحقق من الإذن)',1)}
  const ov=document.createElement('div');ov.className='cam';ov.innerHTML='<video playsinline muted autoplay></video><button class="btn pri">إغلاق ✕</button>';document.body.appendChild(ov);
  const vd=ov.querySelector('video');vd.srcObject=st;
  let det;try{det=new BarcodeDetector({formats:['code_128','ean_13','ean_8','upc_a','upc_e','code_39','itf']})}catch{det=new BarcodeDetector()}
  let on=true,last='',lt=0;
  const stop=()=>{on=false;st.getTracks().forEach(t=>t.stop());ov.remove()};
  ov.querySelector('button').onclick=stop;
  (async()=>{while(on){try{const r=await det.detect(vd);if(r[0]){const v=r[0].rawValue,n=Date.now();if(v!==last||n-lt>2000){last=v;lt=n;beep();cb(v);if(!keep)return stop()}}}catch{}await new Promise(r=>setTimeout(r,200))}})();
}

/* ---------- shell ---------- */
const NAV=[['home','الرئيسية','reports','home'],['pos','البيع','pos','cart'],['products','المنتجات','products','shirt'],['quick','إضافة سريعة','products_edit','plus'],['import','استيراد','products_edit','import'],['labels','باركود','products','barcode'],['stock','المخزون','stock','box'],['sales','الفواتير','pos','receipt'],['customers','الزبائن','customers','users'],['expenses','المصاريف','expenses','wallet'],['reports','التقارير','reports','chart'],['users','المستخدمون','users','lock'],['settings','الإعدادات','settings','gear']];
const NEED={edit:'products_edit'};
const P={};
function render(){
  if(!S.user&&S.setup){$('#root').innerHTML=`<form class="login card" onsubmit="X.setup(event)"><div class=lg><i>${ic('barcode')}</i><div><b>نظام الكاشير</b><small>إعداد أول مرة</small></div></div><p class=m>أنشئ حساب المدير (اسم الدخول: admin). البيانات تُحفظ على هذا الجهاز.</p><input id=sn placeholder="اسم المحل" required><input id=sm placeholder="اسمك"><input id=sp type=password placeholder="كلمة مرور المدير (6 أحرف على الأقل)" autocomplete=new-password required minlength=6><button class="btn pri big">بدء الاستخدام</button><button type=button class=btn onclick="X.pickRestore()">استرجاع نسخة احتياطية</button><input id=rf type=file accept=".json" hidden onchange="X.restore(this)"></form>`;return}
  if(!S.user){$('#root').innerHTML=`<form class="login card" onsubmit="X.login(event)"><div class=lg><i>${ic('barcode')}</i><div><b>${esc(S.cfg.shop_name||'نظام الكاشير')}</b><small>تسجيل الدخول</small></div></div><input id=lu placeholder="اسم المستخدم" autocapitalize=off autocomplete=username required><input id=lp type=password placeholder="كلمة المرور" autocomplete=current-password required><button class="btn pri big">دخول</button></form>`;return}
  const nav=NAV.filter(n=>can(n[2])).map(n=>`<a href="#${n[0]}" data-r="${n[0]}"><b>${ic(n[3])}</b>${n[1]}</a>`).join('');
  $('#root').innerHTML=`<div id=app><header><span class=logo>${ic('barcode')}</span><b class=grow>${esc(S.cfg.shop_name)}</b><span class=u>${esc(S.user.name)}</span><button class=ic title="الوضع الليلي" aria-label="الوضع الليلي" onclick=X.theme()>${ic(isDark()?'sun':'moon')}</button><button class=ic title="تغيير كلمة المرور" aria-label="تغيير كلمة المرور" onclick=X.pw()>${ic('key')}</button><button class=ic onclick=X.logout()>${ic('out')} خروج</button></header><nav>${nav}</nav><main id=main></main></div>`;
  route();
}
function route(){
  if(!S.user)return;
  const [name,arg]=(location.hash.slice(1)||(can('reports')?'home':'pos')).split('/');
  const n=NAV.find(x=>x[0]===name),need=n?n[2]:NEED[name];
  if(!P[name]||!can(need)){const f=NAV.find(x=>can(x[2]));if(f&&location.hash!=='#'+f[0])location.hash=f[0];return}
  document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.r===(name==='edit'?'products':name)));
  closeModal();
  Promise.resolve(P[name](arg)).catch(e=>toast(e.message,1));
}
addEventListener('hashchange',route);

/* ---------- POS ---------- */
P.pos=()=>{
  $('#main').innerHTML=`<div class=pos><div><div class=row><input id=q placeholder="امسح الباركود أو اكتب اسم المنتج" autocomplete=off onkeydown="if(event.key==='Enter')X.find(this.value)" oninput="X.sug(this.value)"><button class=btn onclick="X.cam(v=>X.find(v),true)">${ic('camera')}</button></div><div id=res class=list></div></div><div class=card id=cart></div></div>`;
  drawCart();$('#q').focus();
};
function drawRes(id,fn){$('#'+id).innerHTML=RES.map((v,i)=>`<div class=item onclick="${fn}(${i})"><div><b>${esc(v.name)}</b><br><small>${vt(v)} · ${esc(v.barcode)}</small></div><div class=end>${fmt(v.price)}<br><span class="badge ${v.qty<=0?'out':v.qty<=(+S.cfg.low_stock||2)?'low':''}">${v.qty<=0?'نفد':'متوفر '+v.qty}</span></div></div>`).join('')||'<p class=empty>لا نتائج</p>'}
function cartAdd(v){
  const l=S.cart.find(x=>x.vid===v.id);
  if(l)l.qty++;else S.cart.push({vid:v.id,name:v.name,size:v.size,color:v.color,price:v.price,qty:1});
  if(v.qty<=0)toast('تنبيه: المخزون '+v.qty,1);
  beep();drawCart();
}
const subtotal=()=>S.cart.reduce((a,l)=>a+l.price*l.qty,0);
function drawCart(){
  const el=$('#cart');if(!el)return;
  el.innerHTML=`<h3>السلة (${S.cart.reduce((a,l)=>a+l.qty,0)})</h3>`+
  (S.cart.map((l,i)=>`<div class=line><div class=grow><b>${esc(l.name)}</b><br><small>${vt(l)}</small></div>${can('discount')?`<input class=pi type=number inputmode=numeric value="${l.price}" onchange="X.price(${i},this.value)">`:`<span>${fmt(l.price)}</span>`}<div class=step><button onclick="X.qty(${i},-1)">−</button><input type=number inputmode=numeric value="${l.qty}" onchange="X.setq(${i},this.value)"><button onclick="X.qty(${i},1)">+</button></div><b class=lt>${fmt(l.price*l.qty)}</b><button class=x onclick="X.rm(${i})">✕</button></div>`).join('')||'<p class=empty>السلة فارغة<br><small>امسح باركود أو ابحث عن منتج (F2)</small></p>')+
  `<div class=sum><span>المجموع</span><b>${fmt(subtotal())}</b></div>`+
  (can('discount')?`<div class=sum><span>خصم</span><input id=disc type=number inputmode=numeric value="${S.disc||''}" placeholder=0 oninput="S.disc=+this.value||0;X.tot()"></div>`:'')+
  `<div class="sum big"><span>الإجمالي</span><b id=tot></b></div><div class=seg>${Object.entries(MT).map(m=>`<button class="${S.method===m[0]?'on':''}" onclick="X.meth('${m[0]}')">${m[1]}</button>`).join('')}</div>`+
  (S.method==='credit'?`<div class=row><button class="btn grow" onclick=X.pickCust()>${S.cust?esc(S.cust.name):'اختر الزبون'}</button><input id=paid type=number inputmode=numeric placeholder="المدفوع الآن" value="${S.paid||''}" oninput="S.paid=+this.value||0;X.tot()"></div><div class=sum><span>المتبقي دين</span><b id=rem></b></div>`:'')+
  (S.method==='cash'?`<div class=sum><span>المستلم</span><input id=got type=number inputmode=numeric value="${S.got||''}" placeholder=0 oninput="S.got=+this.value||0;X.tot()"></div><div class=sum><span>الباقي للزبون</span><b id=chg></b></div>`:'')+
  `<div class=row><button class="btn pri grow big" onclick=X.pay()>${ic('printer')} إتمام البيع</button><button class=btn onclick=X.clr()>إلغاء</button></div><div class=row><button class="btn grow" onclick=X.hold()>${ic('pause')} تعليق الفاتورة</button><button class="btn grow" onclick=X.held()>المعلّقة (${lsGet('pos_held',[]).length})</button></div>`;
  X.tot();
}

/* ---------- product form ---------- */
const SZ=['S','M','L','XL','XXL','3XL','Free','28','30','32','34','36','38','40','42','44'];
const fromP=p=>({...p,category:p.category||'',pr:false,del:[],V:p.variants.map(v=>({...v,qty0:v.qty}))});
P.quick=async()=>{CATS=await api('/categories');F={V:[],q:1,pr:true,del:[]};formView()};
P.edit=async id=>{CATS=await api('/categories');F=fromP(await api('/products/'+id));formView()};
function formView(){
  const e=!!F.id;
  $('#main').innerHTML=`<div class=card><h3>${e?'تعديل منتج':'إضافة سريعة'}</h3><input id=f_name placeholder="اسم المنتج" value="${esc(F.name)}"><div class=g2><input id=f_cat list=cl placeholder="القسم" value="${esc(F.category)}"><input id=f_brand placeholder="الماركة" value="${esc(F.brand)}"></div><datalist id=cl>${CATS.map(c=>`<option value="${esc(c)}">`).join('')}</datalist><div class=g2>${can('cost')?`<input id=f_cost type=number inputmode=numeric placeholder="سعر الكلفة" value="${F.cost||''}">`:''}<input id=f_price type=number inputmode=numeric placeholder="سعر البيع" value="${F.price||''}"></div><h4>الأحجام والألوان</h4><div class=chips>${SZ.map(s=>`<button type=button class=btn onclick="X.chip('${s}')">${s}</button>`).join('')}</div><input id=f_sizes placeholder="الأحجام (افصل بمسافة)" value="${esc(F.sizes)}"><input id=f_colors placeholder="الألوان (افصل بفاصلة)" value="${esc(F.colors)}"><div class=row><input id=f_q type=number inputmode=numeric placeholder="الكمية لكل صنف" value="${F.q??1}"><button class="btn grow" onclick=X.gen()>توليد الأصناف</button></div><div id=vt></div><label class=chk><input type=checkbox id=f_pr ${F.pr?'checked':''}> طباعة الباركود بعد الحفظ</label><div class=row><button class="btn pri grow big" onclick=X.saveP()>حفظ</button>${e?`<button class=btn onclick="X.lab(${F.id})" aria-label="باركود">${ic('barcode')}</button><button class="btn bad" onclick=X.delP()>حذف</button>`:''}</div></div>`;
  drawV();
}
function drawV(){
  $('#vt').innerHTML=(F.V.length?`<div class=tw><table class=tbl><tr><th>حجم</th><th>لون</th><th>كمية</th><th>باركود</th><th></th></tr>${F.V.map((v,i)=>`<tr><td><input value="${esc(v.size)}" oninput="F.V[${i}].size=this.value"></td><td><input value="${esc(v.color)}" oninput="F.V[${i}].color=this.value"></td><td><input type=number inputmode=numeric value="${v.qty}" oninput="F.V[${i}].qty=+this.value||0"></td><td><small>${esc(v.barcode||'تلقائي')}</small></td><td><button class=x onclick="X.rmv(${i})">✕</button></td></tr>`).join('')}</table></div>`:'<p class=m>اضغط «توليد الأصناف» أو أضف صفاً</p>')+`<button class=btn onclick=X.addrow()>+ صف</button>`;
}

/* ---------- actions ---------- */
const X={
  cam:scanCam,
  async login(e){e.preventDefault();const d=await api('/login',{body:{username:$('#lu').value,password:$('#lp').value}});S.user=d.user;S.cfg=d.settings;render()},
  async logout(){await api('/logout',{method:'POST',body:{}});S.user=null;S.cart=[];render()},
  pw(){modal(`<h3>تغيير كلمة المرور</h3><input id=po type=password placeholder="الحالية"><input id=pn type=password placeholder="الجديدة (6 أحرف على الأقل)"><button class="btn pri" onclick=X.pw2()>حفظ</button>`)},
  async pw2(){await api('/password',{body:{old:$('#po').value,new:$('#pn').value}});closeModal();toast('تم تغيير كلمة المرور')},
  /* POS */
  sug:debounce(async v=>{v=v.trim();const r=$('#res');if(!r)return;if(!v){r.innerHTML='';return}const d=await api('/variants?q='+encodeURIComponent(v));if(!$('#q')||$('#q').value.trim()!==v)return;RES=d;drawRes('res','X.addv')},250),
  async find(v){v=v.trim();if(!v)return;const r=await api('/variants?q='+encodeURIComponent(v));
    if(r.length&&(r[0].barcode===v||r.length===1)){cartAdd(r[0]);$('#q').value='';$('#res').innerHTML=''}
    else if(!r.length)toast('لا يوجد صنف: '+v,1);else{RES=r;drawRes('res','X.addv')}},
  addv(i){cartAdd(RES[i]);$('#q').value='';$('#res').innerHTML='';$('#q').focus()},
  qty(i,d){S.cart[i].qty=Math.max(1,S.cart[i].qty+d);drawCart()},
  setq(i,v){S.cart[i].qty=Math.max(1,Math.floor(+v)||1);drawCart()},
  price(i,v){S.cart[i].price=Math.max(0,+v||0);drawCart()},
  rm(i){S.cart.splice(i,1);drawCart()},
  clr(){S.cart=[];S.disc=S.paid=S.got=0;S.cust=null;S.method='cash';drawCart()},
  meth(m){S.method=m;drawCart()},
  tot(){const t=Math.max(0,subtotal()-(can('discount')?S.disc:0));const a=$('#tot');if(a)a.textContent=money(t);const r=$('#rem');if(r)r.textContent=money(Math.max(0,t-Math.min(S.paid,t)));const c=$('#chg');if(c)c.textContent=money(Math.max(0,S.got-t))},
  pickCust(){modal(`<h3>الزبون</h3><input id=cs placeholder="بحث بالاسم أو الهاتف" oninput="X.cs(this.value)"><div id=cl2 class=list></div><hr><input id=cn placeholder="اسم زبون جديد"><input id=cp placeholder="الهاتف"><button class="btn pri" onclick=X.cnew()>إضافة واختيار</button>`);X.cs('')},
  cs:debounce(async v=>{CL=await api('/customers?q='+encodeURIComponent(v));const e=$('#cl2');if(e)e.innerHTML=CL.map((c,i)=>`<div class=item onclick="X.csel(${i})"><div><b>${esc(c.name)}</b><br><small>${esc(c.phone)}</small></div><span class=end>${c.balance?'دين '+fmt(c.balance):''}</span></div>`).join('')},200),
  csel(i){S.cust=CL[i];closeModal();drawCart()},
  async cnew(){const name=$('#cn').value.trim();if(!name)return toast('الاسم مطلوب',1);S.cust=await api('/customers',{body:{name,phone:$('#cp').value}});closeModal();drawCart()},
  async pay(){
    if(busy)return;if(!S.cart.length)return toast('السلة فارغة',1);
    if(S.method==='credit'&&!S.cust)return toast('اختر الزبون للبيع بالآجل',1);
    busy=true;
    try{
      const d=await api('/sales',{body:{items:S.cart.map(l=>({variant_id:l.vid,qty:l.qty,price:can('discount')?l.price:undefined})),discount:S.disc,method:S.method,customer_id:S.cust&&S.cust.id,paid:S.paid}});
      X.clr();toast('تم البيع #'+d.sale.id);
      if(S.cfg.auto_print==='1')printReceipt(d.sale);else showSale(d.sale);
    }finally{busy=false}
  },
  hold(){if(!S.cart.length)return toast('السلة فارغة',1);const h=lsGet('pos_held',[]);h.push({t:new Date().toLocaleTimeString('en-GB').slice(0,5),cart:S.cart,disc:S.disc,method:S.method,cust:S.cust,paid:S.paid});lsSet('pos_held',h);X.clr();toast('تم تعليق الفاتورة')},
  held(){const h=lsGet('pos_held',[]);modal(`<h3>الفواتير المعلّقة</h3>`+(h.map((x,i)=>`<div class=item onclick="X.unhold(${i})"><div><b>${x.t}</b><br><small>${x.cart.reduce((a,l)=>a+l.qty,0)} قطعة${x.cust?' · '+esc(x.cust.name):''}</small></div><div class=end>${fmt(x.cart.reduce((a,l)=>a+l.price*l.qty,0))}<button class=x onclick="event.stopPropagation();X.delHeld(${i})">✕</button></div></div>`).join('')||'<p class=m>لا توجد فواتير معلّقة</p>')+`<button class=btn onclick=closeModal()>إغلاق</button>`)},
  unhold(i){const h=lsGet('pos_held',[]);if(S.cart.length)return toast('أكمل الفاتورة الحالية أو علّقها أولاً',1);const x=h.splice(i,1)[0];lsSet('pos_held',h);Object.assign(S,{cart:x.cart,disc:x.disc,method:x.method,cust:x.cust,paid:x.paid,got:0});closeModal();drawCart()},
  delHeld(i){const h=lsGet('pos_held',[]);h.splice(i,1);lsSet('pos_held',h);X.held();drawCart()},
  theme(){lsSet('pos_theme',isDark()?'light':'dark');applyTheme();render()},
  async setup(e){e.preventDefault();const d=await api('/setup',{body:{shop_name:$('#sn').value,name:$('#sm').value,password:$('#sp').value}});S.setup=false;S.user=d.user;S.cfg=d.settings;location.hash='';render();navigator.storage&&navigator.storage.persist&&navigator.storage.persist().catch(()=>{})},
  pickRestore(){$('#rf').click()},
  async restore(inp){
    const f=inp.files[0];if(!f)return;let d;
    try{d=JSON.parse(await f.text())}catch{return toast('الملف ليس نسخة احتياطية صالحة',1)}
    await api('/restore',{body:d});S.user=null;S.cart=[];const st=await api('/status');S.setup=st.setup;S.cfg={shop_name:st.shop_name};toast('تم استرجاع النسخة، سجّل الدخول');render()},
  async backup(){const d=await api('/backup');dl(`pos-backup-${today()}.json`,JSON.stringify(d),'application/json');lsSet('pos_last_backup',Date.now());toast('تم تنزيل النسخة الاحتياطية');if($('#bk'))$('#bk').textContent=bkText()},
  async wipe(){if(!confirm('سيتم حذف كل البيانات نهائياً. هل أنت متأكد؟'))return;if(!confirm('تأكيد أخير: حذف كل المنتجات والفواتير والمستخدمين؟'))return;await api('/wipe',{method:'POST',body:{}});S.user=null;S.setup=true;S.cart=[];render()},
  async pexport(){const r=await api('/export/products');const cost=r.length&&'cost' in r[0];dl(`products-${today()}.csv`,csv([['name','category','brand',...(cost?['cost']:[]),'price','size','color','qty','barcode'],...r.map(x=>[x.name,x.category,x.brand,...(cost?[x.cost]:[]),x.price,x.size,x.color,x.qty,x.barcode])]))},
  async sexport(){const r=await api(`/sales?from=${$('#sf').value}&to=${$('#st').value}`);dl(`sales-${today()}.csv`,csv([['id','type','date','cashier','customer','method','total'],...r.map(s=>[s.id,s.type,s.created_at,s.cashier,s.customer,MT[s.method],s.total])]))},
  rcsv(){if(!window.LASTR)return;const R=LASTR,hp=R.profit!=null;dl(`report-${RP.f}_${RP.t}.csv`,csv([['الفترة','فواتير','مبيعات','مرتجع','صافي',...(hp?['ربح']:[])],...R.rows.map(r=>[r.p,r.n,r.sales,r.returns,r.net,...(hp?[r.profit]:[])]),[],['المنتج','القطع','المبلغ'],...R.top.map(r=>[r.name,r.qty,r.total])]))},
  /* products */
  plq:debounce(()=>X.pl(true),250),
  async pl(reset){
    if(reset)PG=0;
    const r=await api('/products?'+new URLSearchParams({q:$('#pq').value,category:$('#pc').value,page:PG,low:$('#plow').checked?1:''}));
    const h=r.map(p=>`<div class=item ${can('products_edit')?`onclick="location.hash='edit/${p.id}'"`:''}><div><b>${esc(p.name)}</b><br><small>${esc(p.category||'')} ${esc(p.brand)} · ${p.nv} صنف</small></div><div class=end>${fmt(p.price)}<br><small>${p.qty} قطعة${p.cost!=null?' · كلفة '+fmt(p.cost):''}</small></div></div>`).join('');
    if(reset)$('#pl').innerHTML='';
    $('#pl').insertAdjacentHTML('beforeend',h);PG++;$('#pm').hidden=r.length<40;
  },
  chip(s){const i=$('#f_sizes'),a=i.value.split(/[\s,،]+/).filter(Boolean),k=a.indexOf(s);k<0?a.push(s):a.splice(k,1);i.value=a.join(' ')},
  gen(){
    const sz=$('#f_sizes').value.split(/[\s,،]+/).filter(Boolean),co=$('#f_colors').value.split(/[,،\n]+/).map(s=>s.trim()).filter(Boolean),q=+$('#f_q').value||0;
    for(const s of sz.length?sz:[''])for(const c of co.length?co:[''])if(!F.V.some(v=>v.size===s&&v.color===c))F.V.push({size:s,color:c,qty:q,barcode:''});
    drawV()},
  addrow(){F.V.push({size:'',color:'',qty:+$('#f_q').value||0,barcode:''});drawV()},
  rmv(i){const v=F.V[i];if(v.id)(F.del=F.del||[]).push(v.id);F.V.splice(i,1);drawV()},
  async saveP(){
    if(busy)return;const g=id=>($('#'+id)||{}).value||'';
    F.name=g('f_name').trim();F.category=g('f_cat');F.brand=g('f_brand');F.price=+g('f_price')||0;if($('#f_cost'))F.cost=+g('f_cost')||0;
    F.sizes=g('f_sizes');F.colors=g('f_colors');F.q=+g('f_q')||0;F.pr=$('#f_pr').checked;
    if(!F.name)return toast('اسم المنتج مطلوب',1);
    if(!F.V.length)X.gen();
    if(!F.V.length)F.V.push({size:'',color:'',qty:F.q,barcode:''});
    busy=true;
    try{
      const p=await api(F.id?'/products/'+F.id:'/products',{method:F.id?'PUT':'POST',body:{name:F.name,category:F.category,brand:F.brand,price:F.price,cost:can('cost')?F.cost:undefined,variants:F.V,delete:F.del||[]}});
      if(F.pr)printLabels(p.variants.map(v=>({...v,name:p.name,price:p.price,n:Math.max(1,v.qty)})));
      toast('تم الحفظ ✓');
      if(F.id){const pr=F.pr;F=fromP(p);F.pr=pr}else F={category:F.category,brand:F.brand,sizes:F.sizes,colors:F.colors,q:F.q,pr:F.pr,V:[],del:[]};
      CATS=await api('/categories');formView();if(!F.id){X.gen();$('#f_name').focus()}
    }finally{busy=false}
  },
  async delP(){if(!confirm('حذف المنتج؟'))return;await api('/products/'+F.id,{method:'DELETE'});location.hash='products'},
  async lab(id){const p=await api('/products/'+id);p.variants.forEach(v=>ladd({...v,name:p.name,price:p.price},Math.max(1,v.qty)));location.hash='labels'},
  /* import */
  tpl(){const b=new Blob(['\uFEFFname,category,brand,cost,price,size,color,qty,barcode\nقميص رجالي,قمصان,Zara,8000,15000,M,أزرق,5,\nقميص رجالي,قمصان,Zara,8000,15000,L,أزرق,3,\n'],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='products-template.csv';a.click()},
  async imp(){
    const f=$('#fi').files[0];if(!f)return toast('اختر ملف CSV',1);
    const rows=parseCSV(await f.text());if(rows.length<2)return toast('الملف فارغ',1);
    const map={'الاسم':'name','اسم المنتج':'name','القسم':'category','الماركة':'brand','التكلفة':'cost','الكلفة':'cost','السعر':'price','سعر البيع':'price','الحجم':'size','القياس':'size','اللون':'color','الكمية':'qty','الباركود':'barcode'};
    const hd=rows[0].map(h=>{h=h.trim().toLowerCase();return map[h]||h});
    if(!hd.includes('name')||!hd.includes('price'))return toast('الأعمدة name و price مطلوبة',1);
    const data=rows.slice(1).map((r,i)=>{const o={_n:i+2};hd.forEach((h,j)=>o[h]=(r[j]||'').trim());return o});
    let cr=0,up=0,errs=[];busy=true;
    try{for(let i=0;i<data.length;i+=300){$('#ip').innerHTML=`<div class=bar style="width:${Math.round(i/data.length*100)}%"></div><p>${i} / ${data.length}</p>`;const r=await api('/import',{body:{rows:data.slice(i,i+300)}});cr+=r.created;up+=r.updated;errs.push(...r.errors)}}finally{busy=false}
    $('#ip').innerHTML=`<p><b>تم:</b> ${fmt(cr)} جديد، ${fmt(up)} محدَّث، ${errs.length} خطأ</p>`+(errs.length?tb(['سطر','الخطأ'],errs.slice(0,100).map(e=>[e.row,esc(e.error)])):'');
  },
  /* labels */
  ls:debounce(async v=>{v=v.trim();if(!v){$('#lr').innerHTML='';return}RES=await api('/variants?q='+encodeURIComponent(v));drawRes('lr','X.lpick')},250),
  async lfind(v){v=v.trim();if(!v)return;const r=await api('/variants?q='+encodeURIComponent(v));if(r.length&&(r[0].barcode===v||r.length===1)){ladd(r[0]);$('#lq').value='';$('#lr').innerHTML=''}else{RES=r;drawRes('lr','X.lpick')}},
  lpick(i){ladd(RES[i]);$('#lq').value='';$('#lr').innerHTML=''},
  async lrecent(){(await api('/variants?recent=1&limit=100')).reverse().forEach(v=>ladd(v))},
  ln(i,v){LQ[i].n=Math.max(1,Math.floor(+v)||1);drawLQ()},
  lrm(i){LQ.splice(i,1);drawLQ()},
  lclr(){LQ=[];drawLQ()},
  lprint(){printLabels(LQ)},
  /* stock */
  ss:debounce(async v=>{v=v.trim();if(!v){$('#sr').innerHTML='';return}RES=await api('/variants?q='+encodeURIComponent(v));drawRes('sr','X.spick')},250),
  async sfind(v){v=v.trim();if(!v)return;const r=await api('/variants?q='+encodeURIComponent(v));if(r.length&&(r[0].barcode===v||r.length===1))X.spick(0,r[0]);else{RES=r;drawRes('sr','X.spick')}},
  spick(i,v){v=v||RES[i];SEL=v;$('#sr').innerHTML='';$('#sq').value='';$('#sp').innerHTML=`<div class=card><b>${esc(v.name)}</b><small>${vt(v)} · ${esc(v.barcode)}</small><div class=sum><span>الكمية الحالية</span><b id=scur>${v.qty}</b></div><div class=seg><button id=m_add class=on onclick="X.smode('add')">+ استلام</button><button id=m_set onclick="X.smode('set')">= جرد (تحديد الكمية)</button></div><input id=sqty type=number inputmode=numeric placeholder="الكمية"><input id=snote placeholder="ملاحظة (اختياري)"><button class="btn pri" onclick=X.ssave()>حفظ</button></div>`;$('#sqty').focus()},
  smode(m){SM=m;$('#m_add').classList.toggle('on',m==='add');$('#m_set').classList.toggle('on',m==='set')},
  async ssave(){const q=$('#sqty').value;if(q==='')return toast('أدخل الكمية',1);const r=await api('/stock',{body:{variant_id:SEL.id,mode:SM,qty:q,note:$('#snote').value}});toast('تم الحفظ، الكمية الآن '+r.qty);$('#sp').innerHTML='';SM='add';loadMoves()},
  /* sales */
  sl:debounce(async()=>{const l=$('#slist');if(!l)return;const r=await api(`/sales?from=${$('#sf').value}&to=${$('#st').value}&q=${encodeURIComponent($('#sn').value)}`);l.innerHTML=r.map(s=>`<div class=item onclick="X.sale(${s.id})"><div><b>#${s.id} ${s.type==='return'?'<span class=bad>مرتجع</span>':''}</b><br><small>${esc(s.created_at)} · ${esc(s.cashier)}${s.customer?' · '+esc(s.customer):''}</small></div><div class=end>${fmt(s.total)}<br><small>${MT[s.method]}</small></div></div>`).join('')||'<p class=m>لا فواتير</p>'},200),
  async sale(id){showSale(await api('/sales/'+id))},
  retForm(){modal(`<h3>إرجاع من فاتورة #${SALE.id}</h3>`+SALE.items.map(i=>`<div class=line><div class=grow>${esc(i.name)} <small>${vt(i)}</small><br><small>المتاح للإرجاع ${i.qty-i.returned}</small></div><input class=pi type=number min=0 max=${i.qty-i.returned} value=0 data-id=${i.id}></div>`).join('')+`<div class=row><button class="btn pri grow" onclick=X.ret()>تنفيذ الإرجاع</button><button class=btn onclick=closeModal()>إلغاء</button></div>`)},
  async ret(){const items=[...document.querySelectorAll('#modal input[data-id]')].map(e=>({id:+e.dataset.id,qty:+e.value||0})).filter(x=>x.qty>0);if(!items.length)return toast('حدد الكمية',1);const d=await api(`/sales/${SALE.id}/return`,{body:{items}});toast('تم الإرجاع');showSale(d.sale);if(S.cfg.auto_print==='1')printReceipt(d.sale);X.sl()},
  /* customers */
  cq:debounce(async()=>{CL=await api('/customers?q='+encodeURIComponent($('#cq').value));$('#cli').innerHTML=CL.map((c,i)=>`<div class=item onclick="X.cedit(${i})"><div><b>${esc(c.name)}</b><br><small>${esc(c.phone)}</small></div><b class="end ${c.balance>0?'bad':''}">${c.balance?fmt(c.balance):''}</b></div>`).join('')||'<p class=m>لا زبائن</p>'},200),
  cedit(i){const c=i<0?{id:0,name:'',phone:'',balance:0}:CL[i];CE=c;modal(`<h3>${c.id?'الزبون':'زبون جديد'}</h3><input id=cen placeholder="الاسم" value="${esc(c.name)}"><input id=cep placeholder="الهاتف" value="${esc(c.phone)}"><button class="btn pri" onclick=X.csave()>حفظ</button>`+(c.id?`<hr><div class=sum><span>الدين الحالي</span><b>${money(c.balance)}</b></div><div class=row><input id=cpa type=number inputmode=numeric placeholder="مبلغ التسديد"><button class=btn onclick=X.cpay()>تسديد</button></div>`:''))},
  async csave(){const b={name:$('#cen').value,phone:$('#cep').value};await api(CE.id?'/customers/'+CE.id:'/customers',{method:CE.id?'PUT':'POST',body:b});closeModal();X.cq()},
  async cpay(){await api(`/customers/${CE.id}/pay`,{body:{amount:$('#cpa').value}});closeModal();toast('تم التسديد');X.cq()},
  /* expenses */
  async ex(){const r=await api(`/expenses?from=${$('#ef').value}&to=${$('#et').value}`);$('#eli').innerHTML=`<div class=sum><span>الإجمالي</span><b>${money(r.total)}</b></div>`+tb(['التاريخ','البيان','المبلغ',''],r.rows.map(e=>[esc(e.created_at.slice(0,16)),esc(e.title),fmt(e.amount),`<button class=x onclick="X.exdel(${e.id})">✕</button>`]))},
  async exadd(){await api('/expenses',{body:{title:$('#et2').value,amount:$('#ea').value}});$('#et2').value=$('#ea').value='';X.ex()},
  async exdel(id){if(!confirm('حذف المصروف؟'))return;await api('/expenses/'+id,{method:'DELETE'});X.ex()},
  /* reports */
  rp(k){const t=today(),d=new Date();let f=t,to=t,g='day';
    if(k==='yest')f=to=addDays(t,-1);else if(k==='week')f=addDays(t,-((d.getDay()+1)%7));else if(k==='month')f=t.slice(0,8)+'01';else if(k==='year'){f=t.slice(0,5)+'01-01';g='month'}
    $('#rf').value=f;$('#rt').value=to;$('#rg').value=g;X.rr()},
  async rr(){
    RP={f:$('#rf').value,t:$('#rt').value,g:$('#rg').value};
    const R=await api(`/reports?from=${RP.f}&to=${RP.t}&group=${RP.g}`);window.LASTR=R;const hp=R.profit!=null,mx=Math.max(1,...R.rows.map(r=>Math.abs(r.net)));
    const k=[['صافي المبيعات',money(R.net)],['عدد الفواتير',fmt(R.n)],['المرتجعات',money(R.returns)]];
    if(hp)k.push(['الربح الإجمالي',money(R.profit)]);k.push(['المصاريف',money(R.expenses)]);if(hp)k.push(['صافي الربح',money(R.profit-R.expenses)]);k.push(['ديون محصّلة',money(R.debt_paid)]);
    $('#rep').innerHTML=`<div class=kpis>${k.map(x=>`<div class=kpi><small>${x[0]}</small><b>${x[1]}</b></div>`).join('')}</div>
    <h4>حسب الفترة</h4>${tb(['الفترة','فواتير','مبيعات','مرتجع','صافي',...(hp?['ربح']:[]),''],R.rows.map(r=>[r.p,r.n,fmt(r.sales),fmt(r.returns),`<b>${fmt(r.net)}</b>`,...(hp?[fmt(r.profit)]:[]),`<div class=bar style="width:${Math.round(Math.abs(r.net)/mx*100)}%"></div>`]))}
    <h4>الأكثر مبيعاً</h4>${tb(['المنتج','القطع','المبلغ'],R.top.map(r=>[esc(r.name),fmt(r.qty),fmt(r.total)]))}
    <h4>حسب الكاشير</h4>${tb(['الكاشير','فواتير','المبلغ'],R.cashiers.map(r=>[esc(r.name),fmt(r.n),fmt(r.total)]))}
    <h4>طرق الدفع</h4>${tb(['الطريقة','فواتير','المبلغ'],R.methods.map(r=>[MT[r.method]||r.method,fmt(r.n),fmt(r.total)]))}
    <h4>المخزون: ${fmt(R.inventory.pieces)} قطعة${R.inventory.cost_value!=null?' · بالكلفة '+money(R.inventory.cost_value):''} · بسعر البيع ${money(R.inventory.retail_value)}</h4>
    <h4>مخزون منخفض</h4>${tb(['المنتج','الصنف','الباركود','الكمية'],R.low.map(r=>[esc(r.name),vt(r),esc(r.barcode),`<b class=bad>${r.qty}</b>`]))}`;
  },
  rprint(){printHTML($('#rep').innerHTML,'body{font:12px Tahoma,Arial,sans-serif}table{width:100%;border-collapse:collapse;margin-bottom:8px}td,th{border:1px solid #999;padding:3px 5px;text-align:start}.kpis{display:flex;flex-wrap:wrap;gap:6px}.kpi{border:1px solid #999;padding:4px 8px}.kpi b{display:block}.bar{display:none}')},
  /* users */
  async ul(){const [u,r]=await Promise.all([api('/users'),api('/roles')]);UL=u;RL=r;
    $('#uli').innerHTML=`<div class=row><h3 class=grow>المستخدمون</h3><button class="btn pri" onclick="X.uedit(-1)">+ مستخدم</button></div><div class=list>${u.map((x,i)=>`<div class=item onclick="X.uedit(${i})"><div><b>${esc(x.name)}</b><br><small>${esc(x.username)} · ${esc(x.role)}</small></div>${x.active?'':'<span class=bad>معطّل</span>'}</div>`).join('')}</div><div class=row><h3 class=grow>الأدوار والصلاحيات</h3><button class="btn pri" onclick="X.redit(-1)">+ دور</button></div><div class=list>${r.map((x,i)=>`<div class=item onclick="X.redit(${i})"><b>${esc(x.name)}</b><small>${x.perms.length} صلاحية</small></div>`).join('')}</div>`},
  uedit(i){const u=i<0?{id:0,name:'',username:'',role_id:RL.find(r=>r.name==='كاشير')?.id||RL[0].id,active:1}:UL[i];UE=u;
    modal(`<h3>${u.id?'تعديل مستخدم':'مستخدم جديد'}</h3><input id=un placeholder="الاسم" value="${esc(u.name)}"><input id=uu placeholder="اسم المستخدم (للدخول)" value="${esc(u.username)}" ${u.id?'disabled':''} autocapitalize=off><input id=up type=password placeholder="${u.id?'كلمة مرور جديدة (اتركها فارغة)':'كلمة المرور (6 أحرف على الأقل)'}"><select id=ur>${RL.map(r=>`<option value=${r.id} ${r.id===u.role_id?'selected':''}>${esc(r.name)}</option>`).join('')}</select><label class=chk><input type=checkbox id=ua ${u.active?'checked':''}> فعّال</label><button class="btn pri" onclick=X.usave()>حفظ</button>`)},
  async usave(){const b={name:$('#un').value,username:$('#uu').value,password:$('#up').value,role_id:+$('#ur').value,active:$('#ua').checked?1:0};await api(UE.id?'/users/'+UE.id:'/users',{method:UE.id?'PUT':'POST',body:b});closeModal();X.ul()},
  redit(i){const r=i<0?{id:0,name:'',perms:[]}:RL[i];RE=r;const L={pos:'البيع',discount:'الخصم وتعديل السعر',return:'الإرجاع',products:'عرض المنتجات',products_edit:'إضافة وتعديل المنتجات',cost:'رؤية الكلفة والأرباح',stock:'المخزون',reports:'التقارير وكل الفواتير',expenses:'المصاريف',customers:'إدارة الزبائن',users:'المستخدمون والأدوار',settings:'الإعدادات والنسخ الاحتياطي'};
    modal(`<h3>${r.id?'تعديل دور':'دور جديد'}</h3><input id=rn placeholder="اسم الدور" value="${esc(r.name)}" ${r.id===1?'disabled':''}>${Object.entries(L).map(([k,v])=>`<label class=chk><input type=checkbox data-p=${k} ${r.perms.includes(k)?'checked':''} ${r.id===1?'disabled':''}> ${v}</label>`).join('')}${r.id===1?'<p class=m>المدير العام يملك كل الصلاحيات دائماً</p>':`<div class=row><button class="btn pri grow" onclick=X.rsave()>حفظ</button>${r.id?'<button class="btn bad" onclick=X.rdel()>حذف</button>':''}</div>`}`)},
  async rsave(){const b={name:$('#rn').value,perms:[...document.querySelectorAll('#modal input[data-p]:checked')].map(e=>e.dataset.p)};await api(RE.id?'/roles/'+RE.id:'/roles',{method:RE.id?'PUT':'POST',body:b});closeModal();X.ul()},
  async rdel(){if(!confirm('حذف الدور؟'))return;await api('/roles/'+RE.id,{method:'DELETE'});closeModal();X.ul()},
  /* settings */
  async sset(){const b={};document.querySelectorAll('#main [data-k]').forEach(e=>b[e.dataset.k]=e.type==='checkbox'?(e.checked?'1':'0'):e.value);S.cfg=(await api('/settings',{method:'PUT',body:b})).settings;toast('تم حفظ الإعدادات');render()},
  tprint(){printReceipt({id:0,type:'sale',created_at:'2025-01-01 12:00:00',cashier:S.user.name,subtotal:20000,discount:0,total:20000,method:'cash',paid:20000,items:[{name:'صنف تجريبي',size:'M',color:'أزرق',qty:1,line_total:20000}]})},
  tlabel(){printLabels([{name:'صنف تجريبي',size:'M',color:'أزرق',barcode:'2000000001',price:15000,n:2}])}
};
let SEL=null,SM='add',CE=null,UL=[],RL=[],UE=null,RE=null;

function ladd(v,n){const l=LQ.find(x=>x.id===v.id);if(l)l.n+=n||1;else LQ.push({id:v.id,name:v.name,size:v.size,color:v.color,barcode:v.barcode,price:v.price,n:n||1});drawLQ()}
function drawLQ(){
  const e=$('#lqueue');if(!e)return;const t=LQ.reduce((a,l)=>a+l.n,0);
  e.innerHTML=`<h3>قائمة الطباعة (${fmt(t)} ملصق)</h3>`+(LQ.map((l,i)=>`<div class=line><div class=grow><b>${esc(l.name)}</b><br><small>${vt(l)} · ${esc(l.barcode)}</small></div><input class=pi type=number inputmode=numeric value="${l.n}" onchange="X.ln(${i},this.value)"><button class=x onclick="X.lrm(${i})">✕</button></div>`).join('')||'<p class=m>القائمة فارغة</p>')+`<div class=row><button class="btn pri grow big" onclick=X.lprint()>${ic('printer')} طباعة</button><button class=btn onclick=X.lclr()>مسح</button></div>`;
}
const bkText=()=>{const t=lsGet('pos_last_backup',0);return t?'آخر نسخة احتياطية: '+new Date(t).toLocaleString('ar-IQ'):'لم تُنزَّل أي نسخة احتياطية بعد'};
function showSale(s){
  SALE=s;
  modal(`<div class=rc>${receiptHTML(s)}</div><div class=row><button class="btn pri grow" onclick="printReceipt(SALE)">${ic('printer')} طباعة</button>${s.type==='sale'&&can('return')?'<button class=btn onclick=X.retForm()>إرجاع</button>':''}<button class=btn onclick=closeModal()>إغلاق</button></div>`);
}
function loadMoves(){api('/stock/moves').then(r=>{const e=$('#sm');if(e)e.innerHTML='<h4>آخر الحركات</h4>'+tb(['الوقت','الصنف','التغيير','النوع','ملاحظة'],r.map(m=>[esc(m.created_at.slice(5,16)),`${esc(m.name)} <small>${vt(m)}</small>`,`<b class="${m.qty<0?'bad':''}">${m.qty>0?'+':''}${m.qty}</b>`,MV[m.type]||m.type,esc(m.ref)]))})}
function parseCSV(t){
  t=t.replace(/^\uFEFF/,'');const first=t.split('\n')[0],d=[',',';','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
  const rows=[];let r=[],f='',q=false;
  for(let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;else if(c===d){r.push(f);f=''}else if(c==='\n'){r.push(f);rows.push(r);r=[];f=''}else if(c!=='\r')f+=c}
  if(f||r.length){r.push(f);rows.push(r)}
  return rows.filter(r=>r.some(x=>x.trim()));
}

/* ---------- pages ---------- */
P.products=async()=>{
  const cats=await api('/categories');
  $('#main').innerHTML=`<div class=row><input id=pq placeholder="بحث: اسم / ماركة / باركود / لون" oninput="X.plq()"><select id=pc onchange="X.pl(true)"><option value="">كل الأقسام</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select><button class=btn onclick=X.pexport()>${ic('down')} CSV</button></div><label class=chk><input type=checkbox id=plow onchange="X.pl(true)"> المخزون المنخفض فقط</label><div id=pl class=list></div><button id=pm class=btn hidden onclick="X.pl()">المزيد</button>`;
  X.pl(true);
};
P.import=()=>{$('#main').innerHTML=`<div class=card><h3>استيراد منتجات (CSV)</h3><p class=m>الأعمدة: name, category, brand, cost, price, size, color, qty, barcode. كل صف = صنف (حجم/لون). الباركود اختياري ويُولَّد تلقائياً. احفظ ملف Excel بصيغة <b>CSV UTF-8</b>، واجعل عمود الباركود نصاً (Text) حتى لا يتحول لصيغة علمية. إعادة استيراد نفس الملف تحدّث الكميات ولا تكرّر الأصناف.</p><button class=btn onclick=X.tpl()>تحميل القالب</button><input type=file id=fi accept=".csv,.txt"><button class="btn pri big" onclick=X.imp()>بدء الاستيراد</button><div id=ip></div></div>`};
P.labels=()=>{
  $('#main').innerHTML=`<div class=card><h3>طباعة الباركود</h3><div class=row><input id=lq placeholder="ابحث أو امسح صنفاً لإضافته" onkeydown="if(event.key==='Enter')X.lfind(this.value)" oninput="X.ls(this.value)"><button class=btn onclick="X.cam(v=>X.lfind(v),true)">${ic('camera')}</button></div><div id=lr class=list></div><button class=btn onclick=X.lrecent()>إضافة آخر 100 صنف مضاف</button></div><div class=card id=lqueue></div>`;
  drawLQ();
};
P.stock=()=>{
  $('#main').innerHTML=`<div class=card><h3>المخزون</h3><div class=row><input id=sq placeholder="امسح أو ابحث عن صنف" onkeydown="if(event.key==='Enter')X.sfind(this.value)" oninput="X.ss(this.value)"><button class=btn onclick="X.cam(v=>X.sfind(v))">${ic('camera')}</button></div><div id=sr class=list></div><div id=sp></div></div><div class=card id=sm></div>`;
  SM='add';loadMoves();
};
P.sales=()=>{
  $('#main').innerHTML=`<div class=row><input id=sf type=date value="${today()}" onchange=X.sl()><input id=st type=date value="${today()}" onchange=X.sl()></div><div class=row><input id=sn placeholder="رقم الفاتورة" inputmode=numeric oninput=X.sl()><button class=btn onclick=X.sexport()>${ic('down')} CSV</button></div><div id=slist class=list></div>`;
  X.sl();
};
P.customers=()=>{
  $('#main').innerHTML=`<div class=row><input id=cq placeholder="بحث بالاسم أو الهاتف" oninput=X.cq()><button class="btn pri" onclick="X.cedit(-1)">+ زبون</button></div><div id=cli class=list></div>`;
  X.cq();
};
P.expenses=()=>{
  $('#main').innerHTML=`<div class=card><h3>مصروف جديد</h3><input id=et2 placeholder="البيان (إيجار، كهرباء...)"><input id=ea type=number inputmode=numeric placeholder="المبلغ"><button class="btn pri" onclick=X.exadd()>إضافة</button></div><div class=row><input id=ef type=date value="${today().slice(0,8)+'01'}" onchange=X.ex()><input id=et type=date value="${today()}" onchange=X.ex()></div><div id=eli class=card></div>`;
  X.ex();
};
P.reports=()=>{
  $('#main').innerHTML=`<div class=chips>${[['today','اليوم'],['yest','أمس'],['week','الأسبوع'],['month','الشهر'],['year','السنة']].map(b=>`<button class=btn onclick="X.rp('${b[0]}')">${b[1]}</button>`).join('')}<button class=btn onclick=X.rprint() aria-label="طباعة">${ic('printer')}</button><button class=btn onclick=X.rcsv()>${ic('down')} CSV</button></div><div class=row><input type=date id=rf value="${today()}" onchange=X.rr()><input type=date id=rt value="${today()}" onchange=X.rr()><select id=rg onchange=X.rr()>${[['day','يومي'],['week','أسبوعي'],['month','شهري'],['year','سنوي']].map(g=>`<option value=${g[0]}>${g[1]}</option>`).join('')}</select></div><div id=rep></div>`;
  X.rr();
};
P.users=()=>{$('#main').innerHTML='<div id=uli></div>';X.ul()};
P.settings=()=>{
  const c=S.cfg,t=(k,l,ty='text')=>`<label>${l}<input data-k=${k} type=${ty} value="${esc(c[k])}"></label>`,ck=(k,l)=>`<label class=chk><input type=checkbox data-k=${k} ${c[k]==='1'?'checked':''}> ${l}</label>`;
  $('#main').innerHTML=`<div class=card><h3>الإعدادات</h3>${t('shop_name','اسم المحل')}${t('shop_phone','الهاتف')}${t('shop_address','العنوان')}${t('receipt_footer','ذيل الوصل')}${t('currency','العملة')}<label>عرض ورق الوصل<select data-k=paper_mm><option ${c.paper_mm==='58'?'selected':''}>58</option><option ${c.paper_mm==='80'?'selected':''}>80</option></select></label><div class=g2>${t('label_w','عرض الملصق (مم)','number')}${t('label_h','ارتفاع الملصق (مم)','number')}</div>${ck('label_name','إظهار الاسم على الملصق')}${ck('label_price','إظهار السعر على الملصق')}${ck('auto_print','طباعة الوصل تلقائياً بعد البيع')}${ck('allow_negative','السماح بالبيع عند نفاد المخزون')}${t('low_stock','حد المخزون المنخفض','number')}<button class="btn pri" onclick=X.sset()>حفظ</button></div><div class=card><h3>أدوات</h3><div class=row><button class="btn grow" onclick=X.tprint()>تجربة وصل</button><button class="btn grow" onclick=X.tlabel()>تجربة ملصق</button></div></div><div class=card><h3>النسخ الاحتياطي</h3><p class=m>البيانات محفوظة داخل هذا المتصفح فقط. نزّل نسخة بشكل دوري واحتفظ بها خارج الجهاز.</p><p id=bk class=warn>${bkText()}</p><button class="btn pri" onclick=X.backup()>${ic('down')} تنزيل نسخة احتياطية</button><button class=btn onclick="$('#rf').click()">${ic('up')} استرجاع من نسخة</button><input id=rf type=file accept=".json" hidden onchange="X.restore(this)"><button class="btn bad" onclick=X.wipe()>حذف كل البيانات</button></div>`;
};

P.home=async()=>{
  const t=today(),f=addDays(t,-6),R=await api(`/reports?from=${f}&to=${t}&group=day`),T=await api(`/reports?from=${t}&to=${t}`),hp=T.profit!=null;
  const days=[...Array(7)].map((_,i)=>addDays(f,i)),mp=Object.fromEntries(R.rows.map(r=>[r.p,r.net])),mx=Math.max(1,...days.map(d=>Math.abs(mp[d]||0)));
  const k=[['مبيعات اليوم',money(T.net)],['فواتير اليوم',fmt(T.n)],['مصاريف اليوم',money(T.expenses)]];if(hp)k.push(['ربح اليوم',money(T.profit-T.expenses)]);
  $('#main').innerHTML=`<div class=kpis>${k.map(x=>`<div class=kpi><small>${x[0]}</small><b>${x[1]}</b></div>`).join('')}</div><div class=card><h4>آخر 7 أيام</h4><div class=chart>${days.map(d=>`<div><small>${fmt(mp[d]||0)}</small><i style="height:${Math.round(Math.abs(mp[d]||0)/mx*80)}%"></i><span>${d.slice(5)}</span></div>`).join('')}</div></div><div class=card><h4>الأكثر مبيعاً (7 أيام)</h4>${tb(['المنتج','القطع','المبلغ'],R.top.slice(0,5).map(r=>[esc(r.name),fmt(r.qty),fmt(r.total)]))}</div><div class=card><h4>مخزون منخفض</h4>${R.low.length?tb(['المنتج','الصنف','الكمية'],R.low.slice(0,8).map(r=>[esc(r.name),vt(r),`<b class=bad>${r.qty}</b>`])):'<p class=m>لا توجد أصناف منخفضة</p>'}</div>${lsGet('pos_last_backup',0)<Date.now()-7*864e5&&can('settings')?'<div class=warn>لم تنزّل نسخة احتياطية منذ أكثر من أسبوع. من الإعدادات يمكنك تنزيل نسخة.</div>':''}`;
};
document.addEventListener('keydown',e=>{
  if(!S.user||$('#modal').innerHTML)return;
  if(e.key==='F2'&&$('#q')){e.preventDefault();$('#q').focus()}
  if(e.key==='F9'&&$('#cart')){e.preventDefault();X.pay()}
});
async function boot(){
  try{await Local.init()}catch(e){$('#root').innerHTML='<div class="login card"><h3 class=bad>تعذر فتح قاعدة البيانات</h3><p>المتصفح يمنع التخزين المحلي (ربما النافذة الخاصة). افتح الموقع في نافذة عادية.</p></div>';return}
  const st=await api('/status');S.setup=st.setup;S.cfg={shop_name:st.shop_name};
  try{const d=await api('/me');S.user=d.user;S.cfg=d.settings}catch{}
  render();
  if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
}
boot();
