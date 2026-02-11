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
            eventCosts: 'booth_event_costs' // NEW: Fixed upfront event costs
        };
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
     * Record a sale
     */
    recordSale(sale) {
        const sales = this.getSales();
        sale.id = this.generateId();
        sale.timestamp = new Date().toISOString();
        sales.push(sale);
        this.saveSales(sales);
        this.saveLastSale(sale);
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
     * FIXED: Check totalQuantity instead of currentStock
     */
    canSellProduct(productId) {
        const products = this.dataManager.getProducts();
        const product = products.find(p => p.id === productId);
        if (!product || !product.active) return false;

        const ingredients = this.dataManager.getIngredients();
        
        for (const recipeItem of product.recipe) {
            const ingredient = ingredients.find(i => i.id === recipeItem.ingredientId);
            if (!ingredient || ingredient.totalQuantity < recipeItem.quantity) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Process a sale - SIMPLIFIED FOR CORRECT ACCOUNTING
     * 
     * Sales track: Revenue
     * Inventory tracks: Quantities
     * Accounting tracks: Fixed costs (separate)
     */
    processSale(productId) {
        if (!this.canSellProduct(productId)) {
            throw new Error('Product cannot be sold - insufficient ingredients');
        }

        const products = this.dataManager.getProducts();
        const product = products.find(p => p.id === productId);
        const ingredients = this.dataManager.getIngredients();

        // Deduct stock (quantity tracking ONLY - no cost tracking)
        product.recipe.forEach(recipeItem => {
            const ingredient = ingredients.find(i => i.id === recipeItem.ingredientId);
            ingredient.totalQuantity -= recipeItem.quantity;
        });
        this.dataManager.saveIngredients(ingredients);

        // Record sale (REVENUE ONLY - no per-unit costs)
        const sale = {
            productId: product.id,
            productName: product.name,
            sellingPrice: product.sellingPrice,
            paymentType: 'cash'
        };

        return this.dataManager.recordSale(sale);
    }

    /**
     * Undo the last sale
     * Restore quantities from the product recipe
     */
    undoLastSale() {
        const lastSale = this.dataManager.getLastSale();
        if (!lastSale) {
            throw new Error('No sale to undo');
        }

        // Get the product to find recipe
        const products = this.dataManager.getProducts();
        const product = products.find(p => p.id === lastSale.productId);
        
        if (product) {
            // Restore ingredient quantities
            const ingredients = this.dataManager.getIngredients();
            product.recipe.forEach(recipeItem => {
                const ingredient = ingredients.find(i => i.id === recipeItem.ingredientId);
                if (ingredient) {
                    ingredient.totalQuantity += recipeItem.quantity;
                }
            });
            this.dataManager.saveIngredients(ingredients);
        }

        // Remove sale from history
        let sales = this.dataManager.getSales();
        sales = sales.filter(s => s.id !== lastSale.id);
        this.dataManager.saveSales(sales);

        // Clear last sale
        this.dataManager.clearLastSale();

        return lastSale;
    }

    /**
     * Get today's sales summary - CORRECT ACCOUNTING
     * 
     * Profit = Total Revenue - Fixed Event Cost
     * NO per-unit cost calculation
     */
    getSalesSummary() {
        const sales = this.dataManager.getSales();
        const eventCosts = this.dataManager.getEventCosts();
        
        const totalRevenue = sales.reduce((sum, sale) => sum + sale.sellingPrice, 0);
        const fixedCost = eventCosts.totalFixedCost || 0;
        const netProfit = totalRevenue - fixedCost;
        const itemsSold = sales.length;

        return {
            totalRevenue,
            fixedCost,
            netProfit,
            itemsSold
        };
    }

    /**
     * Get sales breakdown by product
     */
    getSalesBreakdown() {
        const sales = this.dataManager.getSales();
        const breakdown = {};

        sales.forEach(sale => {
            if (!breakdown[sale.productId]) {
                breakdown[sale.productId] = {
                    productName: sale.productName,
                    count: 0,
                    revenue: 0
                };
            }
            breakdown[sale.productId].count++;
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

        // Event costs form
        document.getElementById('event-costs-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEventCosts();
        });
    }

    /**
     * Setup buttons
     */
    setupButtons() {
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

        // Set event costs button
        document.getElementById('set-event-costs-btn').addEventListener('click', () => {
            this.openEventCostsModal();
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
        this.renderCashier();
        this.renderProducts();
        this.renderInventory();
        this.renderReports();
    }

    // ========================================
    // CASHIER SCREEN
    // ========================================

    /**
     * Render cashier screen
     */
    renderCashier() {
        const summary = this.businessLogic.getSalesSummary();
        
        // Update stats
        document.getElementById('total-sales').textContent = this.formatCurrency(summary.totalRevenue);
        document.getElementById('items-sold').textContent = summary.itemsSold;

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
     * Process a sale
     */
    processSale(productId) {
        try {
            const sale = this.businessLogic.processSale(productId);
            this.showToast('Sale recorded!', 'success');
            this.renderAll();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    /**
     * Undo last sale
     */
    undoSale() {
        this.showConfirmDialog(
            'Undo Last Sale',
            'Are you sure you want to undo the last sale? Stock will be restored.',
            () => {
                try {
                    const sale = this.businessLogic.undoLastSale();
                    this.showToast(`Undid sale: ${sale.productName}`, 'success');
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
     */
    renderReports() {
        const summary = this.businessLogic.getSalesSummary();
        const breakdown = this.businessLogic.getSalesBreakdown();
        const sales = this.dataManager.getSales();

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
                return `
                    <div class="transaction-item">
                        <div>
                            <div class="transaction-product">${sale.productName}</div>
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