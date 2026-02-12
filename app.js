/**
 * ========================================
 * OFFLINE CASHIER & INVENTORY TRACKING APP
 * ========================================
 * 
 * A fully dynamic, offline-first POS system for food/beverage booths.
 * All data stored in localStorage.
 * No hard-coded menu items or ingredients.
 * 
 * CRITICAL ACCOUNTING ARCHITECTURE:
 * 
 * FIXED EVENT COSTS (Sunk Costs):
 * - Ingredients purchased upfront for the event
 * - Paid ONCE regardless of cups sold
 * - Example: ₱1,500 for all ingredients
 * - NOT divided per cup in profit calculation
 * 
 * PROFIT FORMULA:
 * Profit = TotalRevenue - FixedEventCost
 * 
 * NEVER:
 * Profit = (Price - CostPerCup) × CupsSold
 * 
 * Inventory tracks QUANTITIES for operational purposes only.
 * Inventory depletion does NOT affect accounting costs.
 * 
 * Data Models:
 * - EventCosts: totalFixedCost (one-time upfront purchase)
 * - Ingredients: id, name, unit, totalQuantity, lowStockThreshold (NO COST DATA)
 * - Products: id, name, sellingPrice, recipe[], active
 * - Sales: timestamp, productId, productName, sellingPrice, paymentType
 */

// ========================================
// DATA MANAGEMENT
// ========================================

class DataManager {
    constructor() {
        this.storageKey = {
            ingredients: 'booth_ingredients',
            products: 'booth_products',
            sales: 'booth_sales',
            lastSale: 'booth_last_sale',
            stockSnapshot: 'booth_stock_snapshot',
            eventCosts: 'booth_event_costs',
            activeEvent: 'booth_active_event',
            eventHistory: 'booth_event_history',
            settings: 'booth_settings',
            demoSales: 'booth_demo_sales', // NEW: Demo mode sales
            demoLastSale: 'booth_demo_last_sale' // NEW: Demo mode undo
        };
    }

    /**
     * Get active event session
     */
    getActiveEvent() {
        const data = localStorage.getItem(this.storageKey.activeEvent);
        return data ? JSON.parse(data) : null;
    }

    /**
     * Start a new event
     */
    startEvent(eventData) {
        const event = {
            id: this.generateId(),
            name: eventData.name || 'Unnamed Event',
            startTime: new Date().toISOString(),
            fixedCost: eventData.fixedCost,
            plannedOutput: eventData.plannedOutput || null, // NEW: For break-even tracking
            startingInventory: JSON.parse(JSON.stringify(this.getIngredients())), // Deep copy snapshot
            status: 'active'
        };
        
        localStorage.setItem(this.storageKey.activeEvent, JSON.stringify(event));
        
        // Clear sales for new event
        this.saveSales([]);
        this.clearLastSale();
        
        return event;
    }

    /**
     * End the current event
     */
    endEvent() {
        const event = this.getActiveEvent();
        if (!event || event.status !== 'active') return null;

        const sales = this.getSales();
        const totalRevenue = sales.reduce((sum, sale) => sum + sale.sellingPrice, 0);
        const profit = totalRevenue - event.fixedCost;

        // Finalize event
        event.endTime = new Date().toISOString();
        event.status = 'closed';
        event.totalRevenue = totalRevenue;
        event.profit = profit;
        event.itemsSold = sales.length;
        event.salesLog = JSON.parse(JSON.stringify(sales)); // Deep copy
        event.endingInventory = JSON.parse(JSON.stringify(this.getIngredients())); // Deep copy

        // Move to history
        const history = this.getEventHistory();
        history.push(event);
        this.saveEventHistory(history);

        // Clear active event
        localStorage.removeItem(this.storageKey.activeEvent);

        return event;
    }

    /**
     * Get event history
     */
    getEventHistory() {
        const data = localStorage.getItem(this.storageKey.eventHistory);
        return data ? JSON.parse(data) : [];
    }

    /**
     * Save event history
     */
    saveEventHistory(history) {
        localStorage.setItem(this.storageKey.eventHistory, JSON.stringify(history));
    }

    /**
     * Get user settings
     */
    getSettings() {
        const data = localStorage.getItem(this.storageKey.settings);
        return data ? JSON.parse(data) : { 
            theme: 'auto',
            demoMode: false 
        };
    }

    /**
     * Save user settings
     */
    saveSettings(settings) {
        localStorage.setItem(this.storageKey.settings, JSON.stringify(settings));
    }

    /**
     * Get demo sales (separate from real sales)
     */
    getDemoSales() {
        const data = localStorage.getItem(this.storageKey.demoSales);
        return data ? JSON.parse(data) : [];
    }

    /**
     * Save demo sales
     */
    saveDemoSales(sales) {
        localStorage.setItem(this.storageKey.demoSales, JSON.stringify(sales));
    }

    /**
     * Get last demo sale (for undo)
     */
    getDemoLastSale() {
        const data = localStorage.getItem(this.storageKey.demoLastSale);
        return data ? JSON.parse(data) : null;
    }

    /**
     * Save last demo sale
     */
    saveDemoLastSale(sale) {
        localStorage.setItem(this.storageKey.demoLastSale, JSON.stringify(sale));
    }

    /**
     * Clear last demo sale
     */
    clearDemoLastSale() {
        localStorage.removeItem(this.storageKey.demoLastSale);
    }

    /**
     * Clear all demo sales
     */
    clearAllDemoSales() {
        this.saveDemoSales([]);
        this.clearDemoLastSale();
    }

    /**
     * Get event costs (fixed sunk costs)
     */
    getEventCosts() {
        const data = localStorage.getItem(this.storageKey.eventCosts);
        return data ? JSON.parse(data) : { totalFixedCost: 0, notes: '' };
    }

    /**
     * Save event costs
     */
    saveEventCosts(costs) {
        localStorage.setItem(this.storageKey.eventCosts, JSON.stringify(costs));
    }

    /**
     * Take a snapshot of current stock levels
     */
    takeStockSnapshot() {
        const ingredients = this.getIngredients();
        const snapshot = {};
        ingredients.forEach(ing => {
            snapshot[ing.id] = ing.totalQuantity;
        });
        localStorage.setItem(this.storageKey.stockSnapshot, JSON.stringify(snapshot));
    }

    /**
     * Get stock changes since last snapshot
     */
    getStockChanges() {
        const snapshot = localStorage.getItem(this.storageKey.stockSnapshot);
        if (!snapshot) return {};
        
        const oldStock = JSON.parse(snapshot);
        const ingredients = this.getIngredients();
        const changes = {};
        
        ingredients.forEach(ing => {
            const oldQty = oldStock[ing.id];
            if (oldQty !== undefined && oldQty !== ing.totalQuantity) {
                changes[ing.id] = {
                    old: oldQty,
                    new: ing.totalQuantity,
                    change: ing.totalQuantity - oldQty
                };
            }
        });
        
        return changes;
    }

    /**
     * Get all ingredients from localStorage
     */
    getIngredients() {
        const data = localStorage.getItem(this.storageKey.ingredients);
        return data ? JSON.parse(data) : [];
    }

    /**
     * Save ingredients to localStorage
     */
    saveIngredients(ingredients) {
        localStorage.setItem(this.storageKey.ingredients, JSON.stringify(ingredients));
    }

    /**
     * Get all products from localStorage
     */
    getProducts() {
        const data = localStorage.getItem(this.storageKey.products);
        return data ? JSON.parse(data) : [];
    }

    /**
     * Save products to localStorage
     */
    saveProducts(products) {
        localStorage.setItem(this.storageKey.products, JSON.stringify(products));
    }

    /**
     * Get all sales from localStorage
     */
    getSales() {
        const data = localStorage.getItem(this.storageKey.sales);
        return data ? JSON.parse(data) : [];
    }

    /**
     * Save sales to localStorage
     */
    saveSales(sales) {
        localStorage.setItem(this.storageKey.sales, JSON.stringify(sales));
    }

    /**
     * Get last sale (for undo functionality)
     */
    getLastSale() {
        const data = localStorage.getItem(this.storageKey.lastSale);
        return data ? JSON.parse(data) : null;
    }

    /**
     * Save last sale
     */
    saveLastSale(sale) {
        localStorage.setItem(this.storageKey.lastSale, JSON.stringify(sale));
    }

    /**
     * Clear last sale
     */
    clearLastSale() {
        localStorage.removeItem(this.storageKey.lastSale);
    }

    /**
     * Add a new ingredient
     * NEW: Stores total_quantity and total_cost (batch purchase model)
     * Unit cost is computed dynamically: total_cost / total_quantity
     */
    addIngredient(ingredient) {
        const ingredients = this.getIngredients();
        ingredient.id = this.generateId();
        ingredients.push(ingredient);
        this.saveIngredients(ingredients);
        return ingredient;
    }

    /**
     * Update an existing ingredient
     * CRITICAL: Never store cost_per_unit directly - only total_cost and total_quantity
     */
    updateIngredient(id, updates) {
        const ingredients = this.getIngredients();
        const index = ingredients.findIndex(i => i.id === id);
        if (index !== -1) {
            ingredients[index] = { ...ingredients[index], ...updates };
            this.saveIngredients(ingredients);
            return ingredients[index];
        }
        return null;
    }

    /**
     * Delete an ingredient
     */
    deleteIngredient(id) {
        let ingredients = this.getIngredients();
        ingredients = ingredients.filter(i => i.id !== id);
        this.saveIngredients(ingredients);
    }

    /**
     * Add a new product
     */
    addProduct(product) {
        const products = this.getProducts();
        product.id = this.generateId();
        products.push(product);
        this.saveProducts(products);
        return product;
    }

    /**
     * Update an existing product
     */
    updateProduct(id, updates) {
        const products = this.getProducts();
        const index = products.findIndex(p => p.id === id);
        if (index !== -1) {
            products[index] = { ...products[index], ...updates };
            this.saveProducts(products);
            return products[index];
        }
        return null;
    }

    /**
     * Delete a product
     */
    deleteProduct(id) {
        let products = this.getProducts();
        products = products.filter(p => p.id !== id);
        this.saveProducts(products);
    }

    /**
     * Record a sale (handles both real and demo mode)
     */
    recordSale(sale) {
        sale.id = this.generateId();
        sale.timestamp = new Date().toISOString();
        sale.quantity = sale.quantity || 1;
        
        // Route to demo or real sales based on flag
        if (sale.isDemoMode) {
            const demoSales = this.getDemoSales();
            demoSales.push(sale);
            this.saveDemoSales(demoSales);
            this.saveDemoLastSale(sale);
        } else {
            const sales = this.getSales();
            sales.push(sale);
            this.saveSales(sales);
            this.saveLastSale(sale);
        }
        
        return sale;
    }

    /**
     * Generate a unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Export all data as JSON
     */
    exportData() {
        return {
            ingredients: this.getIngredients(),
            products: this.getProducts(),
            sales: this.getSales(),
            exportDate: new Date().toISOString()
        };
    }

    /**
     * Import data from JSON
     */
    importData(data) {
        if (data.ingredients) this.saveIngredients(data.ingredients);
        if (data.products) this.saveProducts(data.products);
        if (data.sales) this.saveSales(data.sales);
    }

    /**
     * Reset all event data (sales only)
     */
    resetEvent() {
        this.saveSales([]);
        this.clearLastSale();
    }

    /**
     * Clear all data (nuclear option)
     */
    clearAllData() {
        Object.values(this.storageKey).forEach(key => {
            localStorage.removeItem(key);
        });
    }
}

// ========================================
// BUSINESS LOGIC
// ========================================

class BusinessLogic {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Check if a product can be sold (all ingredients available)
     * @param {string} productId - Product to check
     * @param {number} quantity - Number of items to sell (default 1)
     */
    canSellProduct(productId, quantity = 1) {
        const products = this.dataManager.getProducts();
        const product = products.find(p => p.id === productId);
        if (!product || !product.active) return false;

        const ingredients = this.dataManager.getIngredients();
        
        for (const recipeItem of product.recipe) {
            const ingredient = ingredients.find(i => i.id === recipeItem.ingredientId);
            const requiredQty = recipeItem.quantity * quantity;
            if (!ingredient || ingredient.totalQuantity < requiredQty) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Check stock levels for a product sale
     * Returns warning info if stock is low but sale is still possible
     */
    checkStockWarnings(productId, quantity = 1) {
        const products = this.dataManager.getProducts();
        const product = products.find(p => p.id === productId);
        if (!product) return null;

        const ingredients = this.dataManager.getIngredients();
        const warnings = [];
        
        product.recipe.forEach(recipeItem => {
            const ingredient = ingredients.find(i => i.id === recipeItem.ingredientId);
            const requiredQty = recipeItem.quantity * quantity;
            const remaining = ingredient.totalQuantity - requiredQty;
            
            if (ingredient.lowStockThreshold && remaining <= ingredient.lowStockThreshold) {
                const estimatedCupsLeft = Math.floor(remaining / recipeItem.quantity);
                warnings.push({
                    ingredientName: ingredient.name,
                    remaining: remaining,
                    unit: ingredient.unit,
                    estimatedCupsLeft: estimatedCupsLeft
                });
            }
        });
        
        return warnings.length > 0 ? warnings : null;
    }

    /**
     * Process a sale - SIMPLIFIED FOR CORRECT ACCOUNTING
     * 
     * Sales track: Revenue
     * Inventory tracks: Quantities
     * Accounting tracks: Fixed costs (separate)
     * 
     * CRITICAL: Sales only allowed during active event (unless demo mode)
     * DEMO MODE: Sales tracked but inventory NOT affected
     * 
     * @param {string} productId - Product to sell
     * @param {number} quantity - Number of items (default 1)
     */
    processSale(productId, quantity = 1) {
        // Check settings for demo mode
        const settings = this.dataManager.getSettings();
        const isDemoMode = settings.demoMode || false;
        
        // CRITICAL CHECK: Require active event for real sales (not demo)
        const activeEvent = this.dataManager.getActiveEvent();
        if (!isDemoMode && (!activeEvent || activeEvent.status !== 'active')) {
            throw new Error('No active event. Please start an event before making sales.');
        }

        if (quantity < 1) {
            throw new Error('Quantity must be at least 1');
        }

        if (!this.canSellProduct(productId, quantity)) {
            throw new Error('Product cannot be sold - insufficient ingredients');
        }

        const products = this.dataManager.getProducts();
        const product = products.find(p => p.id === productId);
        const ingredients = this.dataManager.getIngredients();

        // Deduct stock ONLY if not demo mode
        if (!isDemoMode) {
            product.recipe.forEach(recipeItem => {
                const ingredient = ingredients.find(i => i.id === recipeItem.ingredientId);
                ingredient.totalQuantity -= (recipeItem.quantity * quantity);
            });
            this.dataManager.saveIngredients(ingredients);
        }

        // Record sale (REVENUE ONLY - no per-unit costs)
        const sale = {
            productId: product.id,
            productName: product.name,
            sellingPrice: product.sellingPrice * quantity,
            quantity: quantity,
            paymentType: 'cash',
            eventId: activeEvent ? activeEvent.id : null,
            isDemoMode: isDemoMode // Flag for separation
        };

        return this.dataManager.recordSale(sale);
    }

    /**
     * Undo the last sale
     * Restore quantities from the product recipe
     * FIXED: Handles batch sales with quantity > 1
     * Handles both real and demo mode undo
     */
    undoLastSale() {
        const settings = this.dataManager.getSettings();
        const isDemoMode = settings.demoMode || false;
        
        // Get appropriate last sale based on mode
        const lastSale = isDemoMode ? this.dataManager.getDemoLastSale() : this.dataManager.getLastSale();
        
        if (!lastSale) {
            throw new Error('No sale to undo');
        }

        // Get the product to find recipe
        const products = this.dataManager.getProducts();
        const product = products.find(p => p.id === lastSale.productId);
        
        // Restore inventory ONLY if not demo mode
        if (product && !isDemoMode) {
            const saleQuantity = lastSale.quantity || 1;
            const ingredients = this.dataManager.getIngredients();
            
            product.recipe.forEach(recipeItem => {
                const ingredient = ingredients.find(i => i.id === recipeItem.ingredientId);
                if (ingredient) {
                    // Restore: ingredient quantity × sale quantity
                    ingredient.totalQuantity += (recipeItem.quantity * saleQuantity);
                }
            });
            this.dataManager.saveIngredients(ingredients);
        }

        // Remove sale from history
        if (isDemoMode) {
            let demoSales = this.dataManager.getDemoSales();
            demoSales = demoSales.filter(s => s.id !== lastSale.id);
            this.dataManager.saveDemoSales(demoSales);
            this.dataManager.clearDemoLastSale();
        } else {
            let sales = this.dataManager.getSales();
            sales = sales.filter(s => s.id !== lastSale.id);
            this.dataManager.saveSales(sales);
            this.dataManager.clearLastSale();
        }

        return lastSale;
    }

    /**
     * Get today's sales summary - CORRECT ACCOUNTING
     * 
     * Profit = Total Revenue - Fixed Event Cost
     * NO per-unit cost calculation
     * 
     * Handles both real and demo sales separately
     */
    getSalesSummary() {
        const settings = this.dataManager.getSettings();
        const isDemoMode = settings.demoMode || false;
        
        // Get appropriate sales based on mode
        const sales = isDemoMode ? this.dataManager.getDemoSales() : this.dataManager.getSales();
        const activeEvent = this.dataManager.getActiveEvent();
        
        // Calculate total revenue (handles batch sales with quantity)
        const totalRevenue = sales.reduce((sum, sale) => {
            return sum + sale.sellingPrice;
        }, 0);
        
        // Get fixed cost from active event
        const fixedCost = activeEvent ? activeEvent.fixedCost : 0;
        const netProfit = totalRevenue - fixedCost;
        
        // Count total items sold (sum of quantities)
        const itemsSold = sales.reduce((sum, sale) => sum + (sale.quantity || 1), 0);

        return {
            totalRevenue,
            fixedCost,
            netProfit,
            itemsSold,
            hasActiveEvent: activeEvent && activeEvent.status === 'active',
            isDemoMode: isDemoMode
        };
    }

    /**
     * Get sales breakdown by product
     * FIXED: Properly counts batch sales with quantity > 1
     * Handles both real and demo sales
     */
    getSalesBreakdown() {
        const settings = this.dataManager.getSettings();
        const isDemoMode = settings.demoMode || false;
        
        // Get appropriate sales based on mode
        const sales = isDemoMode ? this.dataManager.getDemoSales() : this.dataManager.getSales();
        const breakdown = {};

        sales.forEach(sale => {
            if (!breakdown[sale.productId]) {
                breakdown[sale.productId] = {
                    productName: sale.productName,
                    count: 0,
                    revenue: 0
                };
            }
            // Count actual items sold (sum of quantities)
            breakdown[sale.productId].count += (sale.quantity || 1);
            breakdown[sale.productId].revenue += sale.sellingPrice;
        });

        return Object.values(breakdown).sort((a, b) => b.revenue - a.revenue);
    }

    /**
     * Get low stock ingredients
     * Inventory tracking is PURELY operational - NOT for costing
     */
    getLowStockIngredients() {
        const ingredients = this.dataManager.getIngredients();
        return ingredients.filter(i => 
            i.lowStockThreshold && i.totalQuantity <= i.lowStockThreshold
        );
    }
}

// ========================================
// UI MANAGER
// ========================================

class UIManager {
    constructor(dataManager, businessLogic) {
        this.dataManager = dataManager;
        this.businessLogic = businessLogic;
        this.currentScreen = 'cashier';
        this.editingIngredient = null;
        this.editingProduct = null;
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

    /**
     * Setup navigation
     */
    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const screen = btn.dataset.screen;
                this.switchScreen(screen);
            });
        });
    }

    /**
     * Switch between screens
     */
    switchScreen(screenName) {
        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.screen === screenName);
        });

        // Update active screen
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

    /**
     * Setup modal functionality
     */
    setupModals() {
        // Close modals
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal(btn.closest('.modal').id);
            });
        });

        // Close modal on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    /**
     * Open a modal
     */
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    /**
     * Close a modal
     */
    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        this.editingIngredient = null;
        this.editingProduct = null;
    }

    /**
     * Setup forms
     */
    setupForms() {
        // Ingredient form
        document.getElementById('ingredient-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveIngredient();
        });

        // Product form
        document.getElementById('product-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        // Start event form
        document.getElementById('start-event-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.startEvent();
        });
    }

    /**
     * Setup buttons
     */
    setupButtons() {
        // Event action button (dynamically changes between Start/End)
        document.getElementById('event-action-btn').addEventListener('click', () => {
            const activeEvent = this.dataManager.getActiveEvent();
            if (activeEvent && activeEvent.status === 'active') {
                this.openEndEventModal();
            } else {
                this.openStartEventModal();
            }
        });

        // End event confirm
        document.getElementById('end-event-confirm').addEventListener('click', () => {
            this.endEvent();
        });

        document.getElementById('end-event-cancel').addEventListener('click', () => {
            this.closeModal('end-event-modal');
        });

        // Batch sale quantity input - update total on change
        const batchQtyInput = document.getElementById('batch-quantity');
        if (batchQtyInput) {
            batchQtyInput.addEventListener('input', () => {
                this.updateBatchTotal();
            });
        }

        // Batch sale confirm button
        document.getElementById('batch-sale-confirm').addEventListener('click', () => {
            this.confirmBatchSale();
        });

        // Break-even calculation inputs
        const fixedCostInput = document.getElementById('event-fixed-cost');
        const plannedOutputInput = document.getElementById('event-planned-output');
        
        if (fixedCostInput) {
            fixedCostInput.addEventListener('input', () => {
                this.updateBreakEvenCalc();
            });
        }
        
        if (plannedOutputInput) {
            plannedOutputInput.addEventListener('input', () => {
                this.updateBreakEvenCalc();
            });
        }

        // Demo mode toggle
        const demoToggle = document.getElementById('demo-mode-toggle');
        if (demoToggle) {
            demoToggle.addEventListener('change', (e) => {
                this.toggleDemoMode(e.target.checked);
            });
        }

        // Clear demo sales button
        const clearDemoBtn = document.getElementById('clear-demo-sales-btn');
        if (clearDemoBtn) {
            clearDemoBtn.addEventListener('click', () => {
                this.clearDemoSales();
            });
        }

        // Theme selector
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.changeTheme(e.target.value);
            });
        }

        // Add ingredient button
        document.getElementById('add-ingredient-btn').addEventListener('click', () => {
            this.openIngredientModal();
        });

        // Add product button
        document.getElementById('add-product-btn').addEventListener('click', () => {
            this.openProductModal();
        });

        // Add recipe item button
        document.getElementById('add-recipe-item-btn').addEventListener('click', () => {
            this.addRecipeBuilderItem();
        });

        // Undo sale button
        document.getElementById('undo-sale-btn').addEventListener('click', () => {
            this.undoSale();
        });

        // Restock low items button
        document.getElementById('restock-low-btn').addEventListener('click', () => {
            this.bulkRestockLowItems();
        });

        // Export data button
        document.getElementById('export-data-btn').addEventListener('click', () => {
            this.exportData();
        });

        // Reset event button
        document.getElementById('reset-event-btn').addEventListener('click', () => {
            this.confirmResetEvent();
        });
    }

    /**
     * Render all screens
     */
    renderAll() {
        this.updateEventBanner();
        this.renderCashier();
        this.renderProducts();
        this.renderInventory();
        this.renderReports();
    }

    // ========================================
    // EVENT MANAGEMENT
    // ========================================

    /**
     * Update event status banner
     */
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
            actionBtn.classList.remove('btn-primary');
            actionBtn.classList.add('btn-danger');
        } else {
            banner.classList.remove('active');
            statusText.textContent = 'No Active Event';
            actionBtn.textContent = 'Start Event';
            actionBtn.classList.remove('btn-danger');
            actionBtn.classList.add('btn-primary');
        }
    }

    /**
     * Open start event modal
     */
    openStartEventModal() {
        document.getElementById('event-name').value = '';
        document.getElementById('event-fixed-cost').value = '';
        document.getElementById('event-planned-output').value = '';
        
        // Clear break-even display
        this.updateBreakEvenCalc();
        
        this.openModal('start-event-modal');
    }

    /**
     * Start event
     */
    startEvent() {
        const name = document.getElementById('event-name').value;
        const fixedCost = parseFloat(document.getElementById('event-fixed-cost').value);
        const plannedOutput = parseInt(document.getElementById('event-planned-output').value) || null;

        if (!name || name.trim() === '') {
            this.showToast('Please enter an event name', 'error');
            return;
        }

        if (isNaN(fixedCost) || fixedCost < 0) {
            this.showToast('Please enter a valid fixed cost', 'error');
            return;
        }

        this.dataManager.startEvent({ name, fixedCost, plannedOutput });
        this.showToast(`Event "${name}" started!`, 'success');
        this.closeModal('start-event-modal');
        this.renderAll();
    }

    /**
     * Update break-even calculation in Start Event modal
     * Shows estimated break-even price based on fixed cost and planned output
     */
    updateBreakEvenCalc() {
        const fixedCost = parseFloat(document.getElementById('event-fixed-cost').value) || 0;
        const plannedOutput = parseInt(document.getElementById('event-planned-output').value) || 0;
        const breakEvenDiv = document.getElementById('break-even-calc');
        
        if (!breakEvenDiv) return;
        
        if (fixedCost > 0 && plannedOutput > 0) {
            const breakEvenPrice = fixedCost / plannedOutput;
            
            breakEvenDiv.innerHTML = `
                <div style="margin-top: var(--spacing-md); padding: var(--spacing-md); background: var(--surface); border-left: 3px solid var(--primary); border-radius: var(--border-radius);">
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: var(--spacing-xs);">
                        💡 Break-Even Estimate
                    </div>
                    <div style="color: var(--text-secondary); font-size: var(--font-size-sm);">
                        To cover ₱${fixedCost.toFixed(2)} with ${plannedOutput} items, you need to average:
                    </div>
                    <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--primary); margin-top: var(--spacing-xs);">
                        ${this.formatCurrency(breakEvenPrice)} per item
                    </div>
                    <div style="color: var(--text-secondary); font-size: var(--font-size-xs); margin-top: var(--spacing-xs); font-style: italic;">
                        This is just a reference - doesn't affect accounting
                    </div>
                </div>
            `;
        } else {
            breakEvenDiv.innerHTML = '';
        }
    }

    /**
     * Open end event modal
     */
    openEndEventModal() {
        const activeEvent = this.dataManager.getActiveEvent();
        if (!activeEvent) return;

        const summary = this.businessLogic.getSalesSummary();
        const summaryDiv = document.getElementById('end-event-summary');

        const profitClass = summary.netProfit >= 0 ? 'success' : 'danger';
        const profitLabel = summary.netProfit >= 0 ? 'Profit' : 'Loss';

        // Build planned output section if it exists
        let plannedOutputSection = '';
        if (activeEvent.plannedOutput) {
            const percentage = Math.min((summary.itemsSold / activeEvent.plannedOutput) * 100, 100);
            const achieved = summary.itemsSold >= activeEvent.plannedOutput;
            
            plannedOutputSection = `
                <div style="background: var(--surface); padding: var(--spacing-md); border-radius: var(--border-radius); margin-bottom: var(--spacing-md); border-left: 3px solid var(--${achieved ? 'success' : 'warning'});">
                    <div style="font-weight: 600; margin-bottom: var(--spacing-xs);">
                        📊 Planned Output: ${activeEvent.plannedOutput} items
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <span style="font-size: var(--font-size-lg); font-weight: 700; color: var(--${achieved ? 'success' : 'warning'});">
                            ${summary.itemsSold} sold (${percentage.toFixed(1)}%)
                        </span>
                        <span style="color: var(--${achieved ? 'success' : 'text-secondary'});">
                            ${achieved ? '✅ Goal Achieved!' : `${activeEvent.plannedOutput - summary.itemsSold} short`}
                        </span>
                    </div>
                </div>
            `;
        }

        summaryDiv.innerHTML = `
            <h3 style="margin-bottom: var(--spacing-md);">${activeEvent.name}</h3>
            ${plannedOutputSection}
            <div style="background: var(--background); padding: var(--spacing-md); border-radius: var(--border-radius); margin-bottom: var(--spacing-md);">
                <div style="display: flex; justify-content: space-between; padding: var(--spacing-xs) 0;">
                    <span>Total Revenue:</span>
                    <strong>${this.formatCurrency(summary.totalRevenue)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: var(--spacing-xs) 0; border-bottom: 2px solid var(--border);">
                    <span>Fixed Cost:</span>
                    <strong>${this.formatCurrency(summary.fixedCost)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: var(--spacing-sm) 0; font-size: var(--font-size-lg);">
                    <span>Net ${profitLabel}:</span>
                    <strong style="color: var(--${profitClass});">${this.formatCurrency(Math.abs(summary.netProfit))}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: var(--spacing-xs) 0;">
                    <span>Items Sold:</span>
                    <strong>${summary.itemsSold}</strong>
                </div>
            </div>
        `;

        this.openModal('end-event-modal');
    }

    /**
     * End event
     */
    endEvent() {
        const event = this.dataManager.endEvent();

        if (event) {
            const profitLabel = event.profit >= 0 ? 'Profit' : 'Loss';
            this.showToast(
                `Event ended: ${event.name} - ${profitLabel}: ${this.formatCurrency(Math.abs(event.profit))}`,
                event.profit >= 0 ? 'success' : 'warning'
            );
        }

        this.closeModal('end-event-modal');
        this.renderAll();
    }

    // ========================================
    // DEMO MODE
    // ========================================

    /**
     * Initialize demo mode on load
     */
    initDemoMode() {
        const settings = this.dataManager.getSettings();
        const toggle = document.getElementById('demo-mode-toggle');
        
        if (toggle) {
            toggle.checked = settings.demoMode || false;
        }
        
        this.updateDemoIndicator(settings.demoMode || false);
    }

    /**
     * Toggle demo mode
     */
    toggleDemoMode(enabled) {
        const settings = this.dataManager.getSettings();
        settings.demoMode = enabled;
        this.dataManager.saveSettings(settings);
        
        this.updateDemoIndicator(enabled);
        
        if (enabled) {
            this.showToast('Demo Mode ON - Sales won\'t affect inventory', 'warning');
        } else {
            this.showToast('Demo Mode OFF - Real sales enabled', 'success');
        }
        
        this.renderAll();
    }

    /**
     * Update demo mode indicator
     */
    updateDemoIndicator(isDemoMode) {
        const indicator = document.getElementById('demo-indicator');
        if (indicator) {
            indicator.style.display = isDemoMode ? 'block' : 'none';
        }
        
        // Update event banner to show demo mode
        const eventBanner = document.getElementById('event-banner');
        if (eventBanner) {
            if (isDemoMode) {
                eventBanner.classList.add('demo-mode');
            } else {
                eventBanner.classList.remove('demo-mode');
            }
        }
    }

    /**
     * Clear all demo sales
     */
    clearDemoSales() {
        this.showConfirmDialog(
            'Clear Demo Sales',
            'This will delete all demo/test sales. Real sales and inventory are not affected.',
            () => {
                this.dataManager.clearAllDemoSales();
                this.showToast('Demo sales cleared', 'success');
                this.renderAll();
            }
        );
    }

    // ========================================
    // THEME MANAGEMENT
    // ========================================

    /**
     * Initialize theme on load
     */
    initTheme() {
        const settings = this.dataManager.getSettings();
        const themeSelect = document.getElementById('theme-select');
        
        if (themeSelect) {
            themeSelect.value = settings.theme || 'auto';
        }
        
        this.applyTheme(settings.theme || 'auto');
        
        // Listen for system theme changes when in auto mode
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                const settings = this.dataManager.getSettings();
                if (settings.theme === 'auto') {
                    this.applyTheme('auto');
                }
            });
        }
    }

    /**
     * Change theme (called when user selects from dropdown)
     */
    changeTheme(theme) {
        const settings = this.dataManager.getSettings();
        settings.theme = theme;
        this.dataManager.saveSettings(settings);
        
        this.applyTheme(theme);
        
        const themeNames = {
            'auto': 'Auto (System)',
            'light': 'Light Mode',
            'dark': 'Dark Mode'
        };
        
        this.showToast(`Theme: ${themeNames[theme]}`, 'success');
    }

    /**
     * Apply theme to the document
     */
    applyTheme(theme) {
        const body = document.body;
        
        if (theme === 'dark') {
            body.classList.add('dark-mode');
        } else if (theme === 'light') {
            body.classList.remove('dark-mode');
        } else if (theme === 'auto') {
            // Check system preference
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                body.classList.add('dark-mode');
            } else {
                body.classList.remove('dark-mode');
            }
        }
    }

    // ========================================
    // CASHIER SCREEN
    // ========================================

    /**
     * Render cashier screen
     */
    renderCashier() {
        const summary = this.businessLogic.getSalesSummary();
        const activeEvent = this.dataManager.getActiveEvent();
        
        // Update stats
        document.getElementById('total-sales').textContent = this.formatCurrency(summary.totalRevenue);
        document.getElementById('items-sold').textContent = summary.itemsSold;

        // Update planned output progress
        this.updatePlannedOutputProgress(activeEvent, summary);

        // Render product buttons
        const products = this.dataManager.getProducts().filter(p => p.active);
        const grid = document.getElementById('product-grid');

        if (products.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <p>No active products</p>
                    <p class="empty-hint">Add products in the Products tab</p>
                </div>
            `;
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

            // Add click handlers
            grid.querySelectorAll('.product-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.processSale(btn.dataset.productId);
                });
            });
        }

        // Update undo button
        const lastSale = this.dataManager.getLastSale();
        document.getElementById('undo-sale-btn').disabled = !lastSale;
    }

    /**
     * Update planned output progress indicator
     */
    updatePlannedOutputProgress(activeEvent, summary) {
        const progressDiv = document.getElementById('planned-output-progress');
        if (!progressDiv) return;
        
        // Only show if there's an active event with planned output
        if (!activeEvent || !activeEvent.plannedOutput) {
            progressDiv.style.display = 'none';
            return;
        }
        
        const planned = activeEvent.plannedOutput;
        const sold = summary.itemsSold;
        const percentage = Math.min((sold / planned) * 100, 100);
        const remaining = Math.max(planned - sold, 0);
        
        // Determine status color
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
                    <span style="font-size: var(--font-size-lg); font-weight: 700; color: var(--${statusClass});">
                        ${sold} / ${planned}
                    </span>
                    <span style="font-size: var(--font-size-sm); color: var(--text-secondary);">
                        ${remaining} remaining
                    </span>
                </div>
                
                <!-- Progress Bar -->
                <div style="width: 100%; height: 8px; background: var(--background); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: var(--${statusClass}); transition: width 0.3s ease;"></div>
                </div>
                
                <div style="margin-top: var(--spacing-xs); font-size: var(--font-size-xs); color: var(--text-secondary); font-style: italic;">
                    ${percentage.toFixed(1)}% complete
                </div>
            </div>
        `;
    }

    /**
     * Process a sale - Opens batch modal
     */
    processSale(productId) {
        this.openBatchSaleModal(productId);
    }

    /**
     * Open batch sale modal
     */
    openBatchSaleModal(productId) {
        const product = this.dataManager.getProducts().find(p => p.id === productId);
        if (!product) return;

        // Store current product
        this.currentBatchProduct = product;

        // Set up modal
        document.getElementById('batch-sale-title').textContent = product.name;
        document.getElementById('batch-product-name').textContent = product.name;
        document.getElementById('batch-product-price').textContent = `${this.formatCurrency(product.sellingPrice)} each`;
        document.getElementById('batch-quantity').value = '1';
        
        // Update total and warnings
        this.updateBatchTotal();

        this.openModal('batch-sale-modal');
    }

    /**
     * Update batch sale total and check stock warnings
     */
    updateBatchTotal() {
        if (!this.currentBatchProduct) return;

        const quantity = parseInt(document.getElementById('batch-quantity').value) || 1;
        const total = this.currentBatchProduct.sellingPrice * quantity;

        // Update total display
        document.getElementById('batch-total-amount').textContent = this.formatCurrency(total);

        // Check for stock warnings (soft - non-blocking)
        const warnings = this.businessLogic.checkStockWarnings(this.currentBatchProduct.id, quantity);
        const warningsDiv = document.getElementById('batch-warnings');

        if (warnings && warnings.length > 0) {
            warningsDiv.innerHTML = `
                <strong style="color: var(--warning);">⚠️ Low Stock Warning:</strong><br>
                ${warnings.map(w => 
                    `${w.ingredientName}: ~${w.estimatedCupsLeft} cups remaining after this sale`
                ).join('<br>')}
            `;
            warningsDiv.style.display = 'block';
        } else {
            warningsDiv.innerHTML = '';
            warningsDiv.style.display = 'none';
        }
    }

    /**
     * Confirm batch sale
     */
    confirmBatchSale() {
        if (!this.currentBatchProduct) return;

        const quantity = parseInt(document.getElementById('batch-quantity').value) || 1;

        if (quantity < 1) {
            this.showToast('Quantity must be at least 1', 'error');
            return;
        }

        try {
            // Process sale with quantity
            this.businessLogic.processSale(this.currentBatchProduct.id, quantity);
            
            this.showToast(`Sold ${quantity}x ${this.currentBatchProduct.name}`, 'success');
            this.closeModal('batch-sale-modal');
            this.currentBatchProduct = null;
            this.renderAll();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    /**
     * Undo last sale
     * Shows quantity info for batch sales
     */
    undoSale() {
        const lastSale = this.dataManager.getLastSale();
        if (!lastSale) {
            this.showToast('No sale to undo', 'error');
            return;
        }

        const quantity = lastSale.quantity || 1;
        const quantityText = quantity > 1 ? ` (${quantity}x)` : '';
        
        this.showConfirmDialog(
            'Undo Last Sale',
            `Undo: ${lastSale.productName}${quantityText} - ${this.formatCurrency(lastSale.sellingPrice)}?\n\nStock will be restored.`,
            () => {
                try {
                    const sale = this.businessLogic.undoLastSale();
                    const qty = sale.quantity || 1;
                    const qtyText = qty > 1 ? ` (${qty}x)` : '';
                    this.showToast(`Undone: ${sale.productName}${qtyText}`, 'success');
                    this.renderAll();
                } catch (error) {
                    this.showToast(error.message, 'error');
                }
            }
        );
    }

    // ========================================
    // PRODUCTS SCREEN
    // ========================================

    /**
     * Render products screen - NO COST CALCULATIONS
     * Products only track selling price
     */
    renderProducts() {
        const products = this.dataManager.getProducts();
        const list = document.getElementById('product-list');

        if (products.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <p>No products yet</p>
                    <p class="empty-hint">Create your first product</p>
                </div>
            `;
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
                            <span class="card-badge ${product.active ? 'active' : 'inactive'}">
                                ${product.active ? '✓ Active' : '✗ Inactive'}
                            </span>
                            ${!canSell && product.active ? '<span class="card-badge low-stock">Out of Stock</span>' : ''}
                        </div>

                        <div class="card-recipe">
                            <div class="recipe-title">Recipe:</div>
                            <div class="recipe-list">
                                ${this.renderRecipeList(product.recipe)}
                            </div>
                        </div>

                        <div class="card-actions">
                            <button class="card-btn" data-action="edit" data-id="${product.id}">
                                Edit
                            </button>
                            <button class="card-btn danger" data-action="delete" data-id="${product.id}">
                                Delete
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click handlers
            list.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', () => this.editProduct(btn.dataset.id));
            });
            list.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', () => this.deleteProduct(btn.dataset.id));
            });
        }
    }

    /**
     * Render recipe list
     */
    renderRecipeList(recipe) {
        const ingredients = this.dataManager.getIngredients();
        return recipe.map(item => {
            const ingredient = ingredients.find(i => i.id === item.ingredientId);
            return ingredient 
                ? `<div class="recipe-item">• ${item.quantity} ${ingredient.unit} ${ingredient.name}</div>`
                : '';
        }).join('');
    }

    /**
     * Open product modal
     */
    openProductModal(productId = null) {
        this.editingProduct = productId;
        const modal = document.getElementById('product-modal');
        const form = document.getElementById('product-form');
        
        // Reset form
        form.reset();
        document.getElementById('product-id').value = '';
        document.getElementById('recipe-builder').innerHTML = '';

        if (productId) {
            // Edit mode
            const product = this.dataManager.getProducts().find(p => p.id === productId);
            document.getElementById('product-modal-title').textContent = 'Edit Product';
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-price').value = product.sellingPrice;
            document.getElementById('product-active').checked = product.active;

            // Load recipe
            product.recipe.forEach(item => {
                this.addRecipeBuilderItem(item.ingredientId, item.quantity);
            });
        } else {
            // Add mode
            document.getElementById('product-modal-title').textContent = 'Add Product';
            this.addRecipeBuilderItem(); // Add one empty recipe item
        }

        this.openModal('product-modal');
    }

    /**
     * Add recipe builder item
     */
    addRecipeBuilderItem(ingredientId = '', quantity = '') {
        const container = document.getElementById('recipe-builder');
        const ingredients = this.dataManager.getIngredients();
        
        const item = document.createElement('div');
        item.className = 'recipe-builder-item';
        item.innerHTML = `
            <div class="form-group">
                <select class="recipe-ingredient" required>
                    <option value="">Select ingredient</option>
                    ${ingredients.map(i => `
                        <option value="${i.id}" ${i.id === ingredientId ? 'selected' : ''}>
                            ${i.name} (${i.unit})
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <input type="number" class="recipe-quantity" step="0.01" min="0" 
                       placeholder="Quantity" value="${quantity}" required>
            </div>
            <button type="button" class="remove-recipe-btn">&times;</button>
        `;

        item.querySelector('.remove-recipe-btn').addEventListener('click', () => {
            item.remove();
        });

        container.appendChild(item);
    }

    /**
     * Save product
     */
    saveProduct() {
        const id = document.getElementById('product-id').value;
        const name = document.getElementById('product-name').value;
        const price = parseFloat(document.getElementById('product-price').value);
        const active = document.getElementById('product-active').checked;

        // Build recipe
        const recipeItems = document.querySelectorAll('.recipe-builder-item');
        const recipe = [];
        
        recipeItems.forEach(item => {
            const ingredientId = item.querySelector('.recipe-ingredient').value;
            const quantity = parseFloat(item.querySelector('.recipe-quantity').value);
            if (ingredientId && quantity > 0) {
                recipe.push({ ingredientId, quantity });
            }
        });

        if (recipe.length === 0) {
            this.showToast('Please add at least one ingredient', 'error');
            return;
        }

        const productData = { name, sellingPrice: price, recipe, active };

        if (id) {
            this.dataManager.updateProduct(id, productData);
            this.showToast('Product updated!', 'success');
        } else {
            this.dataManager.addProduct(productData);
            this.showToast('Product added!', 'success');
        }

        this.closeModal('product-modal');
        this.renderAll();
    }

    /**
     * Edit product
     */
    editProduct(id) {
        this.openProductModal(id);
    }

    /**
     * Delete product
     */
    deleteProduct(id) {
        const product = this.dataManager.getProducts().find(p => p.id === id);
        this.showConfirmDialog(
            'Delete Product',
            `Are you sure you want to delete "${product.name}"?`,
            () => {
                this.dataManager.deleteProduct(id);
                this.showToast('Product deleted', 'success');
                this.renderAll();
            }
        );
    }

    // ========================================
    // INVENTORY SCREEN
    // ========================================

    /**
     * Render inventory screen with FIXED costing display
     */
    renderInventory() {
        const ingredients = this.dataManager.getIngredients();
        const list = document.getElementById('ingredient-list');
        
        // Check for low stock items
        const lowStockItems = this.businessLogic.getLowStockIngredients();
        const restockBtn = document.getElementById('restock-low-btn');
        
        if (lowStockItems.length > 0) {
            restockBtn.style.display = 'block';
            restockBtn.textContent = `📦 Restock ${lowStockItems.length} Low Item${lowStockItems.length > 1 ? 's' : ''}`;
        } else {
            restockBtn.style.display = 'none';
        }
        
        // Get stock changes since last snapshot
        const stockChanges = this.dataManager.getStockChanges();

        if (ingredients.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <p>No ingredients yet</p>
                    <p class="empty-hint">Add your first ingredient</p>
                </div>
            `;
        } else {
            list.innerHTML = ingredients.map(ingredient => {
                const stockPercent = ingredient.lowStockThreshold 
                    ? (ingredient.totalQuantity / ingredient.lowStockThreshold) * 100 
                    : 100;
                const stockClass = ingredient.totalQuantity <= 0 ? 'out' 
                    : (ingredient.lowStockThreshold && ingredient.totalQuantity <= ingredient.lowStockThreshold) ? 'low' 
                    : '';
                const isLowStock = ingredient.lowStockThreshold && ingredient.totalQuantity <= ingredient.lowStockThreshold;
                
                // Check for stock changes
                const change = stockChanges[ingredient.id];
                let changeIndicator = '';
                if (change) {
                    const changeClass = change.change > 0 ? 'stock-increase' : 'stock-decrease';
                    const changeIcon = change.change > 0 ? '↑' : '↓';
                    const changeText = Math.abs(change.change).toFixed(1);
                    changeIndicator = `
                        <span class="stock-change-badge ${changeClass}" title="Changed from ${change.old} ${ingredient.unit}">
                            ${changeIcon} ${changeText} ${ingredient.unit}
                        </span>
                    `;
                }

                return `
                    <div class="ingredient-card">
                        <div class="card-header">
                            <div class="card-title">${ingredient.name}</div>
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                ${isLowStock ? '<span class="card-badge low-stock">Low Stock</span>' : ''}
                                ${changeIndicator}
                            </div>
                        </div>

                        <div class="stock-bar">
                            <div class="stock-fill ${stockClass}" style="width: ${Math.min(stockPercent, 100)}%"></div>
                        </div>

                        <div class="ingredient-info">
                            <div class="info-item">
                                <span class="info-label">Current Stock</span>
                                <span class="info-value">${ingredient.totalQuantity} ${ingredient.unit}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Low Stock Alert</span>
                                <span class="info-value">${ingredient.lowStockThreshold || 'Not set'} ${ingredient.lowStockThreshold ? ingredient.unit : ''}</span>
                            </div>
                        </div>

                        <div class="stock-actions">
                            <button class="stock-adjust-btn" data-action="quick-add" data-id="${ingredient.id}" title="Quick add stock">
                                <span class="stock-btn-icon">+</span>
                                <span class="stock-btn-label">Add Stock</span>
                            </button>
                            <button class="stock-adjust-btn" data-action="quick-remove" data-id="${ingredient.id}" title="Quick remove stock">
                                <span class="stock-btn-icon">−</span>
                                <span class="stock-btn-label">Remove</span>
                            </button>
                        </div>

                        <div class="card-actions">
                            <button class="card-btn" data-action="edit" data-id="${ingredient.id}">
                                Edit
                            </button>
                            <button class="card-btn danger" data-action="delete" data-id="${ingredient.id}">
                                Delete
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click handlers
            list.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', () => this.editIngredient(btn.dataset.id));
            });
            list.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', () => this.deleteIngredient(btn.dataset.id));
            });
            list.querySelectorAll('[data-action="quick-add"]').forEach(btn => {
                btn.addEventListener('click', () => this.quickAdjustStock(btn.dataset.id, 'add'));
            });
            list.querySelectorAll('[data-action="quick-remove"]').forEach(btn => {
                btn.addEventListener('click', () => this.quickAdjustStock(btn.dataset.id, 'remove'));
            });
        }
    }

    /**
     * Quick stock adjustment (add/remove without opening full edit modal)
     */
    quickAdjustStock(ingredientId, action) {
        const ingredient = this.dataManager.getIngredients().find(i => i.id === ingredientId);
        if (!ingredient) return;

        const actionLabel = action === 'add' ? 'Add' : 'Remove';
        const currentStock = ingredient.totalQuantity;
        
        // Prompt for quantity
        const promptMessage = action === 'add' 
            ? `Add stock to ${ingredient.name}\n\nCurrent: ${currentStock} ${ingredient.unit}\n\nEnter amount to ADD:`
            : `Remove stock from ${ingredient.name}\n\nCurrent: ${currentStock} ${ingredient.unit}\n\nEnter amount to REMOVE:`;
        
        const amountStr = prompt(promptMessage);
        
        if (amountStr === null) return; // Cancelled
        
        const amount = parseFloat(amountStr);
        
        if (isNaN(amount) || amount <= 0) {
            this.showToast('Please enter a valid positive number', 'error');
            return;
        }

        // Calculate new stock
        let newStock;
        if (action === 'add') {
            newStock = currentStock + amount;
        } else {
            newStock = currentStock - amount;
            if (newStock < 0) {
                this.showToast('Cannot remove more than current stock', 'error');
                return;
            }
        }

        // Update stock
        this.dataManager.updateIngredient(ingredientId, {
            totalQuantity: newStock
        });
        
        // Update snapshot for next comparison
        this.dataManager.takeStockSnapshot();

        // Show confirmation
        const change = action === 'add' ? `+${amount}` : `-${amount}`;
        this.showToast(`${ingredient.name}: ${change} ${ingredient.unit} (now ${newStock} ${ingredient.unit})`, 'success');
        
        this.renderAll();
    }

    /**
     * Bulk restock low stock items
     */
    bulkRestockLowItems() {
        const lowStockItems = this.businessLogic.getLowStockIngredients();
        
        if (lowStockItems.length === 0) {
            this.showToast('No low stock items found', 'info');
            return;
        }

        // Build message
        let message = 'Low stock items:\n\n';
        lowStockItems.forEach(item => {
            message += `• ${item.name}: ${item.totalQuantity} ${item.unit} (alert: ${item.lowStockThreshold})\n`;
        });
        message += '\nRestock these items to their original batch quantities?';

        this.showConfirmDialog(
            'Bulk Restock',
            message,
            () => {
                let restockedCount = 0;
                
                lowStockItems.forEach(item => {
                    // Calculate original batch quantity from cost data
                    // Restore to original batch quantity (when unit cost was first set)
                    const originalBatchQty = item.totalQuantity + (item.lowStockThreshold * 2);
                    
                    this.dataManager.updateIngredient(item.id, {
                        totalQuantity: originalBatchQty
                    });
                    
                    restockedCount++;
                });
                
                // Update snapshot after bulk restock
                this.dataManager.takeStockSnapshot();

                this.showToast(`Restocked ${restockedCount} item${restockedCount > 1 ? 's' : ''}`, 'success');
                this.renderAll();
            }
        );
    }

    /**
     * Open ingredient modal - QUANTITY ONLY
     */
    openIngredientModal(ingredientId = null) {
        this.editingIngredient = ingredientId;
        const modal = document.getElementById('ingredient-modal');
        const form = document.getElementById('ingredient-form');
        
        // Reset form
        form.reset();
        document.getElementById('ingredient-id').value = '';

        if (ingredientId) {
            // Edit mode
            const ingredient = this.dataManager.getIngredients().find(i => i.id === ingredientId);
            document.getElementById('ingredient-modal-title').textContent = 'Edit Ingredient';
            document.getElementById('ingredient-id').value = ingredient.id;
            document.getElementById('ingredient-name').value = ingredient.name;
            document.getElementById('ingredient-unit').value = ingredient.unit;
            document.getElementById('ingredient-total-quantity').value = ingredient.totalQuantity;
            document.getElementById('ingredient-threshold').value = ingredient.lowStockThreshold || '';
        } else {
            // Add mode
            document.getElementById('ingredient-modal-title').textContent = 'Add Ingredient';
        }

        this.openModal('ingredient-modal');
    }

    /**
     * Save ingredient - QUANTITY TRACKING ONLY
     * No cost data stored in ingredients
     */
    saveIngredient() {
        const id = document.getElementById('ingredient-id').value;
        const name = document.getElementById('ingredient-name').value;
        const unit = document.getElementById('ingredient-unit').value;
        const totalQuantity = parseFloat(document.getElementById('ingredient-total-quantity').value);
        const lowStockThreshold = parseFloat(document.getElementById('ingredient-threshold').value) || null;

        if (totalQuantity < 0) {
            this.showToast('Quantity cannot be negative', 'error');
            return;
        }

        const ingredientData = {
            name,
            unit,
            totalQuantity,       // Quantity only - no cost tracking
            lowStockThreshold
        };

        if (id) {
            this.dataManager.updateIngredient(id, ingredientData);
            this.showToast('Ingredient updated!', 'success');
        } else {
            this.dataManager.addIngredient(ingredientData);
            this.showToast('Ingredient added!', 'success');
        }

        this.closeModal('ingredient-modal');
        this.renderAll();
    }

    /**
     * Edit ingredient
     */
    editIngredient(id) {
        this.openIngredientModal(id);
    }

    /**
     * Delete ingredient
     */
    deleteIngredient(id) {
        const ingredient = this.dataManager.getIngredients().find(i => i.id === id);
        
        // Check if ingredient is used in any products
        const products = this.dataManager.getProducts();
        const usedInProducts = products.filter(p => 
            p.recipe.some(r => r.ingredientId === id)
        );

        if (usedInProducts.length > 0) {
            const productNames = usedInProducts.map(p => p.name).join(', ');
            this.showToast(`Cannot delete - used in: ${productNames}`, 'error');
            return;
        }

        this.showConfirmDialog(
            'Delete Ingredient',
            `Are you sure you want to delete "${ingredient.name}"?`,
            () => {
                this.dataManager.deleteIngredient(id);
                this.showToast('Ingredient deleted', 'success');
                this.renderAll();
            }
        );
    }

    // ========================================
    // REPORTS SCREEN
    // ========================================

    /**
     * Render reports screen with CORRECT ACCOUNTING
     * Profit = Revenue - Fixed Event Cost
     * Handles both real and demo sales
     */
    renderReports() {
        const summary = this.businessLogic.getSalesSummary();
        const breakdown = this.businessLogic.getSalesBreakdown();
        
        // Get appropriate sales based on mode
        const settings = this.dataManager.getSettings();
        const sales = settings.demoMode ? this.dataManager.getDemoSales() : this.dataManager.getSales();

        // Update summary stats with CORRECT accounting
        document.getElementById('report-revenue').textContent = this.formatCurrency(summary.totalRevenue);
        document.getElementById('report-fixed-cost').textContent = this.formatCurrency(summary.fixedCost);
        document.getElementById('report-profit').textContent = this.formatCurrency(summary.netProfit);
        document.getElementById('report-items').textContent = summary.itemsSold;
        
        // Update profit card styling based on profit/loss
        const profitCard = document.getElementById('profit-card');
        if (summary.netProfit < 0) {
            profitCard.classList.remove('success');
            profitCard.classList.add('loss');
            profitCard.style.background = '#fee2e2';
        } else {
            profitCard.classList.add('success');
            profitCard.classList.remove('loss');
            profitCard.style.background = '#dcfce7';
        }

        // Render sales breakdown
        const breakdownContainer = document.getElementById('sales-breakdown');
        if (breakdown.length === 0) {
            breakdownContainer.innerHTML = '<p class="empty-hint">No sales yet</p>';
        } else {
            breakdownContainer.innerHTML = breakdown.map(item => `
                <div class="breakdown-item">
                    <div>
                        <div class="breakdown-name">${item.productName}</div>
                        <div class="breakdown-stats">${item.count} sold</div>
                    </div>
                    <div class="breakdown-revenue">${this.formatCurrency(item.revenue)}</div>
                </div>
            `).join('');
        }

        // Render recent transactions (last 10)
        const transactionContainer = document.getElementById('transaction-list');
        const recentSales = sales.slice(-10).reverse();
        
        if (recentSales.length === 0) {
            transactionContainer.innerHTML = '<p class="empty-hint">No transactions yet</p>';
        } else {
            transactionContainer.innerHTML = recentSales.map(sale => {
                const date = new Date(sale.timestamp);
                const quantity = sale.quantity || 1;
                const quantityBadge = quantity > 1 ? ` <span style="background: var(--primary); color: white; padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">×${quantity}</span>` : '';
                
                return `
                    <div class="transaction-item">
                        <div>
                            <div class="transaction-product">${sale.productName}${quantityBadge}</div>
                            <div class="transaction-meta">${this.formatDateTime(date)}</div>
                        </div>
                        <div class="transaction-price">${this.formatCurrency(sale.sellingPrice)}</div>
                    </div>
                `;
            }).join('');
        }
    }

    /**
     * Export data as JSON file
     */
    exportData() {
        const data = this.dataManager.exportData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `booth-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showToast('Data exported!', 'success');
    }

    /**
     * Open event costs modal
     */
    openEventCostsModal() {
        const costs = this.dataManager.getEventCosts();
        
        document.getElementById('fixed-cost').value = costs.totalFixedCost || '';
        document.getElementById('cost-notes').value = costs.notes || '';
        
        this.openModal('event-costs-modal');
    }

    /**
     * Save event costs
     */
    saveEventCosts() {
        const totalFixedCost = parseFloat(document.getElementById('fixed-cost').value) || 0;
        const notes = document.getElementById('cost-notes').value;
        
        this.dataManager.saveEventCosts({
            totalFixedCost,
            notes
        });
        
        this.showToast('Event costs saved!', 'success');
        this.closeModal('event-costs-modal');
        this.renderReports();
    }

    /**
     * Confirm reset event
     */
    confirmResetEvent() {
        this.showConfirmDialog(
            'Reset Event',
            'This will clear all sales data but keep your products and ingredients. Are you sure?',
            () => {
                this.dataManager.resetEvent();
                this.showToast('Event reset - sales cleared', 'success');
                this.renderAll();
            }
        );
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Show a toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    /**
     * Show a confirmation dialog
     */
    showConfirmDialog(title, message, onConfirm) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        
        const confirmBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');
        
        // Remove old listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.replaceWith(newConfirmBtn);
        
        // Add new listener
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            this.closeModal('confirm-modal');
        });
        
        this.openModal('confirm-modal');
    }

    /**
     * Format currency
     */
    formatCurrency(amount) {
        return '₱' + amount.toFixed(2);
    }

    /**
     * Format date and time
     */
    formatDateTime(date) {
        return date.toLocaleString('en-PH', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// ========================================
// INITIALIZATION
// ========================================

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const dataManager = new DataManager();
    const businessLogic = new BusinessLogic(dataManager);
    const uiManager = new UIManager(dataManager, businessLogic);
    
    uiManager.init();
    
    // Take initial stock snapshot for tracking changes
    dataManager.takeStockSnapshot();
});