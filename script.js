// ==========================================
// ESTADO DA APLICAÇÃO (Dados em Memória)
// ==========================================
let products = [];
// Estrutura de Sale: { id, date, productName, quantity, revenue, profit }
let sales = [];
let currentCart = []; // Carrinho temporário do PDV
let isLoggedIn = false;

// Helpers de formatação
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatDate = (isoString) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
function init() {
    loadData();
    checkAuth();
    setupEvents();
    renderOpenTablesDataList();
}

function loadData() {
    const savedProducts = localStorage.getItem('appProducts');
    const savedSales = localStorage.getItem('appSales');

    if (savedProducts) products = JSON.parse(savedProducts);
    if (savedSales) sales = JSON.parse(savedSales);
}

function saveData() {
    localStorage.setItem('appProducts', JSON.stringify(products));
    localStorage.setItem('appSales', JSON.stringify(sales));
}

// ==========================================
// AUTENTICAÇÃO (LOGIN FAKE)
// ==========================================
function checkAuth() {
    isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const userRole = localStorage.getItem('userRole') || 'admin';
    const overlay = document.getElementById('loginOverlay');
    const mainApp = document.getElementById('mainApp');

    if (isLoggedIn) {
        overlay.style.display = 'none';
        mainApp.style.display = 'flex';
        renderAll();

        // Controle de Acesso (Níveis)
        const navDashboard = document.querySelector('[data-tab="dashboard"]');
        const navReports = document.querySelector('[data-tab="reports"]');
        const userNameDisplay = document.getElementById('userNameDisplay');

        if (userRole === 'caixa') {
            if (navDashboard) navDashboard.style.display = 'none';
            if (navReports) navReports.style.display = 'none';
            if (userNameDisplay) userNameDisplay.innerText = 'Caixa/Garçom';

            // Força o redirecionamento para a aba "Vendas" se a Dashboard (que está oculta) estiver ativa
            if (document.getElementById('tab-dashboard').classList.contains('active')) {
                document.querySelector('[data-tab="sales"]').click();
            }
        } else {
            // Conta Admin
            if (navDashboard) navDashboard.style.display = 'flex';
            if (navReports) navReports.style.display = 'flex';
            if (userNameDisplay) userNameDisplay.innerText = 'Admin';
        }

    } else {
        overlay.style.display = 'flex';
        mainApp.style.display = 'none';
    }
}

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.toLowerCase().trim();
    const pass = document.getElementById('loginPass').value;

    if ((user === 'admin' && pass === '1234') || (user === 'caixa' && pass === '1234')) {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', user);
        document.getElementById('loginError').style.display = 'none';
        checkAuth();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
});

document.getElementById('btnLogout').addEventListener('click', () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    checkAuth();
});

// ==========================================
// NAVEGAÇÃO ENTRE ABAS
// ==========================================
function setupEvents() {
    // Nav links
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const pageTitle = document.getElementById('pageTitle');

    const titles = {
        'dashboard': 'Visão Geral do Churrasco',
        'inventory': 'Estoque e Cardápio',
        'sales': 'Entrada e Saída de Pedidos',
        'receipts': 'Comandas e Recibos',
        'reports': 'Painel de Desempenho e Inteligência'
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // Remove active classe de todas a abas e links
            navItems.forEach(nav => nav.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Adiciona classe na clicada
            item.classList.add('active');
            const target = item.getAttribute('data-tab');
            document.getElementById(`tab-${target}`).classList.add('active');
            pageTitle.innerText = titles[target];

            // Atualiza os dados da aba toda vez que entra nela
            if (target === 'sales') renderSalesDropdown();
            if (target === 'receipts') renderReceiptTablesDropdown();
            if (target === 'reports') renderReports();
            renderAll();
        });
    });

    // Forms
    document.getElementById('productForm').addEventListener('submit', handleAddProduct);
    document.getElementById('editProductForm').addEventListener('submit', handleEditProductSubmit);
    document.getElementById('saleForm').addEventListener('submit', handleSale);

    // Auto Update do Valor Estimado na Aba de Venda
    document.getElementById('saleProduct').addEventListener('change', calculateEstimatedSale);
    document.getElementById('saleQuantity').addEventListener('input', calculateEstimatedSale);
}

// ==========================================
// LÓGICA DE ESTOQUE
// ==========================================
function handleAddProduct(e) {
    e.preventDefault();
    const name = document.getElementById('productName').value;
    const category = document.getElementById('productCategory').value;
    const qty = parseInt(document.getElementById('productQuantity').value);
    const minS = parseInt(document.getElementById('productMinStock').value) || 10;
    const cost = parseFloat(document.getElementById('productCost').value);
    const price = parseFloat(document.getElementById('productPrice').value);

    // Validação de segurança básica
    if (cost >= price) {
        alert("Atenção: Seu preço de custo é maior ou igual ao de venda. Verifique para não obter prejuízos!");
    }

    products.push({
        id: Date.now().toString(),
        name,
        category,
        quantity: qty,
        minStock: minS,
        costPrice: cost,
        sellPrice: price
    });

    saveData();
    renderInventory();
    e.target.reset();
    document.getElementById('productName').focus();
}

function deleteProduct(id) {
    if (confirm("Tem certeza que deseja apagar este produto do estoque?")) {
        products = products.filter(p => p.id !== id);
        saveData();
        renderInventory();
        renderSalesDropdown();
    }
}

// LOGICA DE EDICAO //
function openEditModal(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    document.getElementById('editProductId').value = product.id;
    document.getElementById('editProductName').value = product.name;
    document.getElementById('editProductCategory').value = product.category || 'Comida';
    document.getElementById('editProductQuantity').value = product.quantity;
    document.getElementById('editProductMinStock').value = product.minStock || 5;
    document.getElementById('editProductCost').value = product.costPrice;
    document.getElementById('editProductPrice').value = product.sellPrice;

    document.getElementById('editProductModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editProductModal').style.display = 'none';
    document.getElementById('editProductForm').reset();
}

function handleEditProductSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('editProductId').value;
    const name = document.getElementById('editProductName').value;
    const category = document.getElementById('editProductCategory').value;
    const qty = parseInt(document.getElementById('editProductQuantity').value);
    const minS = parseInt(document.getElementById('editProductMinStock').value);
    const cost = parseFloat(document.getElementById('editProductCost').value);
    const price = parseFloat(document.getElementById('editProductPrice').value);

    if (cost >= price) {
        alert("Atenção: Seu preço de custo é maior ou igual ao de venda. Verifique para não obter prejuízos!");
    }

    const prodIndex = products.findIndex(p => p.id === id);
    if (prodIndex !== -1) {
        products[prodIndex] = {
            id,
            name,
            category,
            quantity: qty,
            minStock: minS,
            costPrice: cost,
            sellPrice: price
        };

        saveData();
        renderInventory();
        renderSalesDropdown(); // Atualiza dropdown de vendas
        closeEditModal();
        alert("Produto atualizado com sucesso!");
    }
}

// ==========================================
// LÓGICA DE VENDAS (PDV COM CARRINHO)
// ==========================================
function renderSalesDropdown() {
    const select = document.getElementById('saleProduct');
    const filter = document.getElementById('saleProductFilter') ? document.getElementById('saleProductFilter').value : 'Todas';

    // Mantém o primeiro option (placeholder)
    select.innerHTML = '<option value="" disabled selected>Escolha um produto...</option>';

    products.forEach(p => {
        // Mostra só produtos com estoque > 0
        if (p.quantity > 0) {
            // Aplica filtro de categoria se não for "Todas"
            if (filter === 'Todas' || p.category === filter) {
                // Calcula quanto já tem no carrinho para não deixar adicionar mais que o estoque
                const inCart = currentCart.filter(item => item.productId === p.id).reduce((sum, item) => sum + item.quantity, 0);
                const available = p.quantity - inCart;

                if (available > 0) {
                    select.innerHTML += `<option value="${p.id}">${p.name} (Disp: ${available} | ${formatCurrency(p.sellPrice)})</option>`;
                }
            }
        }
    });
}

function renderOpenTablesDataList() {
    const dataList = document.getElementById('openTablesList');
    if (!dataList) return;

    // Pega as vendas que ainda nao foram fechadas
    const unpaidSales = sales.filter(s => !s.paid);

    // Lista os clientes unicos
    const tables = [...new Set(unpaidSales.map(s => s.customer))];

    dataList.innerHTML = '';
    tables.forEach(t => {
        if (t) {
            dataList.innerHTML += `<option value="${t}"></option>`;
        }
    });
}

function calculateEstimatedSale() {
    const pId = document.getElementById('saleProduct').value;
    const qtyInput = document.getElementById('saleQuantity').value;
    const qty = parseInt(qtyInput) || 0;

    if (pId && qty > 0) {
        const prod = products.find(p => p.id === pId);
        if (prod) {
            document.getElementById('saleEstimatedTotal').innerText = formatCurrency(prod.sellPrice * qty);
            return;
        }
    }
    document.getElementById('saleEstimatedTotal').innerText = "R$ 0,00";
}

function handleSale(e) {
    e.preventDefault();
    const customer = document.getElementById('saleCustomer').value;
    const pId = document.getElementById('saleProduct').value;
    const qty = parseInt(document.getElementById('saleQuantity').value);
    const errMsg = document.getElementById('saleError');

    if (!pId || !customer) return;

    const prodIdx = products.findIndex(p => p.id === pId);
    if (prodIdx === -1) return;

    const prod = products[prodIdx];

    // Verifica quantidade disponível considerando o que já tá no carrinho
    const inCart = currentCart.filter(item => item.productId === prod.id).reduce((sum, item) => sum + item.quantity, 0);
    const available = prod.quantity - inCart;

    if (qty > available) {
        errMsg.style.display = 'block';
        return;
    }

    errMsg.style.display = 'none';

    // Adiciona ao carrinho temporário
    currentCart.push({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        productId: prod.id,
        name: prod.name,
        quantity: qty,
        unitPrice: prod.sellPrice,
        costPrice: prod.costPrice,
        total: prod.sellPrice * qty
    });

    // Limpa o form exceto o nome do cliente
    document.getElementById('saleProduct').value = '';
    document.getElementById('saleQuantity').value = 1;
    calculateEstimatedSale();

    // Atualiza a visualização
    renderCart();
    renderSalesDropdown(); // Para atualizar a quantidade disponível no select
}

function renderCart() {
    const tbody = document.getElementById('cartList');
    const totalEl = document.getElementById('cartTotal');
    const btnFinalize = document.getElementById('btnFinalizeSale');

    tbody.innerHTML = '';
    let cartTotalValue = 0;

    if (currentCart.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-secondary)">Carrinho vazio.</td></tr>`;
        totalEl.innerText = "R$ 0,00";
        btnFinalize.disabled = true;
        btnFinalize.style.opacity = '0.5';
        return;
    }

    btnFinalize.disabled = false;
    btnFinalize.style.opacity = '1';

    currentCart.forEach((item, index) => {
        cartTotalValue += item.total;
        tbody.innerHTML += `
            <tr>
                <td>${item.quantity}x</td>
                <td>${item.name}</td>
                <td style="text-align: right;">${formatCurrency(item.total)}</td>
                <td style="text-align: center;">
                    <button type="button" class="btn-icon-sm" onclick="removeFromCart(${index})" title="Remover"><i class="ri-close-line"></i></button>
                </td>
            </tr>
        `;
    });

    totalEl.innerText = formatCurrency(cartTotalValue);
}

function removeFromCart(index) {
    currentCart.splice(index, 1);
    renderCart();
    renderSalesDropdown();
}

function finalizeCartSale() {
    if (currentCart.length === 0) return;

    const customer = document.getElementById('saleCustomer').value;
    if (!customer) {
        alert("Por favor, informe a Mesa ou Cliente antes de finalizar o pedido.");
        document.getElementById('saleCustomer').focus();
        return;
    }

    // Processa cada item do carrinho
    currentCart.forEach(item => {
        const prodIdx = products.findIndex(p => p.id === item.productId);
        if (prodIdx > -1) {
            // Deduz do estoque
            products[prodIdx].quantity -= item.quantity;

            // Calcula lucro
            const revenue = item.unitPrice * item.quantity;
            const costTotal = item.costPrice * item.quantity;
            const profit = revenue - costTotal;

            // Cria o registro da venda
            sales.push({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                date: new Date().toISOString(),
                customer: customer,
                productName: item.name,
                quantity: item.quantity,
                revenue: revenue,
                profit: profit,
                paid: false
            });
        }
    });

    saveData();

    // Limpa estado
    currentCart = [];
    document.getElementById('saleCustomer').value = '';

    renderAll();
    renderCart();
    renderSalesDropdown();
    renderOpenTablesDataList();

    alert(`Pedido registrado e baixado do estoque sucesso!`);
}

function deleteSale(saleId) {
    if (confirm("Tem certeza que deseja cancelar esta venda? O produto voltará para o estoque.")) {
        // Encontra a venda
        const saleIdx = sales.findIndex(s => s.id === saleId);
        if (saleIdx > -1) {
            const sale = sales[saleIdx];

            // Tenta achar o produto no estoque pelo nome exato para devolver a quantidade
            const prodIdx = products.findIndex(p => p.name === sale.productName);
            if (prodIdx > -1) {
                products[prodIdx].quantity += sale.quantity; // Devolve ao estoque
            }

            // Remove a venda do histórico
            sales.splice(saleIdx, 1);

            saveData();
            renderAll();

            // Se estiver na aba de recibos, atualiza os dados
            if (document.getElementById('tab-receipts').classList.contains('active')) {
                renderReceiptTablesDropdown();
                document.getElementById('receiptPreviewSection').style.display = 'none';
            }
            renderOpenTablesDataList();
        }
    }
}

// ==========================================
// SISTEMA DE RECIBOS / COMANDAS
// ==========================================
let currentReceiptCustomer = '';

function renderReceiptTablesDropdown() {
    const select = document.getElementById('receiptTable');

    // Pega as vendas que ainda nao foram fechadas
    const unpaidSales = sales.filter(s => !s.paid);

    // Lista os clientes unicos
    const tables = [...new Set(unpaidSales.map(s => s.customer))];

    if (tables.length === 0) {
        select.innerHTML = '<option value="" disabled selected>Nenhuma mesa com conta aberta...</option>';
        document.getElementById('receiptPreviewSection').style.display = 'none';
        return;
    }

    select.innerHTML = '<option value="" disabled selected>Selecione a mesa para fechar...</option>';
    tables.forEach(t => {
        const custNome = t || "Cliente Sem Nome";
        select.innerHTML += `<option value="${custNome}">${custNome} (Comanda Aberta)</option>`;
    });
}

function generateReceiptPreview() {
    const customer = document.getElementById('receiptTable').value;
    if (!customer) return;

    currentReceiptCustomer = customer;
    const items = sales.filter(s => (s.customer || "Cliente Sem Nome") === customer && !s.paid);

    const printArea = document.getElementById('printArea');
    let total = 0;

    let html = `
        <div style="text-align:center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin:0; font-size:18px;">ESPETINHO GRILL</h2>
            <p style="margin:5px 0 0 0; font-size:12px;">Sabores na Brasa</p>
        </div>
        <p style="margin:5px 0; font-size:14px;"><strong>Mesa/Cliente:</strong> ${customer}</p>
        <p style="margin:5px 0 15px 0; font-size:12px;">Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
        
        <table style="width:100%; font-size:12px; text-align:left; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #000;">
                <th style="padding-bottom:5px;">Qtd</th>
                <th style="padding-bottom:5px;">Item</th>
                <th style="text-align:right; padding-bottom:5px;">Total</th>
            </tr>
    `;

    items.forEach(s => {
        total += s.revenue;
        html += `
            <tr>
                <td style="padding: 5px 0;">${s.quantity}x</td>
                <td style="padding: 5px 0;">${s.productName}</td>
                <td style="text-align:right; padding: 5px 0;">${formatCurrency(s.revenue)}</td>
            </tr>
        `;
    });

    html += `
        </table>
        <div style="border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px; text-align:right;">
            <h3 style="margin:0; font-size:16px;">TOTAL: ${formatCurrency(total)}</h3>
        </div>
        <div style="text-align:center; margin-top: 20px; font-size:12px;">
            <p style="margin:0;">Obrigado pela preferência!</p>
            <p style="margin:0;">Volte Sempre</p>
        </div>
    `;

    printArea.innerHTML = html;
    document.getElementById('receiptTotalPreview').innerText = formatCurrency(total);
    document.getElementById('receiptPreviewSection').style.display = 'block';
}

function printReceipt() {
    window.print();
}

function closeTableAccount() {
    if (!currentReceiptCustomer) return;

    if (confirm(`Confirmar que o pagamento de ${currentReceiptCustomer} foi recebido e a mesa foi fechada?`)) {
        // Marca todas as vendas dessa mesa como 'paid: true'
        sales.forEach(s => {
            if ((s.customer || "Cliente Sem Nome") === currentReceiptCustomer && !s.paid) {
                s.paid = true;
            }
        });

        saveData();
        renderReceiptTablesDropdown();
        document.getElementById('receiptPreviewSection').style.display = 'none';
        renderReports(); // atualiza os graficos de fundo
        renderOpenTablesDataList();
    }
}

// ==========================================
// PAINEL DE RELATÓRIOS E INTELIGÊNCIA
// ==========================================
let salesChartInstance = null;

function renderReports() {
    // 1. Agregar vendas por produto
    const productSalesMap = {};
    sales.forEach(s => {
        if (!productSalesMap[s.productName]) productSalesMap[s.productName] = 0;
        productSalesMap[s.productName] += s.quantity;
    });

    // 2. Ordenar Top Produtos
    const sortedProducts = Object.keys(productSalesMap).map(name => {
        return { name: name, qty: productSalesMap[name] };
    }).sort((a, b) => b.qty - a.qty);

    const top5 = sortedProducts.slice(0, 5);

    // 3. Renderizar Gráfico
    const ctx = document.getElementById('salesChart').getContext('2d');

    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    // Labels curtos
    const labels = top5.map(p => p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name);
    const data = top5.map(p => p.qty);

    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Qtd Vendida',
                data: data,
                backgroundColor: 'rgba(234, 88, 12, 0.8)', // Laranja
                borderColor: 'rgba(234, 88, 12, 1)',
                borderWidth: 1,
                borderRadius: 6,
                maxBarThickness: 35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#9ca3af', precision: 0 },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: {
                    ticks: { color: '#9ca3af' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // 4. Lógica das Dicas Inteligentes
    generateSmartHints(sortedProducts);
}

function generateSmartHints(sortedSalesInfo) {
    const hintsContainer = document.getElementById('ai-recommendations');
    hintsContainer.innerHTML = '';

    let hasHints = false;

    // Constrói mapa pra acesso rápido
    const top3Names = sortedSalesInfo.slice(0, 3).map(p => p.name);
    const top5Names = sortedSalesInfo.slice(0, 5).map(p => p.name);

    products.forEach(p => {
        const minS = p.minStock || 5;
        const profitMargin = ((p.sellPrice - p.costPrice) / p.costPrice) * 100;

        // Regra 1: Comprar Urgente (Muito vendido + Estoque Baixo)
        if (top3Names.includes(p.name) && p.quantity <= minS) {
            hintsContainer.innerHTML += `
                <div class="hint-card hint-danger">
                    <h4><i class="ri-alert-fill"></i> Comprar Urgente</h4>
                    <p><strong>${p.name}</strong> é um dos seus campeões de venda e está com apenas ${p.quantity} no estoque.</p>
                </div>
            `;
            hasHints = true;
        }

        // Regra 2: Aumentar Margem / Investir (Muito vendido + Margem alta)
        if (top5Names.includes(p.name) && profitMargin > 40 && p.quantity > minS) {
            hintsContainer.innerHTML += `
                <div class="hint-card hint-success">
                    <h4><i class="ri-money-dollar-circle-fill"></i> Máquina de Dinheiro</h4>
                    <p>O <strong>${p.name}</strong> tem ótima saída e Margem de Lucro alta (${profitMargin.toFixed(0)}%). Foque nas vendas dele para lucrar mais!</p>
                </div>
            `;
            hasHints = true;
        }

        // Regra 3: Fazer Promoção (Parado no estoque, fora do top 5)
        if (!top5Names.includes(p.name) && p.quantity > 50) {
            hintsContainer.innerHTML += `
                <div class="hint-card hint-warning">
                    <h4><i class="ri-price-tag-3-fill"></i> Estoque Parado</h4>
                    <p>O <strong>${p.name}</strong> tem muitas unidades paradas (${p.quantity}). Que tal fazer uma promoção ou combo?</p>
                </div>
            `;
            hasHints = true;
        }
    });

    if (!hasHints) {
        hintsContainer.innerHTML = `
            <div class="hint-card" style="border-left-color: var(--primary-color);">
                <h4><i class="ri-thumb-up-fill" style="color:var(--primary-color)"></i> Tudo sob controle</h4>
                <p>O seu bar está rodando perfeitamente. Nenhuma ação crítica recomendada no momento.</p>
            </div>
        `;
    }
}

// ==========================================
// RENDERIZADORES (Telas)
// ==========================================
function renderAll() {
    renderInventory();
    renderDashboard();
}

function renderInventory() {
    const list = document.getElementById('productList');
    list.innerHTML = '';

    if (products.length === 0) {
        list.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">Sem produtos.</td></tr>`;
        return;
    }

    products.forEach(p => {
        const profitMargin = ((p.sellPrice - p.costPrice) / p.costPrice) * 100;

        // Lógica de alerta de estoque
        const minS = p.minStock || 5; // Fallback caso tenha produtos velhos salvos sem esse campo
        const isLowStock = p.quantity <= minS;
        const warningBadge = isLowStock ? `<span class="badge-stock-warning" title="Abaixo do Mínimo (${minS})"><i class="ri-alarm-warning-fill"></i> Baixo</span>` : '';
        const qtyColor = isLowStock ? 'color: var(--danger-color); font-weight: 700;' : '';

        const catLabel = p.category || 'Não definida';

        list.innerHTML += `
            <tr class="${isLowStock ? 'row-warning' : ''}">
                <td><strong>${p.name}</strong> ${warningBadge}</td>
                <td><span style="font-size: 0.8rem; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">${catLabel}</span></td>
                <td style="${qtyColor}">${p.quantity} <small style="color:var(--text-secondary); font-weight:normal">(mín: ${minS})</small></td>
                <td>${formatCurrency(p.costPrice)}</td>
                <td>${formatCurrency(p.sellPrice)}</td>
                <td><span class="badge-profit">${profitMargin.toFixed(1)}%</span></td>
                <td>
                    <button class="btn-icon-sm" onclick="openEditModal('${p.id}')" title="Editar"><i class="ri-pencil-line"></i></button>
                    <button class="btn-icon-sm" onclick="deleteProduct('${p.id}')" title="Excluir"><i class="ri-delete-bin-line"></i></button>
                </td>
            </tr>
        `;
    });
}

function renderDashboard() {
    // Cálculos Gerais do Estoque
    let tItems = 0;
    let tCost = 0;

    products.forEach(p => {
        tItems += p.quantity;
        tCost += (p.costPrice * p.quantity); // Custo total do estoque PARADO
    });

    // Cálculos Gerais de Receitas e Vendas
    let tRevenue = 0;
    let tProfit = 0;

    sales.forEach(s => {
        tRevenue += s.revenue;
        tProfit += s.profit;
    });

    // Atualiza DOM
    document.getElementById('dashTotalItems').innerText = tItems;
    document.getElementById('dashTotalCost').innerText = formatCurrency(tCost);
    document.getElementById('dashTotalRevenue').innerText = formatCurrency(tRevenue);

    // Formata o Lucro (Líquido)
    const profitEl = document.getElementById('dashTotalProfit');
    profitEl.innerText = formatCurrency(tProfit);
    profitEl.style.color = tProfit >= 0 ? "var(--success-color)" : "var(--danger-color)";

    // Tabela de Últimas Vendas
    const tbody = document.getElementById('recentSalesList');
    tbody.innerHTML = '';

    // Pegar as ultimas vendas, inverte o array para as ultimas ficarem em cima
    const recent = [...sales].reverse().slice(0, 10); // mostra maximo 10

    if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">Nenhuma venda registrada ainda.</td></tr>`;
        return;
    }

    recent.forEach(s => {
        const cust = s.customer || '-'; // Tratamento para vendas antigas sem nome
        tbody.innerHTML += `
            <tr>
                <td>${formatDate(s.date)}</td>
                <td><strong>${cust}</strong></td>
                <td>${s.productName}</td>
                <td>${s.quantity}</td>
                <td>${formatCurrency(s.revenue)}</td>
                <td style="color:var(--success-color);font-weight:600;">+ ${formatCurrency(s.profit)}</td>
                <td>
                    <button class="btn-icon-sm" onclick="deleteSale('${s.id}')" title="Cancelar Venda">
                        <i class="ri-close-circle-line"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// Inicia no Load da Página
init();
