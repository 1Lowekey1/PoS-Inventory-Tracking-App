/**
 * UIManager Class
 * Handles all UI-related tasks, including rendering and event listeners.
 */
class UIManager {
    constructor(dataManager, businessLogic) {
        this.dataManager = dataManager;
        this.businessLogic = businessLogic;
        this.currentScreen = 'cashier';
        this.editingIngredientId = null;
        this.editingProductId = null;
        this.currentBatchProduct = null;
    }

    /**
     * Initialize the UI
     */
    init() {
        this.setupNavigation();
        this.setupModals();
        this.setupForms();
        this.setupButtons();
        this.initTheme();
        this.initDemoMode();
        this.renderAll();
    }

    // --- NAVIGATION ---

    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchScreen(btn.dataset.screen);
            });
        });
    }

    switchScreen(screenName) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.screen === screenName);
        });

        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.toggle('active', screen.id === `${screenName}-screen`);
        });

        this.currentScreen = screenName;

        // Render the active screen
        if (screenName === 'cashier') this.renderCashier();
        if (screenName === 'products') this.renderProducts();
        if (screenName === 'inventory') this.renderInventory();
        if (screenName === 'reports') this.renderReports();
    }

    // --- MODALS ---

    setupModals() {
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal(btn.closest('.modal').id);
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal.id);
            });
        });
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        if (modalId === 'ingredient-modal') this.editingIngredientId = null;
        if (modalId === 'product-modal') this.editingProductId = null;
        if (modalId === 'batch-sale-modal') this.currentBatchProduct = null;
    }

    // --- FORMS & BUTTONS ---

    setupForms() {
        document.getElementById('ingredient-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSaveIngredient();
        });

        document.getElementById('product-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSaveProduct();
        });

        document.getElementById('start-event-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleStartEvent();
        });
    }

    setupButtons() {
        // Event Banner Action
        document.getElementById('event-action-btn').addEventListener('click', () => {
            const activeEvent = this.dataManager.getActiveEvent();
            if (activeEvent && activeEvent.status === 'active') {
                this.openEndEventModal();
            } else {
                this.openStartEventModal();
            }
        });

        document.getElementById('end-event-confirm').addEventListener('click', () => this.handleEndEvent());
        document.getElementById('end-event-cancel').addEventListener('click', () => this.closeModal('end-event-modal'));

        // Batch Sales
        document.getElementById('batch-quantity').addEventListener('input', () => this.updateBatchTotal());
        document.getElementById('batch-sale-confirm').addEventListener('click', () => this.handleConfirmBatchSale());

        // Break-even Display
        ['event-fixed-cost', 'event-planned-output'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateBreakEvenCalc());
        });

        // Settings
        document.getElementById('demo-mode-toggle').addEventListener('change', (e) => this.handleToggleDemoMode(e.target.checked));
        document.getElementById('clear-demo-sales-btn').addEventListener('click', () => this.handleClearDemoSales());
        document.getElementById('theme-select').addEventListener('change', (e) => this.handleChangeTheme(e.target.value));

        // Global Actions
        document.getElementById('add-ingredient-btn').addEventListener('click', () => this.openIngredientModal());
        document.getElementById('add-product-btn').addEventListener('click', () => this.openProductModal());
        document.getElementById('add-recipe-item-btn').addEventListener('click', () => this.addRecipeBuilderItem());
        document.getElementById('undo-sale-btn').addEventListener('click', () => this.handleUndoSale());
        document.getElementById('restock-low-btn').addEventListener('click', () => this.handleBulkRestock());
        document.getElementById('export-data-btn').addEventListener('click', () => this.handleExportData());
        document.getElementById('reset-event-btn').addEventListener('click', () => this.handleConfirmResetEvent());
    }

    // --- RENDERING ---

    renderAll() {
        this.updateEventBanner();
        this.renderCashier();
        this.renderProducts();
        this.renderInventory();
        this.renderReports();
    }

    updateEventBanner() {
        const activeEvent = this.dataManager.getActiveEvent();
        const banner = document.getElementById('event-banner');
        const statusText = document.getElementById('event-text');
        const actionBtn = document.getElementById('event-action-btn');

        if (!banner) return;
        banner.style.display = 'flex';

        if (activeEvent && activeEvent.status === 'active') {
            banner.classList.add('active');
            statusText.textContent = `Active Event: ${activeEvent.name}`;
            actionBtn.textContent = 'End Event';
            actionBtn.className = 'event-action-btn btn-danger';
        } else {
            banner.classList.remove('active');
            statusText.textContent = 'No Active Event';
            actionBtn.textContent = 'Start Event';
            actionBtn.className = 'event-action-btn btn-primary';
        }
    }

    // --- CASHIER SCREEN ---

    renderCashier() {
        const summary = this.businessLogic.getSalesSummary();
        const activeEvent = this.dataManager.getActiveEvent();

        document.getElementById('total-sales').textContent = this.formatCurrency(summary.totalRevenue);
        document.getElementById('items-sold').textContent = summary.itemsSold;

        this.updatePlannedOutputProgress(activeEvent, summary);

        const products = this.dataManager.getProducts().filter(p => p.active);
        const grid = document.getElementById('product-grid');

        if (products.length === 0) {
            grid.innerHTML = '<div class="empty-state"><p>No active products</p><p class="empty-hint">Add products in the Products tab</p></div>';
        } else {
            grid.innerHTML = products.map(product => {
                const canSell = this.businessLogic.canSellProduct(product.id);
                return `
                    <button class="product-btn ${canSell ? '' : 'out-of-stock'}"
                            data-product-id="${product.id}"
                            ${canSell ? '' : 'disabled'}>
                        <div class="product-btn-name">${product.name}</div>
                        <div class="product-btn-price">${this.formatCurrency(product.sellingPrice)}</div>
                    </button>
                `;
            }).join('');

            grid.querySelectorAll('.product-btn').forEach(btn => {
                btn.addEventListener('click', () => this.openBatchSaleModal(btn.dataset.productId));
            });
        }

        const settings = this.dataManager.getSettings();
        const lastSale = settings.demoMode ? this.dataManager.getDemoLastSale() : this.dataManager.getLastSale();
        document.getElementById('undo-sale-btn').disabled = !lastSale;
    }

    updatePlannedOutputProgress(activeEvent, summary) {
        const progressDiv = document.getElementById('planned-output-progress');
        if (!progressDiv) return;

        if (!activeEvent || !activeEvent.plannedOutput) {
            progressDiv.style.display = 'none';
            return;
        }

        const planned = activeEvent.plannedOutput;
        const sold = summary.itemsSold;
        const percentage = Math.min((sold / planned) * 100, 100);
        const remaining = Math.max(planned - sold, 0);

        let statusClass = 'warning';
        let statusText = 'In Progress';

        if (percentage >= 100) {
            statusClass = 'success';
            statusText = 'Goal Reached! 🎉';
        } else if (percentage >= 75) {
            statusClass = 'success';
            statusText = 'Almost There!';
        } else if (percentage >= 50) {
            statusClass = 'primary';
            statusText = 'Halfway There!';
        }

        progressDiv.style.display = 'block';
        progressDiv.innerHTML = `
            <div style="margin: var(--spacing-md) 0; padding: var(--spacing-md); background: var(--surface); border-radius: var(--border-radius); border-left: 3px solid var(--${statusClass});">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm);">
                    <span style="font-weight: 600; color: var(--text-primary);">📊 Planned Output Progress</span>
                    <span style="font-weight: 700; color: var(--${statusClass});">${statusText}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--spacing-xs);">
                    <span style="font-size: var(--font-size-lg); font-weight: 700; color: var(--${statusClass});">${sold} / ${planned}</span>
                    <span style="font-size: var(--font-size-sm); color: var(--text-secondary);">${remaining} remaining</span>
                </div>
                <div style="width: 100%; height: 8px; background: var(--background); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: var(--${statusClass}); transition: width 0.3s ease;"></div>
                </div>
                <div style="margin-top: var(--spacing-xs); font-size: var(--font-size-xs); color: var(--text-secondary); font-style: italic;">${percentage.toFixed(1)}% complete</div>
            </div>
        `;
    }

    // --- PRODUCTS SCREEN ---

    renderProducts() {
        const products = this.dataManager.getProducts();
        const list = document.getElementById('product-list');

        if (products.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>No products yet</p><p class="empty-hint">Create your first product</p></div>';
        } else {
            list.innerHTML = products.map(product => {
                const canSell = this.businessLogic.canSellProduct(product.id);
                return `
                    <div class="product-card">
                        <div class="card-header">
                            <div class="card-title">${product.name}</div>
                            <div class="card-price">${this.formatCurrency(product.sellingPrice)}</div>
                        </div>
                        <div class="card-meta">
                            <span class="card-badge ${product.active ? 'active' : 'inactive'}">${product.active ? '✓ Active' : '✗ Inactive'}</span>
                            ${!canSell && product.active ? '<span class="card-badge low-stock">Out of Stock</span>' : ''}
                        </div>
                        <div class="card-recipe">
                            <div class="recipe-title">Recipe:</div>
                            <div class="recipe-list">${this.renderRecipeList(product.recipe)}</div>
                        </div>
                        <div class="card-actions">
                            <button class="card-btn" data-action="edit" data-id="${product.id}">Edit</button>
                            <button class="card-btn danger" data-action="delete" data-id="${product.id}">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');

            list.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => this.openProductModal(btn.dataset.id)));
            list.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', () => this.handleDeleteProduct(btn.dataset.id)));
        }
    }

    renderRecipeList(recipe) {
        const ingredients = this.dataManager.getIngredients();
        return recipe.map(item => {
            const ingredient = ingredients.find(i => i.id === item.ingredientId);
            return ingredient ? `<div class="recipe-item">• ${item.quantity} ${ingredient.unit} ${ingredient.name}</div>` : '';
        }).join('');
    }

    // --- INVENTORY SCREEN ---

    renderInventory() {
        const ingredients = this.dataManager.getIngredients();
        const list = document.getElementById('ingredient-list');
        const lowStockItems = this.businessLogic.getLowStockIngredients();
        const restockBtn = document.getElementById('restock-low-btn');

        restockBtn.style.display = lowStockItems.length > 0 ? 'block' : 'none';
        if (lowStockItems.length > 0) restockBtn.textContent = `📦 Restock ${lowStockItems.length} Low Item${lowStockItems.length > 1 ? 's' : ''}`;

        const stockChanges = this.dataManager.getStockChanges();

        if (ingredients.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>No ingredients yet</p><p class="empty-hint">Add your first ingredient</p></div>';
        } else {
            list.innerHTML = ingredients.map(ingredient => {
                const isLow = ingredient.lowStockThreshold && ingredient.totalQuantity <= ingredient.lowStockThreshold;
                const stockPercent = ingredient.lowStockThreshold ? (ingredient.totalQuantity / (ingredient.lowStockThreshold * 2)) * 100 : 100;

                const change = stockChanges[ingredient.id];
                let changeIndicator = '';
                if (change) {
                    const changeClass = change.change > 0 ? 'stock-increase' : 'stock-decrease';
                    const icon = change.change > 0 ? '↑' : '↓';
                    changeIndicator = `<span class="stock-change-badge ${changeClass}" title="Changed from ${change.old} ${ingredient.unit}">${icon} ${Math.abs(change.change).toFixed(1)} ${ingredient.unit}</span>`;
                }

                return `
                    <div class="ingredient-card">
                        <div class="card-header">
                            <div class="card-title">${ingredient.name}</div>
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                ${isLow ? '<span class="card-badge low-stock">Low Stock</span>' : ''}
                                ${changeIndicator}
                            </div>
                        </div>
                        <div class="stock-bar">
                            <div class="stock-fill ${ingredient.totalQuantity <= 0 ? 'out' : isLow ? 'low' : ''}" style="width: ${Math.min(stockPercent, 100)}%"></div>
                        </div>
                        <div class="ingredient-info">
                            <div class="info-item"><span class="info-label">Current Stock</span><span class="info-value">${ingredient.totalQuantity} ${ingredient.unit}</span></div>
                            <div class="info-item"><span class="info-label">Low Stock Alert</span><span class="info-value">${ingredient.lowStockThreshold || 'Not set'} ${ingredient.lowStockThreshold ? ingredient.unit : ''}</span></div>
                        </div>
                        <div class="stock-actions">
                            <button class="stock-adjust-btn" data-action="quick-add" data-id="${ingredient.id}">Add Stock</button>
                            <button class="stock-adjust-btn" data-action="quick-remove" data-id="${ingredient.id}">Remove</button>
                        </div>
                        <div class="card-actions">
                            <button class="card-btn" data-action="edit" data-id="${ingredient.id}">Edit</button>
                            <button class="card-btn danger" data-action="delete" data-id="${ingredient.id}">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');

            list.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => this.openIngredientModal(btn.dataset.id)));
            list.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', () => this.handleDeleteIngredient(btn.dataset.id)));
            list.querySelectorAll('[data-action="quick-add"]').forEach(btn => btn.addEventListener('click', () => this.handleQuickAdjustStock(btn.dataset.id, 'add')));
            list.querySelectorAll('[data-action="quick-remove"]').forEach(btn => btn.addEventListener('click', () => this.handleQuickAdjustStock(btn.dataset.id, 'remove')));
        }
    }

    // --- REPORTS SCREEN ---

    renderReports() {
        const summary = this.businessLogic.getSalesSummary();
        const breakdown = this.businessLogic.getSalesBreakdown();
        const settings = this.dataManager.getSettings();
        const sales = settings.demoMode ? this.dataManager.getDemoSales() : this.dataManager.getSales();

        document.getElementById('report-revenue').textContent = this.formatCurrency(summary.totalRevenue);
        document.getElementById('report-fixed-cost').textContent = this.formatCurrency(summary.fixedCost);
        document.getElementById('report-profit').textContent = this.formatCurrency(summary.netProfit);
        document.getElementById('report-items').textContent = summary.itemsSold;

        const profitCard = document.getElementById('profit-card');
        profitCard.style.background = summary.netProfit < 0 ? '#fee2e2' : '#dcfce7';

        const breakdownContainer = document.getElementById('sales-breakdown');
        if (breakdown.length === 0) {
            breakdownContainer.innerHTML = '<p class="empty-hint">No sales yet</p>';
        } else {
            breakdownContainer.innerHTML = breakdown.map(item => `
                <div class="breakdown-item">
                    <div><div class="breakdown-name">${item.productName}</div><div class="breakdown-stats">${item.count} sold</div></div>
                    <div class="breakdown-revenue">${this.formatCurrency(item.revenue)}</div>
                </div>
            `).join('');
        }

        const transactionContainer = document.getElementById('transaction-list');
        const recentSales = sales.slice(-10).reverse();

        if (recentSales.length === 0) {
            transactionContainer.innerHTML = '<p class="empty-hint">No transactions yet</p>';
        } else {
            transactionContainer.innerHTML = recentSales.map(sale => {
                const date = new Date(sale.timestamp);
                const quantityBadge = (sale.quantity || 1) > 1 ? ` <span class="qty-badge">×${sale.quantity}</span>` : '';
                return `
                    <div class="transaction-item">
                        <div><div class="transaction-product">${sale.productName}${quantityBadge}</div><div class="transaction-meta">${this.formatDateTime(date)}</div></div>
                        <div class="transaction-price">${this.formatCurrency(sale.sellingPrice)}</div>
                    </div>
                `;
            }).join('');
        }
    }

    // --- EVENT HANDLERS ---

    handleStartEvent() {
        const name = document.getElementById('event-name').value;
        const fixedCost = parseFloat(document.getElementById('event-fixed-cost').value);
        const plannedOutput = parseInt(document.getElementById('event-planned-output').value) || null;
        const notes = document.getElementById('event-notes').value;

        if (!name?.trim()) return this.showToast('Please enter an event name', 'error');
        if (isNaN(fixedCost) || fixedCost < 0) return this.showToast('Please enter a valid fixed cost', 'error');

        this.dataManager.startEvent({ name, fixedCost, plannedOutput, notes });
        this.showToast(`Event "${name}" started!`, 'success');
        this.closeModal('start-event-modal');
        this.renderAll();
    }

    handleEndEvent() {
        const event = this.dataManager.endEvent();
        if (event) {
            const label = event.profit >= 0 ? 'Profit' : 'Loss';
            this.showToast(`Event ended: ${event.name} - ${label}: ${this.formatCurrency(Math.abs(event.profit))}`, event.profit >= 0 ? 'success' : 'warning');
        }
        this.closeModal('end-event-modal');
        this.renderAll();
    }

    handleConfirmBatchSale() {
        if (!this.currentBatchProduct) return;
        const quantity = parseInt(document.getElementById('batch-quantity').value) || 1;
        if (quantity < 1) return this.showToast('Quantity must be at least 1', 'error');

        try {
            this.businessLogic.processSale(this.currentBatchProduct.id, quantity);
            this.showToast(`Sold ${quantity}x ${this.currentBatchProduct.name}`, 'success');
            this.closeModal('batch-sale-modal');
            this.renderAll();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    handleUndoSale() {
        const settings = this.dataManager.getSettings();
        const lastSale = settings.demoMode ? this.dataManager.getDemoLastSale() : this.dataManager.getLastSale();
        if (!lastSale) return this.showToast('No sale to undo', 'error');

        const qty = lastSale.quantity || 1;
        this.showConfirmDialog('Undo Last Sale', `Undo: ${lastSale.productName}${qty > 1 ? ` (${qty}x)` : ''} - ${this.formatCurrency(lastSale.sellingPrice)}?\nStock will be restored.`, () => {
            try {
                const sale = this.businessLogic.undoLastSale();
                this.showToast(`Undone: ${sale.productName}`, 'success');
                this.renderAll();
            } catch (error) {
                this.showToast(error.message, 'error');
            }
        });
    }

    handleSaveIngredient() {
        const id = document.getElementById('ingredient-id').value;
        const data = {
            name: document.getElementById('ingredient-name').value,
            unit: document.getElementById('ingredient-unit').value,
            totalQuantity: parseFloat(document.getElementById('ingredient-total-quantity').value),
            lowStockThreshold: parseFloat(document.getElementById('ingredient-threshold').value) || null
        };

        if (data.totalQuantity < 0) return this.showToast('Quantity cannot be negative', 'error');

        if (id) {
            this.dataManager.updateIngredient(id, data);
            this.showToast('Ingredient updated!', 'success');
        } else {
            this.dataManager.addIngredient(data);
            this.showToast('Ingredient added!', 'success');
        }
        this.closeModal('ingredient-modal');
        this.renderAll();
    }

    handleDeleteIngredient(id) {
        const ingredient = this.dataManager.getIngredients().find(i => i.id === id);
        const usedIn = this.dataManager.getProducts().filter(p => p.recipe.some(r => r.ingredientId === id));
        if (usedIn.length > 0) return this.showToast(`Cannot delete - used in: ${usedIn.map(p => p.name).join(', ')}`, 'error');

        this.showConfirmDialog('Delete Ingredient', `Are you sure you want to delete "${ingredient.name}"?`, () => {
            this.dataManager.deleteIngredient(id);
            this.showToast('Ingredient deleted', 'success');
            this.renderAll();
        });
    }

    handleQuickAdjustStock(id, action) {
        const ingredient = this.dataManager.getIngredients().find(i => i.id === id);
        if (!ingredient) return;

        const amountStr = prompt(`${action === 'add' ? 'Add to' : 'Remove from'} ${ingredient.name}\nCurrent: ${ingredient.totalQuantity} ${ingredient.unit}\nEnter amount:`);
        if (amountStr === null) return;

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) return this.showToast('Please enter a valid positive number', 'error');

        const newStock = action === 'add' ? ingredient.totalQuantity + amount : ingredient.totalQuantity - amount;
        if (newStock < 0) return this.showToast('Cannot remove more than current stock', 'error');

        this.dataManager.updateIngredient(id, { totalQuantity: newStock });
        this.dataManager.takeStockSnapshot();
        this.showToast(`${ingredient.name}: ${action === 'add' ? '+' : '-'}${amount} (now ${newStock})`, 'success');
        this.renderAll();
    }

    handleBulkRestock() {
        const lowStockItems = this.businessLogic.getLowStockIngredients();
        if (lowStockItems.length === 0) return;

        this.showConfirmDialog('Bulk Restock', `Restock ${lowStockItems.length} items to their alert threshold × 2?`, () => {
            lowStockItems.forEach(item => {
                this.dataManager.updateIngredient(item.id, { totalQuantity: item.lowStockThreshold * 2 });
            });
            this.dataManager.takeStockSnapshot();
            this.showToast(`Restocked ${lowStockItems.length} items`, 'success');
            this.renderAll();
        });
    }

    handleSaveProduct() {
        const id = document.getElementById('product-id').value;
        const recipe = [];
        document.querySelectorAll('.recipe-builder-item').forEach(item => {
            const ingId = item.querySelector('.recipe-ingredient').value;
            const qty = parseFloat(item.querySelector('.recipe-quantity').value);
            if (ingId && qty > 0) recipe.push({ ingredientId: ingId, quantity: qty });
        });

        if (recipe.length === 0) return this.showToast('Please add at least one ingredient', 'error');

        const data = {
            name: document.getElementById('product-name').value,
            sellingPrice: parseFloat(document.getElementById('product-price').value),
            recipe,
            active: document.getElementById('product-active').checked
        };

        if (id) {
            this.dataManager.updateProduct(id, data);
            this.showToast('Product updated!', 'success');
        } else {
            this.dataManager.addProduct(data);
            this.showToast('Product added!', 'success');
        }
        this.closeModal('product-modal');
        this.renderAll();
    }

    handleDeleteProduct(id) {
        const product = this.dataManager.getProducts().find(p => p.id === id);
        this.showConfirmDialog('Delete Product', `Are you sure you want to delete "${product.name}"?`, () => {
            this.dataManager.deleteProduct(id);
            this.showToast('Product deleted', 'success');
            this.renderAll();
        });
    }

    handleToggleDemoMode(enabled) {
        const settings = this.dataManager.getSettings();
        settings.demoMode = enabled;
        this.dataManager.saveSettings(settings);
        this.updateDemoIndicator(enabled);
        this.showToast(`Demo Mode ${enabled ? 'ON' : 'OFF'}`, enabled ? 'warning' : 'success');
        this.renderAll();
    }

    handleClearDemoSales() {
        this.showConfirmDialog('Clear Demo Sales', 'Delete all test sales? Real inventory is safe.', () => {
            this.dataManager.clearAllDemoSales();
            this.showToast('Demo sales cleared', 'success');
            this.renderAll();
        });
    }

    handleChangeTheme(theme) {
        const settings = this.dataManager.getSettings();
        settings.theme = theme;
        this.dataManager.saveSettings(settings);
        this.applyTheme(theme);
        this.showToast(`Theme: ${theme}`, 'success');
    }

    handleExportData() {
        const data = this.dataManager.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `booth-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Data exported!', 'success');
    }

    handleConfirmResetEvent() {
        this.showConfirmDialog('Reset Event', 'Clear all sales data? Products and ingredients will stay.', () => {
            this.dataManager.resetEvent();
            this.showToast('Event reset', 'success');
            this.renderAll();
        });
    }

    // --- HELPERS ---

    openStartEventModal() {
        ['event-name', 'event-fixed-cost', 'event-planned-output', 'event-notes'].forEach(id => document.getElementById(id).value = '');
        this.updateBreakEvenCalc();
        this.openModal('start-event-modal');
    }

    openEndEventModal() {
        const event = this.dataManager.getActiveEvent();
        if (!event) return;
        const summary = this.businessLogic.getSalesSummary();
        const summaryDiv = document.getElementById('end-event-summary');

        let plannedSec = '';
        if (event.plannedOutput) {
            const perc = Math.min((summary.itemsSold / event.plannedOutput) * 100, 100);
            plannedSec = `<div class="planned-output-goal"><strong>Goal:</strong> ${summary.itemsSold} / ${event.plannedOutput} sold (${perc.toFixed(1)}%)</div>`;
        }

        summaryDiv.innerHTML = `
            <h3>${event.name}</h3>
            ${plannedSec}
            <div class="summary-details">
                <div><span>Revenue:</span> <strong>${this.formatCurrency(summary.totalRevenue)}</strong></div>
                <div><span>Fixed Cost:</span> <strong>${this.formatCurrency(summary.fixedCost)}</strong></div>
                <div class="summary-total"><span>Net Profit/Loss:</span> <strong style="color: ${summary.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">${this.formatCurrency(Math.abs(summary.netProfit))}</strong></div>
            </div>
        `;
        this.openModal('end-event-modal');
    }

    openBatchSaleModal(productId) {
        const product = this.dataManager.getProducts().find(p => p.id === productId);
        if (!product) return;
        this.currentBatchProduct = product;
        document.getElementById('batch-sale-title').textContent = product.name;
        document.getElementById('batch-product-name').textContent = product.name;
        document.getElementById('batch-product-price').textContent = `${this.formatCurrency(product.sellingPrice)} each`;
        document.getElementById('batch-quantity').value = '1';
        this.updateBatchTotal();
        this.openModal('batch-sale-modal');
    }

    updateBatchTotal() {
        if (!this.currentBatchProduct) return;
        const qty = parseInt(document.getElementById('batch-quantity').value) || 1;
        document.getElementById('batch-total-amount').textContent = this.formatCurrency(this.currentBatchProduct.sellingPrice * qty);

        const warnings = this.businessLogic.checkStockWarnings(this.currentBatchProduct.id, qty);
        const div = document.getElementById('batch-warnings');
        if (warnings) {
            div.innerHTML = `<div class="stock-warning">⚠️ Low Stock: ${warnings.map(w => `${w.ingredientName} (~${w.estimatedCupsLeft} left)`).join(', ')}</div>`;
            div.style.display = 'block';
        } else {
            div.style.display = 'none';
        }
    }

    openIngredientModal(id = null) {
        this.editingIngredientId = id;
        const form = document.getElementById('ingredient-form');
        form.reset();
        document.getElementById('ingredient-id').value = id || '';

        if (id) {
            const ing = this.dataManager.getIngredients().find(i => i.id === id);
            document.getElementById('ingredient-modal-title').textContent = 'Edit Ingredient';
            document.getElementById('ingredient-name').value = ing.name;
            document.getElementById('ingredient-unit').value = ing.unit;
            document.getElementById('ingredient-total-quantity').value = ing.totalQuantity;
            document.getElementById('ingredient-threshold').value = ing.lowStockThreshold || '';
        } else {
            document.getElementById('ingredient-modal-title').textContent = 'Add Ingredient';
        }
        this.openModal('ingredient-modal');
    }

    openProductModal(id = null) {
        this.editingProductId = id;
        const form = document.getElementById('product-form');
        form.reset();
        document.getElementById('product-id').value = id || '';
        document.getElementById('recipe-builder').innerHTML = '';

        if (id) {
            const p = this.dataManager.getProducts().find(prod => prod.id === id);
            document.getElementById('product-modal-title').textContent = 'Edit Product';
            document.getElementById('product-name').value = p.name;
            document.getElementById('product-price').value = p.sellingPrice;
            document.getElementById('product-active').checked = p.active;
            p.recipe.forEach(item => this.addRecipeBuilderItem(item.ingredientId, item.quantity));
        } else {
            document.getElementById('product-modal-title').textContent = 'Add Product';
            this.addRecipeBuilderItem();
        }
        this.openModal('product-modal');
    }

    addRecipeBuilderItem(ingId = '', qty = '') {
        const container = document.getElementById('recipe-builder');
        const ingredients = this.dataManager.getIngredients();
        const item = document.createElement('div');
        item.className = 'recipe-builder-item';
        item.innerHTML = `
            <select class="recipe-ingredient" required>
                <option value="">Select ingredient</option>
                ${ingredients.map(i => `<option value="${i.id}" ${i.id === ingId ? 'selected' : ''}>${i.name} (${i.unit})</option>`).join('')}
            </select>
            <input type="number" class="recipe-quantity" step="0.01" min="0" placeholder="Qty" value="${qty}" required>
            <button type="button" class="remove-recipe-btn">&times;</button>
        `;
        item.querySelector('.remove-recipe-btn').addEventListener('click', () => item.remove());
        container.appendChild(item);
    }

    updateBreakEvenCalc() {
        const cost = parseFloat(document.getElementById('event-fixed-cost').value) || 0;
        const output = parseInt(document.getElementById('event-planned-output').value) || 0;
        const div = document.getElementById('break-even-calc');
        if (cost > 0 && output > 0) {
            div.innerHTML = `<div class="break-even-info">💡 Average price needed: <strong>${this.formatCurrency(cost / output)}</strong></div>`;
        } else {
            div.innerHTML = '';
        }
    }

    updateDemoIndicator(enabled) {
        document.getElementById('demo-indicator').style.display = enabled ? 'block' : 'none';
        const banner = document.getElementById('event-banner');
        if (banner) banner.classList.toggle('demo-mode', enabled);
    }

    initTheme() {
        const theme = this.dataManager.getSettings().theme || 'auto';
        document.getElementById('theme-select').value = theme;
        this.applyTheme(theme);
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (this.dataManager.getSettings().theme === 'auto') this.applyTheme('auto');
            });
        }
    }

    applyTheme(theme) {
        const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
        document.body.classList.toggle('dark-mode', isDark);
    }

    initDemoMode() {
        const isDemo = this.dataManager.getSettings().demoMode || false;
        document.getElementById('demo-mode-toggle').checked = isDemo;
        this.updateDemoIndicator(isDemo);
    }

    showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span><span class="toast-message">${msg}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    showConfirmDialog(title, msg, onConfirm) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = msg;
        const ok = document.getElementById('confirm-ok');
        const newOk = ok.cloneNode(true);
        ok.replaceWith(newOk);
        newOk.addEventListener('click', () => { onConfirm(); this.closeModal('confirm-modal'); });
        this.openModal('confirm-modal');
    }

    formatCurrency(amt) { return '₱' + (amt || 0).toFixed(2); }
    formatDateTime(d) { return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
}
