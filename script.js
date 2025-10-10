const LS = {
    PRODUCTS: 'bar_products', CLIENTS: 'bar_clients', SALES: 'bar_sales', EXPENSES: 'bar_expenses', OVERRIDES: 'bar_client_overrides', CART_HISTORY: 'bar_cart_history'
};

let CART = [];
let selectedClientId = null;
let blockedClients = []; // IDs de clientes bloqueados

// Utilidades
function localLoad(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; }
}
function localSave(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
}
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

// Cargar productos en el select
function loadProducts() {
    fetch('productos.json')
        .then(r => r.json())
        .then(productos => {
            localSave(LS.PRODUCTS, productos);
            const select = document.getElementById('productSelect');
            select.innerHTML = productos.map(p =>
                `<option value="${p.id}" data-precio="${p.precio}">${p.nombre}</option>`
            ).join('');
            select.addEventListener('change', e => {
                const precio = select.selectedOptions[0].getAttribute('data-precio');
                document.getElementById('productPrice').value = precio;
            });
            if (productos.length) {
                document.getElementById('productPrice').value = productos[0].precio;
            }
        });
}

// CLIENTES
function renderClientsList(date) {
    const clients = localLoad(LS.CLIENTS, []);
    const filtered = date ? clients.filter(c => c.createdAt === date) : clients;
    document.getElementById('clientsList').innerHTML = filtered.map(c =>
        `<div>
            <button class="btn btn-sm ${selectedClientId === c.id ? 'btn-success' : 'btn-outline-primary'}" onclick="selectClient('${c.id}')" ${blockedClients.includes(c.id) ? 'disabled' : ''}>${c.name}</button>
            <button class="btn btn-sm btn-primary" onclick="showClientSalesHistory('${c.id}')">💰 Consumo de ${c.name}</button>
            <label class="text-muted">
                <input type="checkbox" ${blockedClients.includes(c.id) ? 'checked' : ''} onchange="toggleBlockClient('${c.id}', this.checked)">✅Pago
            </label>
        </div>`
    ).join('');
    // Mostrar el cliente seleccionado en la parte superior
    const selected = clients.find(x => x.id === selectedClientId);
    document.getElementById('selectedClientHint').innerHTML = selected
        ? `<span class="badge bg-success">Cliente seleccionado: ${selected.name} (${selected.createdAt})</span>`
        : `<span class="text-muted">No hay cliente seleccionado</span>`;
}

function toggleBlockClient(clientId, checked) {
    if (checked) {
        if (!blockedClients.includes(clientId)) blockedClients.push(clientId);
    } else {
        blockedClients = blockedClients.filter(id => id !== clientId);
    }
    renderClientsList(); // Actualiza la lista para reflejar el estado
    // Si el cliente bloqueado estaba seleccionado, deselecciona
    if (selectedClientId === clientId && checked) {
        selectedClientId = null;
        document.getElementById('selectedClientHint').innerText = 'No hay cliente seleccionado';
        CART = [];
        renderCart();
    }
}

function createClient() {
    const name = document.getElementById('clientName').value.trim();
    const date = document.getElementById('clientDate').value || todayStr();
    if (!name) return alert('Ingrese nombre de cliente');
    const clients = localLoad(LS.CLIENTS, []);
    const id = 'c' + Date.now();
    clients.push({ id, name, createdAt: date });
    localSave(LS.CLIENTS, clients);
    renderClientsList(date);
    document.getElementById('clientName').value = '';
}

function clearClients() {
    localSave(LS.CLIENTS, []);
    renderClientsList();
}

function selectClient(cid) {
    if (blockedClients.includes(cid)) {
        alert('Este cliente está bloqueado para nuevas ventas.');
        return;
    }
    selectedClientId = cid;
    renderClientsList(); // Actualiza el resaltado y el hint
    if (CART.length > 0) saveClientCartHistory(cid, CART);
    CART = []; renderCart();
}


function showClientSalesHistory(cid) {
    const sales = localLoad(LS.SALES, []).filter(s => s.clientId === cid);
    const container = document.getElementById('clientSalesHistoryContainer');
    if (!sales.length) {
        container.innerHTML = '<div class="alert alert-info">Sin ventas registradas para este cliente.</div>';
        return;
    }
    const total = sales.reduce((a, b) => a + b.total, 0);
    const rows = sales.map(s =>
        `<tr>
            <td>${s.date}</td>
            <td>$${s.total}</td>
            <td>${s.items.map(i => `${i.name} x${i.qty}`).join(', ')}</td>
        </tr>`
    ).join('');
    container.innerHTML = `
        <h5>Historial de ventas del cliente</h5>
        <table class="table table-bordered table-sm">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Detalle</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            <tfoot>
                <tr>
                    <th colspan="1">Total ventas</th>
                    <th colspan="2">$${total}</th>
                </tr>
            </tfoot>
        </table>
    `;
}

function saveClientCartHistory(clientId, cart) {
    const date = todayStr();
    const history = loadCartHistory();
    history[clientId] = history[clientId] || {};
    history[clientId][date] = cart.map(item => ({ ...item }));
    saveCartHistory(history);
}
function loadCartHistory() { return localLoad(LS.CART_HISTORY, {}); }
function saveCartHistory(h) { localSave(LS.CART_HISTORY, h); }
function getClientCartHistory(clientId) {
    const history = loadCartHistory();
    return history[clientId] || {};
}

// CARRITO
function renderCart() {
    const tbody = document.querySelector('#cartTable tbody');
    tbody.innerHTML = CART.map((item, idx) =>
        `<tr>
            <td>${item.name}</td>
            <td>${item.price}</td>
            <td>${item.qty}</td>
            <td>${item.price * item.qty}</td>
            <td><button class="btn btn-sm btn-danger" onclick="removeFromCart(${idx})">✕</button></td>
        </tr>`
    ).join('');
    document.getElementById('cartTotal').innerText = CART.reduce((a, b) => a + b.price * b.qty, 0);
}

function addToCart() {
    if (!selectedClientId) return alert('Seleccione un cliente');
    const select = document.getElementById('productSelect');
    const productos = localLoad(LS.PRODUCTS, []);
    const prodId = select.value;
    const prod = productos.find(p => p.id === prodId);
    const qty = parseInt(document.getElementById('productQty').value, 10) || 1;
    const price = parseInt(document.getElementById('productPrice').value, 10) || prod.precio;
    if (!prod) return alert('Producto inválido');
    CART.push({ id: prodId, name: prod.nombre, price, qty });
    renderCart();
}

function removeFromCart(idx) {
    CART.splice(idx, 1);
    renderCart();
}

function clearCart() {
    CART = [];
    renderCart();
}

function finalizeSale() {
    if (!selectedClientId) return alert('Seleccione un cliente');
    if (!CART.length) return alert('Carrito vacío');
    const sales = localLoad(LS.SALES, []);
    sales.push({
        clientId: selectedClientId,
        items: CART.map(i => ({ ...i })),
        total: CART.reduce((a, b) => a + b.price * b.qty, 0),
        date: todayStr()
    });
    localSave(LS.SALES, sales);
    CART = [];
    renderCart();
    alert('Venta registrada');
}

// GASTOS
function addExpense() {
    const desc = document.getElementById('expenseDesc').value.trim();
    const amount = parseInt(document.getElementById('expenseAmount').value, 10);
    const date = document.getElementById('expenseDate').value || todayStr();
    if (!desc || !amount) return alert('Complete los datos del gasto');
    const expenses = localLoad(LS.EXPENSES, []);
    expenses.push({ desc, amount, date });
    localSave(LS.EXPENSES, expenses);
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseDate').value = '';
    alert('Gasto registrado');
}

// REPORTE
function renderReport(date) {
    const sales = localLoad(LS.SALES, []);
    const expenses = localLoad(LS.EXPENSES, []);
    const salesDay = sales.filter(s => s.date === date);
    const expensesDay = expenses.filter(e => e.date === date);
    const totalSales = salesDay.reduce((a, b) => a + b.total, 0);
    const totalExpenses = expensesDay.reduce((a, b) => a + b.amount, 0);

    document.getElementById('reportSalesTotal').innerText = totalSales;
    document.getElementById('reportExpensesTotal').innerText = totalExpenses;
    document.getElementById('reportProfit').innerText = totalSales - totalExpenses;
    document.getElementById('reportCounts').innerText =
        `Ventas: ${salesDay.length}, Gastos: ${expensesDay.length}`;
}

// EXPORTACIONES
function exportCSV(data, filename) {
    const keys = Object.keys(data[0] || {});
    const csv = [keys.join(',')].concat(
        data.map(row => keys.map(k => `"${row[k]}"`).join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

function exportSalesCSV(date) {
    const sales = localLoad(LS.SALES, []).filter(s => s.date === date);
    exportCSV(sales, `ventas_${date}.csv`);
}
function exportExpensesCSV(date) {
    const expenses = localLoad(LS.EXPENSES, []).filter(e => e.date === date);
    exportCSV(expenses, `gastos_${date}.csv`);
}

function exportPDFReport(date) {
    const sales = localLoad(LS.SALES, []).filter(s => s.date === date);
    const expenses = localLoad(LS.EXPENSES, []).filter(e => e.date === date);
    const doc = new window.jspdf.jsPDF();

    doc.text(`Reporte Diario - ${date}`, 10, 10);
    doc.text(`Ventas: ${sales.length}`, 10, 20);
    doc.text(`Total Ventas: ${sales.reduce((a, b) => a + b.total, 0)}`, 10, 30);

    // Listado de ventas
    let y = 40;
    doc.text('Detalle de Ventas:', 10, y);
    y += 7;
    if (sales.length) {
        sales.forEach(s => {
            doc.text(`- $${s.total}: ${s.items.map(i => `${i.name} x${i.qty}`).join(', ')}`, 12, y);
            y += 7;
        });
    } else {
        doc.text('No hay ventas registradas.', 12, y);
        y += 7;
    }

    // Listado de gastos
    doc.text(`Gastos: ${expenses.length}`, 10, y);
    y += 7;
    doc.text(`Total Gastos: ${expenses.reduce((a, b) => a + b.amount, 0)}`, 10, y);
    y += 7;
    doc.text('Detalle de Gastos:', 10, y);
    y += 7;
    if (expenses.length) {
        expenses.forEach(e => {
            doc.text(`- $${e.amount}: ${e.desc}`, 12, y);
            y += 7;
        });
    } else {
        doc.text('No hay gastos registrados.', 12, y);
        y += 7;
    }

    // Ganancia
    doc.text(`Ganancia: ${sales.reduce((a, b) => a + b.total, 0) - expenses.reduce((a, b) => a + b.amount, 0)}`, 10, y);

    doc.save(`reporte_${date}.pdf`);
}

// INICIALIZACIÓN DE EVENTOS
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    renderClientsList();

    document.getElementById('createClientBtn').addEventListener('click', createClient);
    document.getElementById('clearClientsBtn').addEventListener('click', clearClients);
    document.getElementById('filterDate').addEventListener('change', e => renderClientsList(e.target.value));
    document.getElementById('addToCartBtn').addEventListener('click', addToCart);
    document.getElementById('clearCartBtn').addEventListener('click', clearCart);
    document.getElementById('finalizeSaleBtn').addEventListener('click', finalizeSale);
    document.getElementById('addExpenseBtn').addEventListener('click', addExpense);

    document.getElementById('refreshReportBtn').addEventListener('click', () => {
        const date = document.getElementById('reportDate').value || todayStr();
        renderReport(date);
    });
    document.getElementById('exportSalesBtn').addEventListener('click', () => {
        const date = document.getElementById('reportDate').value || todayStr();
        exportSalesCSV(date);
    });
    document.getElementById('exportExpensesBtn').addEventListener('click', () => {
        const date = document.getElementById('reportDate').value || todayStr();
        exportExpensesCSV(date);
    });
    document.getElementById('exportPDFBtn').addEventListener('click', () => {
        const date = document.getElementById('reportDate').value || todayStr();
        exportPDFReport(date);
    });

    renderReport(todayStr());
});