/**
 * DataManager Class
 * Handles all localStorage interactions and data persistence.
 */
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
            demoSales: 'booth_demo_sales',
            demoLastSale: 'booth_demo_last_sale'
        };
    }

    // --- EVENT SESSIONS ---

    getActiveEvent() {
        const data = localStorage.getItem(this.storageKey.activeEvent);
        return data ? JSON.parse(data) : null;
    }

    startEvent(eventData) {
        const event = {
            id: this.generateId(),
            name: eventData.name || 'Unnamed Event',
            startTime: new Date().toISOString(),
            fixedCost: eventData.fixedCost,
            plannedOutput: eventData.plannedOutput || null,
            notes: eventData.notes || '',
            startingInventory: JSON.parse(JSON.stringify(this.getIngredients())),
            status: 'active'
        };

        localStorage.setItem(this.storageKey.activeEvent, JSON.stringify(event));

        // Clear sales for new event
        this.saveSales([]);
        this.clearLastSale();

        return event;
    }

    endEvent() {
        const event = this.getActiveEvent();
        if (!event || event.status !== 'active') return null;

        const sales = this.getSales();
        const totalRevenue = sales.reduce((sum, sale) => sum + sale.sellingPrice, 0);
        const profit = totalRevenue - event.fixedCost;

        event.endTime = new Date().toISOString();
        event.status = 'closed';
        event.totalRevenue = totalRevenue;
        event.profit = profit;
        event.itemsSold = sales.reduce((sum, sale) => sum + (sale.quantity || 1), 0);
        event.salesLog = JSON.parse(JSON.stringify(sales));
        event.endingInventory = JSON.parse(JSON.stringify(this.getIngredients()));

        const history = this.getEventHistory();
        history.push(event);
        this.saveEventHistory(history);

        localStorage.removeItem(this.storageKey.activeEvent);

        return event;
    }

    getEventHistory() {
        const data = localStorage.getItem(this.storageKey.eventHistory);
        return data ? JSON.parse(data) : [];
    }

    saveEventHistory(history) {
        localStorage.setItem(this.storageKey.eventHistory, JSON.stringify(history));
    }

    // --- SETTINGS & DEMO MODE ---

    getSettings() {
        const data = localStorage.getItem(this.storageKey.settings);
        return data ? JSON.parse(data) : {
            theme: 'auto',
            demoMode: false
        };
    }

    saveSettings(settings) {
        localStorage.setItem(this.storageKey.settings, JSON.stringify(settings));
    }

    getDemoSales() {
        const data = localStorage.getItem(this.storageKey.demoSales);
        return data ? JSON.parse(data) : [];
    }

    saveDemoSales(sales) {
        localStorage.setItem(this.storageKey.demoSales, JSON.stringify(sales));
    }

    getDemoLastSale() {
        const data = localStorage.getItem(this.storageKey.demoLastSale);
        return data ? JSON.parse(data) : null;
    }

    saveDemoLastSale(sale) {
        localStorage.setItem(this.storageKey.demoLastSale, JSON.stringify(sale));
    }

    clearDemoLastSale() {
        localStorage.removeItem(this.storageKey.demoLastSale);
    }

    clearAllDemoSales() {
        this.saveDemoSales([]);
        this.clearDemoLastSale();
    }

    // --- INVENTORY & STOCK ---

    getIngredients() {
        const data = localStorage.getItem(this.storageKey.ingredients);
        return data ? JSON.parse(data) : [];
    }

    saveIngredients(ingredients) {
        localStorage.setItem(this.storageKey.ingredients, JSON.stringify(ingredients));
    }

    takeStockSnapshot() {
        const ingredients = this.getIngredients();
        const snapshot = {};
        ingredients.forEach(ing => {
            snapshot[ing.id] = ing.totalQuantity;
        });
        localStorage.setItem(this.storageKey.stockSnapshot, JSON.stringify(snapshot));
    }

    getStockChanges() {
        const snapshotStr = localStorage.getItem(this.storageKey.stockSnapshot);
        if (!snapshotStr) return {};

        const oldStock = JSON.parse(snapshotStr);
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

    addIngredient(ingredient) {
        const ingredients = this.getIngredients();
        ingredient.id = this.generateId();
        ingredients.push(ingredient);
        this.saveIngredients(ingredients);
        return ingredient;
    }

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

    deleteIngredient(id) {
        let ingredients = this.getIngredients();
        ingredients = ingredients.filter(i => i.id !== id);
        this.saveIngredients(ingredients);
    }

    // --- PRODUCTS ---

    getProducts() {
        const data = localStorage.getItem(this.storageKey.products);
        return data ? JSON.parse(data) : [];
    }

    saveProducts(products) {
        localStorage.setItem(this.storageKey.products, JSON.stringify(products));
    }

    addProduct(product) {
        const products = this.getProducts();
        product.id = this.generateId();
        products.push(product);
        this.saveProducts(products);
        return product;
    }

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

    deleteProduct(id) {
        let products = this.getProducts();
        products = products.filter(p => p.id !== id);
        this.saveProducts(products);
    }

    // --- SALES ---

    getSales() {
        const data = localStorage.getItem(this.storageKey.sales);
        return data ? JSON.parse(data) : [];
    }

    saveSales(sales) {
        localStorage.setItem(this.storageKey.sales, JSON.stringify(sales));
    }

    getLastSale() {
        const data = localStorage.getItem(this.storageKey.lastSale);
        return data ? JSON.parse(data) : null;
    }

    saveLastSale(sale) {
        localStorage.setItem(this.storageKey.lastSale, JSON.stringify(sale));
    }

    clearLastSale() {
        localStorage.removeItem(this.storageKey.lastSale);
    }

    recordSale(sale) {
        sale.id = this.generateId();
        sale.timestamp = new Date().toISOString();
        sale.quantity = sale.quantity || 1;

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

    // --- UTILITIES ---

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    exportData() {
        return {
            ingredients: this.getIngredients(),
            products: this.getProducts(),
            sales: this.getSales(),
            activeEvent: this.getActiveEvent(),
            eventHistory: this.getEventHistory(),
            settings: this.getSettings(),
            exportDate: new Date().toISOString(),
            version: '2.0'
        };
    }

    importData(data) {
        if (data.ingredients) this.saveIngredients(data.ingredients);
        if (data.products) this.saveProducts(data.products);
        if (data.sales) this.saveSales(data.sales);
        if (data.activeEvent) localStorage.setItem(this.storageKey.activeEvent, JSON.stringify(data.activeEvent));
        if (data.eventHistory) this.saveEventHistory(data.eventHistory);
        if (data.settings) this.saveSettings(data.settings);
    }

    resetEvent() {
        this.saveSales([]);
        this.clearLastSale();
    }

    clearAllData() {
        Object.values(this.storageKey).forEach(key => {
            localStorage.removeItem(key);
        });
    }
}
