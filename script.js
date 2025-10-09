const LS = {
  PRODUCTS:'bar_products', CLIENTS:'bar_clients', SALES:'bar_sales', EXPENSES:'bar_expenses', OVERRIDES:'bar_client_overrides'
};
function localLoad(k,f){try{return JSON.parse(localStorage.getItem(k))||f;}catch{return f;}}
function localSave(k,v){localStorage.setItem(k,JSON.stringify(v));}
function todayStr(){const d=new Date();return d.toISOString().slice(0,10);}
function formatCurrency(n){return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);}
function uid(p='id'){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}

let PRODUCTS=[],selectedClientId=null,CART=[];
async function loadProducts(){
  try{const r=await fetch('productos.json');PRODUCTS=await r.json();localSave(LS.PRODUCTS,PRODUCTS);}
  catch{PRODUCTS=localLoad(LS.PRODUCTS,[]);}
  renderProductSelect();
}
function renderProductSelect(){
  const sel=document.getElementById('productSelect');
  sel.innerHTML=PRODUCTS.map(p=>`<option value="${p.id}">${p.nombre} — ${formatCurrency(p.precio)}</option>`).join('');
  updatePriceInputFromSelect();
}
function getProductById(id){return PRODUCTS.find(p=>p.id===id);}
function renderClientsList(){
  const date=document.getElementById('filterDate').value||todayStr();
  const clients=localLoad(LS.CLIENTS,[]).filter(c=>c.createdAt===date);
  const list=document.getElementById('clientsList'); list.innerHTML='';
  if(clients.length===0){list.innerHTML='<em>No hay clientes</em>';return;}
  const ul=document.createElement('ul');ul.className='list-group small';
  clients.forEach(c=>{
    const li=document.createElement('li');li.className='list-group-item d-flex justify-content-between align-items-center';
    li.innerHTML=`${c.name}<div><button class="btn btn-sm btn-outline-primary me-2" onclick="selectClient('${c.id}')">Abrir</button><button class="btn btn-sm btn-outline-secondary" onclick="showClientOverrides('${c.id}')">Precios</button></div>`;
    ul.appendChild(li);
  });
  list.appendChild(ul);
}
function createClient(name,date){
  if(!name)return alert('Nombre requerido');
  const clients=localLoad(LS.CLIENTS,[]);
  clients.push({id:uid('client_'),name,createdAt:date});
  localSave(LS.CLIENTS,clients);
  renderClientsList();
}
function selectClient(cid){
  selectedClientId=cid;
  const c=localLoad(LS.CLIENTS,[]).find(x=>x.id===cid);
  document.getElementById('selectedClientHint').innerText=`Cliente: ${c.name} (${c.createdAt})`;
  CART=[];renderCart();
}
function loadOverrides(){return localLoad(LS.OVERRIDES,{});}
function saveOverrides(o){localSave(LS.OVERRIDES,o);}
function showClientOverrides(cid){
  const o=loadOverrides()[cid]||{};
  const lines=Object.entries(o).map(([pid,v])=>`${getProductById(pid)?.nombre||pid}: ${formatCurrency(v)}`);
  alert(lines.length?lines.join('\n'):'Sin precios personalizados.');
}
function updatePriceInputFromSelect(){
  const pid=document.getElementById('productSelect').value;
  let price=getProductById(pid)?.precio||0;
  const overrides=loadOverrides();
  if(selectedClientId&&overrides[selectedClientId]?.[pid]!=null)price=overrides[selectedClientId][pid];
  document.getElementById('productPrice').value=price;
}
function addToCart(){
  if(!selectedClientId)return alert('Selecciona un cliente');
  const pid=document.getElementById('productSelect').value;
  const qty=+document.getElementById('productQty').value||1;
  const price=+document.getElementById('productPrice').value||0;
  const prod=getProductById(pid);
  CART.push({id:uid('item_'),productId:pid,name:prod.nombre,price,qty});
  if(document.getElementById('saveOverride').checked){
    const o=loadOverrides();o[selectedClientId]=o[selectedClientId]||{};o[selectedClientId][pid]=price;saveOverrides(o);
  }
  renderCart();
}
function renderCart(){
  const tbody=document.querySelector('#cartTable tbody');tbody.innerHTML='';
  let total=0;CART.forEach(it=>{
    const sub=it.price*it.qty;total+=sub;
    tbody.innerHTML+=`<tr><td>${it.name}</td><td>${formatCurrency(it.price)}</td><td>${it.qty}</td><td>${formatCurrency(sub)}</td><td><button class='btn btn-sm btn-outline-danger' onclick="removeItem('${it.id}')">×</button></td></tr>`;
  });
  document.getElementById('cartTotal').innerText=formatCurrency(total);
}
function removeItem(id){CART=CART.filter(i=>i.id!==id);renderCart();}
function finalizeSale(){
  if(!selectedClientId||CART.length===0)return alert('Cliente o carrito vacío.');
  const client=localLoad(LS.CLIENTS,[]).find(c=>c.id===selectedClientId);
  const total=CART.reduce((s,i)=>s+i.price*i.qty,0);
  const sale={id:uid('sale_'),clientId:selectedClientId,clientName:client.name,items:CART,total,date:client.createdAt,timestamp:new Date().toISOString()};
  const sales=localLoad(LS.SALES,[]);sales.push(sale);localSave(LS.SALES,sales);
  CART=[];renderCart();refreshReport();alert('Venta guardada: '+formatCurrency(total));
}
function addExpense(){
  const desc=document.getElementById('expenseDesc').value.trim();
  const amount=+document.getElementById('expenseAmount').value||0;
  const date=document.getElementById('expenseDate').value||todayStr();
  if(!desc||amount<=0)return alert('Datos inválidos.');
  const exps=localLoad(LS.EXPENSES,[]);exps.push({id:uid('exp_'),desc,amount,date,timestamp:new Date().toISOString()});
  localSave(LS.EXPENSES,exps);refreshReport();alert('Gasto registrado');
}
function refreshReport(){
  const date=document.getElementById('reportDate').value||todayStr();
  const sales=localLoad(LS.SALES,[]).filter(s=>s.date===date);
  const exps=localLoad(LS.EXPENSES,[]).filter(e=>e.date===date);
  const totalSales=sales.reduce((a,b)=>a+b.total,0);
  const totalExp=exps.reduce((a,b)=>a+b.amount,0);
  const profit=totalSales-totalExp;
  document.getElementById('reportSalesTotal').innerText=formatCurrency(totalSales);
  document.getElementById('reportExpensesTotal').innerText=formatCurrency(totalExp);
  document.getElementById('reportProfit').innerText=formatCurrency(profit);
  document.getElementById('reportCounts').innerText=`${sales.length} ventas • ${exps.length} gastos • ${date}`;
}
function exportCSV(type){
  const date=document.getElementById('reportDate').value||todayStr();
  if(type==='sales'){
    const sales=localLoad(LS.SALES,[]).filter(s=>s.date===date);
    if(!sales.length)return alert('Sin ventas');
    let csv='id,cliente,total,items\n';
    sales.forEach(s=>csv+=`${s.id},${s.clientName},${s.total},"${s.items.map(i=>i.name+' x'+i.qty).join(' | ')}"\n`);
    downloadBlob(csv,`ventas_${date}.csv`);
  }else{
    const exps=localLoad(LS.EXPENSES,[]).filter(e=>e.date===date);
    if(!exps.length)return alert('Sin gastos');
    let csv='id,descripcion,monto\n';exps.forEach(e=>csv+=`${e.id},${e.desc},${e.amount}\n`);
    downloadBlob(csv,`gastos_${date}.csv`);
  }
}
function downloadBlob(txt,name){const b=new Blob([txt],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();}
async function exportPDF(){
  const { jsPDF } = window.jspdf;
  const doc=new jsPDF();
  const date=document.getElementById('reportDate').value||todayStr();
  const salesTotal=document.getElementById('reportSalesTotal').innerText;
  const expTotal=document.getElementById('reportExpensesTotal').innerText;
  const profit=document.getElementById('reportProfit').innerText;
  doc.text(`Reporte Diario - ${date}`,14,16);
  doc.text(`Ventas totales: ${salesTotal}`,14,28);
  doc.text(`Gastos totales: ${expTotal}`,14,36);
  doc.text(`Ganancia neta: ${profit}`,14,44);
  doc.text(`Generado ${new Date().toLocaleString()}`,14,54);
  doc.save(`reporte_${date}.pdf`);
}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('input[type=date]').forEach(i=>i.value=todayStr());
  loadProducts();renderClientsList();refreshReport();
  document.getElementById('createClientBtn').onclick=()=>createClient(clientName.value,clientDate.value);
  document.getElementById('filterDate').onchange=renderClientsList;
  document.getElementById('productSelect').onchange=updatePriceInputFromSelect;
  document.getElementById('addToCartBtn').onclick=addToCart;
  document.getElementById('finalizeSaleBtn').onclick=finalizeSale;
  document.getElementById('clearCartBtn').onclick=()=>{CART=[];renderCart();};
  document.getElementById('addExpenseBtn').onclick=addExpense;
  document.getElementById('refreshReportBtn').onclick=refreshReport;
  document.getElementById('exportSalesBtn').onclick=()=>exportCSV('sales');
  document.getElementById('exportExpensesBtn').onclick=()=>exportCSV('expenses');
  document.getElementById('exportPDFBtn').onclick=exportPDF;
  document.getElementById('clearClientsBtn').onclick=()=>{if(confirm('¿Borrar todos los clientes?'))localSave(LS.CLIENTS,[]),renderClientsList();};
});
