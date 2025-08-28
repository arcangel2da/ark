/* ------------------------
    ESTRUCTURAS EN LOCALSTORAGE
    - routes: [{id,name,logoData}]
    - loans: [{id,routeId,cliente,cedula,telefono,direccion,monto,interes,totalConInteres,cuotas:[{numero,monto,pagado,fechaPago,status,dueDate,abonos:[{monto,fecha}]}]}]
    ------------------------ */

const LS_ROUTES = 'prest_routes_v1';
const LS_LOANS = 'prest_loans_v1';
const MAX_ROUTES = 10;
let currentRouteId = null; // Variable global para la ruta activa

/* utilidades */
const $ = id => document.getElementById(id);
const q = sel => document.querySelector(sel);
const formatCOP = n => {
    if (n==null) return '0';
    return Number(n).toLocaleString('es-CO', {maximumFractionDigits:0});
};
const uid = (p='') => p + Math.random().toString(36).slice(2,9).toUpperCase();

/* carga/guardar */
function loadRoutes(){ return JSON.parse(localStorage.getItem(LS_ROUTES) || '[]'); }
function saveRoutes(r){ localStorage.setItem(LS_ROUTES, JSON.stringify(r)); }
function loadLoans(){ return JSON.parse(localStorage.getItem(LS_LOANS) || '[]'); }
function saveLoans(l){ localStorage.setItem(LS_LOANS, JSON.stringify(l)); }

/* Inicializar UI */
function init(){
    renderRoutesList();
    populateRouteSelect();
    renderLoansTable(currentRouteId);
    updateTotals(currentRouteId);
    renderTodayCollections();
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});

/* ---- RUTAS ---- */
$('btnAddRoute').addEventListener('click', async ()=>{
    const name = $('routeName').value.trim();
    const fileInput = $('routeLogoFile');
    const url = $('routeLogoURL').value.trim();

    let routes = loadRoutes();
    if(routes.length >= MAX_ROUTES){ alert('Máximo de rutas alcanzado.'); return; }
    if(!name){ alert('Escribe un nombre para la ruta.'); return; }

    let logoData = '';
    if(fileInput.files && fileInput.files[0]){
        logoData = await fileToDataURL(fileInput.files[0]);
    } else if(url){
        logoData = url;
    } else {
        logoData = '';
    }

    routes.push({ id: uid('R-'), name, logo: logoData });
    saveRoutes(routes);
    $('routeName').value=''; $('routeLogoFile').value=''; $('routeLogoURL').value='';
    init();
});

$('btnResetRoutes').addEventListener('click', ()=>{
    if(!confirm('Borrar todas las rutas y préstamos?')) return;
    localStorage.removeItem(LS_ROUTES); localStorage.removeItem(LS_LOANS);
    init();
    renderTodayCollections();
});

/* convertir archivo a dataURL */
function fileToDataURL(file){
    return new Promise((res, rej)=>{
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = e => rej(e);
        r.readAsDataURL(file);
    });
}

function renderRoutesList(){
    const wrap = $('routesList'); wrap.innerHTML='';
    const routes = loadRoutes();
    routes.forEach(rt=>{
        const div = document.createElement('div');
        div.className='route';
        div.addEventListener('click', () => {
            const selectElement = $('routeSelect');
            selectElement.value = rt.id;
            const event = new Event('change');
            selectElement.dispatchEvent(event);
        });

        const img = document.createElement('img'); img.src = rt.logo || placeholderLogo(rt.name);
        const meta = document.createElement('div'); meta.className='meta';
        meta.innerHTML = `<div style="font-weight:700">${rt.name}</div><div class="small muted-small">ID: ${rt.id}</div>`;
        const actions = document.createElement('div');
        actions.innerHTML = `<button class="btn ghost" onclick="event.stopPropagation(); editRoute('${rt.id}')">Editar</button>
                            <button class="btn" style="background:#ff6b6b" onclick="event.stopPropagation(); deleteRoute('${rt.id}')">Eliminar</button>`;
        div.appendChild(img); div.appendChild(meta); div.appendChild(actions);
        wrap.appendChild(div);
    });
}

function placeholderLogo(name){
    const initial = (name||'R').charAt(0).toUpperCase();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='#eef6ff'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='#2b7cff' font-family='Segoe UI'>${initial}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

function editRoute(id){
    const routes = loadRoutes();
    const rt = routes.find(r=>r.id===id);
    if(!rt) return;
    const newName = prompt('Nuevo nombre de la ruta', rt.name);
    if(newName===null) return;
    rt.name = newName.trim() || rt.name;
    saveRoutes(routes); init();
}

function deleteRoute(id){
    if(!confirm('Eliminar ruta y todos sus préstamos?')) return;
    let routes = loadRoutes(); routes = routes.filter(r=>r.id!==id); saveRoutes(routes);
    let loans = loadLoans(); loans = loans.filter(l=>l.routeId!==id); saveLoans(loans);
    init();
}

/* Funciones para el select de rutas */
function populateRouteSelect() {
    const select = $('routeSelect');
    select.innerHTML = '';
    const routes = loadRoutes();
    
    if (routes.length > 0) {
        routes.forEach(route => {
            const option = document.createElement('option');
            option.value = route.id;
            option.textContent = route.name;
            select.appendChild(option);
        });
        currentRouteId = routes[0].id;
    } else {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No hay rutas';
        select.appendChild(option);
        currentRouteId = null;
    }
    updateRouteInfo(currentRouteId);
}

$('routeSelect').addEventListener('change', (e) => {
    currentRouteId = e.target.value;
    updateRouteInfo(currentRouteId);
});

function updateRouteInfo(routeId) {
    const route = loadRoutes().find(r => r.id === routeId);
    $('selRouteName').innerText = route ? route.name : '(Ninguna)';
    renderLoansTable(routeId);
    updateTotals(routeId);
}

/* ---- PRÉSTAMOS ---- */
$('btnAddLoan').addEventListener('click', ()=>{
    const routeId = $('routeSelect').value;
    const cliente = $('cliente').value.trim();
    const cedula = $('cedula').value.trim();
    const telefono = $('telefono').value.trim();
    const direccion = $('direccion').value.trim();
    const frecuencia = $('frecuencia').value;
    const startDate = $('startDateInput').value;
    const firstPaymentDateStr = $('firstPaymentDateInput').value;
    const monto = Number($('monto').value);
    const interes = Number($('interes').value);
    const cuotasNum = parseInt($('cuotas').value);

    // Si no hay una ruta activa, no se puede crear
    if(!routeId){ alert('Selecciona una ruta antes de crear un préstamo.'); return; }
    if(!cliente || !monto || !cuotasNum || isNaN(interes) || !startDate || !firstPaymentDateStr){ alert('Completa todos los campos'); return; }
    const total = Number((monto + (monto * interes/100)).toFixed(2));
    const cuotaMonto = Number((total / cuotasNum).toFixed(2));
    
    const cuotas = [];
    const [year, month, day] = firstPaymentDateStr.split('-').map(Number);
    let nextDate = new Date(year, month - 1, day);

    for(let i=1;i<=cuotasNum;i++){
        let currentDueDate = new Date(nextDate);
        if (i > 1) {
            if (frecuencia === 'DIARIO') {
                currentDueDate.setDate(nextDate.getDate() + 1);
                // Saltar domingos
                while (currentDueDate.getDay() === 0) {
                    currentDueDate.setDate(currentDueDate.getDate() + 1);
                }
            } else if (frecuencia === 'SEMANAL') {
                currentDueDate.setDate(nextDate.getDate() + 7);
            } else if (frecuencia === 'QUINCENAL') {
                currentDueDate.setDate(nextDate.getDate() + 15);
            } else if (frecuencia === 'MENSUAL') {
                currentDueDate.setMonth(nextDate.getMonth() + 1);
            }
        }
        nextDate = currentDueDate;
        cuotas.push({ 
            numero:i, 
            monto:cuotaMonto, 
            pagado:false, 
            fechaPago:null, 
            status: 'pending',
            dueDate: currentDueDate.toISOString(), // Guardar fecha de vencimiento
            abonos: [] // Array para guardar abonos
        });
    }

    const loans = loadLoans();
    const loan = { 
        id: uid('L-'), 
        routeId, 
        cliente, 
        cedula, 
        telefono, 
        direccion, 
        frecuencia, 
        startDate: new Date(startDate).toISOString(), 
        firstPaymentDate: new Date(firstPaymentDateStr).toISOString(), 
        monto, 
        interes, 
        totalConInteres: total, 
        cuotas,
    };
    loans.push(loan); saveLoans(loans);
    $('cliente').value=''; $('cedula').value=''; $('telefono').value=''; $('direccion').value=''; $('monto').value=''; $('interes').value=''; $('cuotas').value='';
    renderLoansTable(routeId); updateTotals(routeId); alert('Préstamo creado');
    renderTodayCollections();
});

function renderLoansTable(routeId){
    const tbody = document.querySelector('#loansTableBody'); tbody.innerHTML='';
    const loans = loadLoans().filter(l=>l.routeId===routeId);
    const routes = loadRoutes();
    loans.forEach(l=>{
        const rt = routes.find(r=>r.id===l.routeId);
        const saldo = l.cuotas.filter(c=>c.status!=='paid').reduce((s,c)=>s + Number(c.monto) - (c.abonos?c.abonos.reduce((a,b)=>a+b.monto,0):0),0);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${l.cliente}</td>
                        <td>${rt?rt.name:'(ruta borrada)'}</td>
                        <td>$${formatCOP(l.totalConInteres)}</td>
                        <td>${l.cuotas.length}</td>
                        <td>$${formatCOP(saldo)}</td>
                        <td class="actions">
                            <button class="btn ghost" onclick="openPlan('${l.id}')">Ver plan</button>
                            <button class="btn" style="background:#2ecc71" onclick="renewLoan('${l.id}')">Renovar</button>
                            <button class="btn" style="background:#ff6b6b" onclick="deleteLoan('${l.id}')">Eliminar</button>
                        </td>`;
        tbody.appendChild(tr);
    });
}

function deleteLoan(id){
    if(!confirm('Eliminar préstamo?')) return;
    let loans = loadLoans(); loans = loans.filter(x=>x.id!==id); saveLoans(loans);
    renderLoansTable(currentRouteId); updateTotals(currentRouteId); renderTodayCollections();
}

function renewLoan(id) {
    if (!confirm('¿Seguro que quieres renovar este préstamo? Esto creará un nuevo préstamo con los mismos datos y reiniciará el contador.')) {
        return;
    }

    const loans = loadLoans();
    const oldLoan = loans.find(l => l.id === id);
    if (!oldLoan) {
        alert('Préstamo no encontrado');
        return;
    }

    const total = Number((oldLoan.monto + (oldLoan.monto * oldLoan.interes / 100)).toFixed(2));
    const cuotaMonto = Number((total / oldLoan.cuotas.length).toFixed(2));

    const newCuotas = [];
    let nextDate = new Date();

    for(let i = 1; i <= oldLoan.cuotas.length; i++) {
        let currentDueDate = new Date(nextDate);
        if (i > 1) {
            if (oldLoan.frecuencia === 'DIARIO') {
                currentDueDate.setDate(currentDueDate.getDate() + 1);
                // Saltar domingos
                while (currentDueDate.getDay() === 0) {
                    currentDueDate.setDate(currentDueDate.getDate() + 1);
                }
            } else if (oldLoan.frecuencia === 'SEMANAL') {
                currentDueDate.setDate(currentDueDate.getDate() + 7);
            } else if (oldLoan.frecuencia === 'QUINCENAL') {
                currentDueDate.setDate(currentDueDate.getDate() + 15);
            } else if (oldLoan.frecuencia === 'MENSUAL') {
                currentDueDate.setMonth(currentDueDate.getMonth() + 1);
            }
        }
        nextDate = currentDueDate;
        newCuotas.push({
            numero: i,
            monto: cuotaMonto,
            pagado: false,
            fechaPago: null,
            status: 'pending',
            dueDate: currentDueDate.toISOString(),
            abonos: []
        });
    }

    const newLoan = {
        id: uid('L-'),
        routeId: oldLoan.routeId,
        cliente: oldLoan.cliente,
        cedula: oldLoan.cedula,
        telefono: oldLoan.telefono,
        direccion: oldLoan.direccion,
        frecuencia: oldLoan.frecuencia,
        startDate: new Date().toISOString(),
        firstPaymentDate: new Date().toISOString(),
        monto: oldLoan.monto,
        interes: oldLoan.interes,
        totalConInteres: total,
        cuotas: newCuotas,
    };

    loans.push(newLoan);
    saveLoans(loans);

    alert('Préstamo renovado con éxito. Se ha creado un nuevo préstamo.');
    renderLoansTable(currentRouteId);
    updateTotals(currentRouteId);
    renderTodayCollections();
}

/* abrir plan por loan id */
function openPlan(loanId){
    const loans = loadLoans(); const loan = loans.find(l=>l.id===loanId);
    if(!loan) return alert('Préstamo no encontrado');
    showPlanModal(loan);
}

/* modal plan */
function showPlanModal(loan){
    const routes = loadRoutes(); const route = routes.find(r=>r.id===loan.routeId);
    $('planMeta').innerText = `${loan.cliente} · Ruta: ${route?route.name:'(ruta)'} · Total: $${formatCOP(loan.totalConInteres)}`;
    const saldo = loan.cuotas.filter(c=>c.status!=='paid').reduce((s,c)=>s + Number(c.monto) - (c.abonos?c.abonos.reduce((a,b)=>a+b.monto,0):0),0);
    const paidAmount = loan.cuotas.reduce((sum, c) => {
        const abonosSum = (c.abonos || []).reduce((a, b) => a + Number(b.monto), 0);
        return sum + abonosSum + (c.status === 'paid' ? Number(c.monto) : 0);
    }, 0);
    $('planSummary').innerHTML = `<div style="display:flex;gap:12px;align-items:center;justify-content:space-between">
        <div>
            <div class="small muted-small">Monto inicial</div>
            <div style="font-weight:700">$${formatCOP(loan.monto)}</div>
        </div>
        <div>
            <div class="small muted-small">Tasa</div>
            <div style="font-weight:700">${loan.interes}%</div>
        </div>
        <div>
            <div class="small muted-small">Total con interés</div>
            <div style="font-weight:700">$${formatCOP(loan.totalConInteres)}</div>
        </div>
        <div>
            <div class="small muted-small">Saldo restante</div>
            <div style="font-weight:700">$${formatCOP(saldo)}</div>
        </div>
    </div>`;

    let table = `<table class="table-cuotas"><thead><tr><th>#</th><th>Vence</th><th>Monto</th><th>Saldo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>`;
    loan.cuotas.forEach((c, idx)=>{
        const abonosPagados = (c.abonos || []).reduce((sum, abono) => sum + Number(abono.monto), 0);
        const saldoCuota = c.monto - abonosPagados;
        let statusText = '';
        if (c.status === 'paid') {
            statusText = `<span class="success">Pagado</span>`;
        } else if (c.status === 'unpaid') {
            statusText = `<span class="error">No Pagado</span>`;
        } else {
            statusText = `<span class="muted-small">Pendiente</span>`;
        }
        
        const due = new Date(c.dueDate);
        const dueFormatted = `${due.getDate()}/${due.getMonth()+1}/${due.getFullYear()}`;
        
        let actionButtons = `
            <button class="btn-cuota" style="background:#2ecc71" onclick="updateQuotaStatus('${loan.id}',${idx},'paid')">Pagado</button>
            <button class="btn-cuota" style="background:#ff6b6b" onclick="updateQuotaStatus('${loan.id}',${idx},'unpaid')">No Pago</button>
            <button class="btn-cuota" style="background:#ccc" onclick="updateQuotaStatus('${loan.id}',${idx},'pending')">Pendiente</button>
            <button class="btn-cuota" style="background:var(--primary)" onclick="addAbono('${loan.id}',${idx})">Abonar</button>
            <button class="btn-cuota btn-recibo" onclick="showQuotaReceipt('${loan.id}',${idx})">Recibo</button>
        `;
        
        table += `<tr>
            <td>${c.numero}</td>
            <td onclick="updateQuotaDueDate('${loan.id}',${idx})">${dueFormatted}</td>
            <td>$${formatCOP(c.monto)}</td>
            <td>$${formatCOP(saldoCuota)}</td>
            <td>${statusText}</td>
            <td>${actionButtons}</td>
        </tr>`;
    });
    table += `</tbody></table>`;
    $('planTableWrap').innerHTML = table;
    $('modalPlan').style.display = 'flex';
}

function updateQuotaStatus(loanId, cuotaIndex, newStatus) {
    const loans = loadLoans();
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    if (newStatus === 'paid' && !confirm('¿Estás seguro de que quieres marcar esta cuota como pagada?')) return;
    if (newStatus === 'unpaid' && !confirm('¿Estás seguro de que quieres marcar esta cuota como no pagada?')) return;
    if (newStatus === 'pending' && !confirm('¿Estás seguro de que quieres marcar esta cuota como pendiente?')) return;
    
    const cuota = loan.cuotas[cuotaIndex];
    cuota.status = newStatus;
    cuota.pagado = (newStatus === 'paid');
    cuota.fechaPago = (newStatus !== 'pending') ? new Date().toLocaleString() : null;
    
    saveLoans(loans);
    showPlanModal(loan);
    renderLoansTable(currentRouteId);
    updateTotals(currentRouteId);
    renderTodayCollections();
}

function addAbono(loanId, cuotaIndex) {
    const abono = prompt('Ingrese el monto del abono:');
    if (abono === null || isNaN(abono) || Number(abono) <= 0) return;
    
    const loans = loadLoans();
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    let remainingAbono = Number(abono);
    
    for (let i = cuotaIndex; i < loan.cuotas.length && remainingAbono > 0; i++) {
        const cuota = loan.cuotas[i];
        if (cuota.status === 'paid') continue;
        
        const abonosPagados = (cuota.abonos || []).reduce((sum, a) => sum + Number(a.monto), 0);
        const saldoCuota = cuota.monto - abonosPagados;
        
        if (saldoCuota <= 0) {
            cuota.status = 'paid';
            cuota.pagado = true;
            continue;
        }
        
        const abonoAplicado = Math.min(saldoCuota, remainingAbono);
        
        if (!cuota.abonos) cuota.abonos = [];
        cuota.abonos.push({ monto: abonoAplicado, fecha: new Date().toLocaleString() });
        
        remainingAbono -= abonoAplicado;
        
        if (cuota.monto - (abonosPagados + abonoAplicado) <= 0) {
            cuota.status = 'paid';
            cuota.pagado = true;
        }
    }
    
    saveLoans(loans);
    showPlanModal(loan);
    renderLoansTable(currentRouteId);
    updateTotals(currentRouteId);
    renderTodayCollections();
}

function updateQuotaDueDate(loanId, cuotaIndex) {
    const loans = loadLoans();
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    const cuota = loan.cuotas[cuotaIndex];
    const newDateStr = prompt('Ingrese la nueva fecha de vencimiento (YYYY-MM-DD):', new Date(cuota.dueDate).toISOString().split('T')[0]);
    
    if (newDateStr === null) return;
    
    const newDate = new Date(newDateStr);
    if (isNaN(newDate.getTime())) {
        alert('Fecha inválida. Use el formato YYYY-MM-DD.');
        return;
    }
    
    cuota.dueDate = newDate.toISOString();
    saveLoans(loans);
    showPlanModal(loan);
    renderTodayCollections();
}


/* mostrar recibo bonito */
function showQuotaReceipt(loanId, cuotaIndex, autoOpenPlan=false){
    const loans = loadLoans();
    const routes = loadRoutes();
    const loan = loans.find(l=>l.id===loanId);
    if(!loan) return;
    const route = routes.find(r=>r.id===loan.routeId);
    const c = loan.cuotas[cuotaIndex];
    
    // Calcular el saldo restante del préstamo
    const saldoTotal = loan.cuotas.filter(cuota => cuota.status !== 'paid').reduce((sum, cuota) => {
        const abonosSum = (cuota.abonos || []).reduce((a, b) => a + Number(b.monto), 0);
        return sum + (Number(cuota.monto) - abonosSum);
    }, 0);

    const logo = (loan.logo || (route && route.logo) || placeholderLogo(route?route.name:'Ruta'));
    
    let statusIcon = '';
    let statusText = '';
    
    if(c.status === 'paid') {
        statusIcon = `<div style="width:20px;height:20px;background:#2ecc71;border-radius:50%;margin-right:8px"></div>`;
        statusText = 'RECIBO DE PAGO';
    } else if (c.status === 'unpaid') {
        statusIcon = `<div style="width:20px;height:20px;background:#ff6b6b;border-radius:50%;margin-right:8px"></div>`;
        statusText = 'CUOTA NO PAGADA';
    } else {
        statusText = 'RECIBO DE CUOTA';
    }
    
    const html = `
        <div class="recibo-preview">
            <div class="recibo-header center">
                <img src="${logo}" alt="logo" onerror="this.src='${placeholderLogo(route?route.name:'R')}'">
                <div style="font-weight:800;margin-top:8px">${route?route.name:'(Ruta)'}</div>
                <div class="muted">${route?route.name:''}</div>
            </div>
            <div style="padding:12px 0">
                <div class="recibo-title center" style="display:flex;justify-content:center;align-items:center">
                    ${statusIcon}
                    ${statusText}
                </div>
                <div style="margin-top:8px">
                    <div><strong>Cliente</strong><div class="muted-small">${loan.cliente}</div></div>
                    ${loan.cedula ? `<div><strong>Cédula</strong><div class="muted-small">${loan.cedula}</div></div>` : ''}
                    ${loan.telefono ? `<div><strong>Teléfono</strong><div class="muted-small">${loan.telefono}</div></div>` : ''}
                    ${loan.direccion ? `<div><strong>Dirección</strong><div class="muted-small">${loan.direccion}</div></div>` : ''}
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:8px">
                    <div><strong>Fecha</strong><div class="muted-small">${c.fechaPago || new Date().toLocaleString()}</div></div>
                </div>
                <hr style="margin: 8px 0;">
                <div style="display:flex;justify-content:space-between">
                    <div><strong>Pago N°</strong><div class="muted-small">${c.numero}</div></div>
                    <div><strong>Monto</strong><div class="muted-small">$${formatCOP(c.monto)}</div></div>
                </div>
                <div style="margin-top:10px;display:flex;justify-content:space-between">
                    <div><strong>Saldo total restante</strong><div class="muted-small" id="reciboSaldo">$${formatCOP(saldoTotal)}</div></div>
                </div>
                <div style="margin-top:10px;text-align:center;">
                    <div style="font-weight: bold;margin-bottom:5px;">Atrasos</div>
                    <input type="number" id="atrasoInput" value="0" min="0" style="width: 80px; text-align: center; border: 1px solid #ddd; padding: 5px; border-radius: 4px;">
                </div>
                <div class="linea-firma"><div>Firma autorizada</div></div>
                <div class="recibo-footer center muted-small" style="margin-top:10px">Gracias por su pago</div>
            </div>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
                <button class="btn" onclick="window.print()">Imprimir</button>
                <a class="btn" id="btnReciboWA" style="background:#25d366;color:#fff;text-decoration:none" href="#" target="_blank">Enviar WhatsApp</a>
            </div>
        </div>
    `;

    $('reciboBody').innerHTML = html;
    $('modalRecibo').style.display = 'flex';

    const atrasoInput = $('atrasoInput');
    const waLink = $('btnReciboWA');
    const atrasoTextElement = document.createElement('span');
    atrasoTextElement.id = 'atrasoTexto';
    atrasoInput.parentNode.insertBefore(atrasoTextElement, atrasoInput.nextSibling);

    const updateAtrasoText = () => {
        const atrasos = atrasoInput.value ? parseInt(atrasoInput.value) : 0;
        atrasoTextElement.innerText = atrasos > 0 ? ` (${atrasos} días)` : '';
        if (atrasos > 0) {
            atrasoTextElement.classList.add('atrasos-rojo');
        } else {
            atrasoTextElement.classList.remove('atrasos-rojo');
        }
    };

    // Función para actualizar el enlace de WhatsApp y el texto de atrasos
    const updateWAlink = () => {
        const atrasos = atrasoInput.value ? parseInt(atrasoInput.value) : 0;
        waLink.href = waShareLink(loan, c, route, saldoTotal, atrasos);
        updateAtrasoText();
    };

    // Escuchar cambios en el input de atrasos
    atrasoInput.addEventListener('input', updateWAlink);
    
    // Inicializar el enlace de WhatsApp y el texto de atrasos con el valor predeterminado
    updateWAlink();

    renderLoansTable(currentRouteId);
    updateTotals(currentRouteId);
}

/* Generar link WhatsApp con texto, ahora con atrasos */
function waShareLink(loan, cuota, route, saldo, atrasos=0){
    const rname = route?route.name: 'Ruta';
    const atrasoText = atrasos > 0 ? `\n*Atrasos*: ${atrasos} días` : '';
    const texto = `*Recibo*%0ARuta: ${rname}%0ACliente: ${loan.cliente}%0APago N° ${cuota.numero}: $${formatCOP(cuota.monto)}%0ASaldo total restante: $${formatCOP(saldo)}%0AFecha: ${cuota.fechaPago || new Date().toLocaleString()}${atrasoText}`;
    return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

/* enviar WA desde plan (sin abrir recibo) */
function sendWA(loanId, cuotaIndex){
    const loans = loadLoans(); 
    const routes = loadRoutes(); 
    const loan = loans.find(l=>l.id===loanId);
    const route = routes.find(r=>r.id===loan.routeId);
    const cuota = loan.cuotas[cuotaIndex];
    const saldo = loan.cuotas.filter(x=>x.status!=='paid').reduce((s,x)=>s + Number(x.monto),0);
    const url = waShareLink(loan, cuota, route, saldo);
    window.open(url,'_blank');
}

/* cerrar modal */
function closeModal(id){ $(id).style.display = 'none'; }
function closeModalByElem(elemId){ document.getElementById(elemId).style.display='none'; }

/* actualizar totales por ruta y general */
function updateTotals(routeId = null){
    const loans = loadLoans();
    let totalLoans = loans.length;
    let totalOnTheStreet = 0;
    let totalCollected = 0;
    
    const filteredLoans = routeId ? loans.filter(l => l.routeId === routeId) : loans;
    
    filteredLoans.forEach(loan => {
        const paidAmount = loan.cuotas.reduce((sum, c) => {
            const abonosSum = (c.abonos || []).reduce((a, b) => a + Number(b.monto), 0);
            return sum + abonosSum + (c.status === 'paid' ? Number(c.monto) : 0);
        }, 0);
        totalCollected += paidAmount;
        totalOnTheStreet += (loan.totalConInteres - paidAmount);
    });

    $('totalLoans').innerText = loans.length;
    $('totalGeneral').innerText = '$' + formatCOP(loans.reduce((s,l)=>s + Number(l.totalConInteres || 0),0));
    $('totalOnTheStreet').innerText = '$' + formatCOP(Math.max(0, totalOnTheStreet));
    $('totalCollected').innerText = '$' + formatCOP(totalCollected);

    if (routeId) {
        const route = loadRoutes().find(r => r.id === routeId);
        const sum = filteredLoans.reduce((acc, l) => acc + Number(l.totalConInteres || 0), 0);
        $('selRouteSum').innerText = `Total en esta ruta: $${formatCOP(sum)}`;
    }
}

/* Funciones para cobros de hoy y próximos cobros */
function renderTodayCollections() {
    const loans = loadLoans();
    const today = new Date();
    const container = $('todayCollections');
    container.innerHTML = '';
    
    let dueTodayFound = false;
    loans.forEach(loan => {
        const nextQuota = loan.cuotas.find(c => c.status === 'pending');
        if (nextQuota) {
            const dueDate = new Date(nextQuota.dueDate);
            const isDueToday = dueDate.getDate() === today.getDate() &&
                               dueDate.getMonth() === today.getMonth() &&
                               dueDate.getFullYear() === today.getFullYear();
            
            if (isDueToday) {
                dueTodayFound = true;
                const div = document.createElement('div');
                div.style = "display:flex;justify-content:space-between;align-items:center;padding:4px 0";
                div.innerHTML = `<div>${loan.cliente}</div>
                                 <div class="muted-small" style="font-weight:700">$${formatCOP(nextQuota.monto)}</div>`;
                container.appendChild(div);
            }
        }
    });

    if (!dueTodayFound) {
        container.innerHTML = '<span class="muted-small">No hay cobros pendientes para hoy.</span>';
    }
}

/* exportar JSON */
$('btnExport').addEventListener('click', ()=>{
    const data = { routes: loadRoutes(), loans: loadLoans() };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `prestamos_export_${new Date().toISOString().slice(0,10)}.json`; a.click();
});

/* importar JSON */
$('btnImport').addEventListener('click', () => {
    $('importFile').click();
});

$('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const importedData = JSON.parse(event.target.result);
            if (importedData.routes && importedData.loans) {
                if (confirm('¿Estás seguro de que quieres importar estos datos? Se sobreescribirán todos los datos actuales.')) {
                    saveRoutes(importedData.routes);
                    saveLoans(importedData.loans);
                    alert('Datos importados con éxito.');
                    init();
                }
            } else {
                alert('El archivo no tiene el formato correcto. Debe contener "routes" y "loans".');
            }
        } catch (error) {
            alert('Error al leer el archivo. Asegúrate de que es un archivo JSON válido.');
            console.error(error);
        }
    };
    reader.readAsText(file);
});


/* exponer funciones a global (para onclicks en html) */
window.editRoute = editRoute;
window.deleteRoute = deleteRoute;
window.renewLoan = renewLoan;
window.openPlan = openPlan;
window.deleteLoan = deleteLoan;
window.updateQuotaStatus = updateQuotaStatus;
window.addAbono = addAbono;
window.updateQuotaDueDate = updateQuotaDueDate;
window.showQuotaReceipt = showQuotaReceipt;
window.sendWA = sendWA;
window.closeModal = closeModal;