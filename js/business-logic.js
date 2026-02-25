/**
 * BusinessLogic Class
 * Handles the core logic for sales, inventory tracking, and accounting.
 */
class BusinessLogic {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Check if a product can be sold (all ingredients available)
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
     * Check stock levels for a product sale and returns warnings
     */
    checkStockWarnings(productId, quantity = 1) {
        const products = this.dataManager.getProducts();
        const product = products.find(p => p.id === productId);
        if (!product) return null;

        const ingredients = this.dataManager.getIngredients();
        const warnings = [];

        product.recipe.forEach(recipeItem => {
            const ingredient = ingredients.find(i => i.id === recipeItem.ingredientId);
            if (!ingredient) return;

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
     * Process a sale
     */
    processSale(productId, quantity = 1) {
        const settings = this.dataManager.getSettings();
        const isDemoMode = settings.demoMode || false;

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

        const product = this.dataManager.getProducts().find(p => p.id === productId);
        const ingredients = this.dataManager.getIngredients();

        // Deduct stock ONLY if not demo mode
        if (!isDemoMode) {
            product.recipe.forEach(recipeItem => {
                const ingredient = ingredients.find(i => i.id === recipeItem.ingredientId);
                if (ingredient) {
                    ingredient.totalQuantity -= (recipeItem.quantity * quantity);
                }
            });
            this.dataManager.saveIngredients(ingredients);
        }

        // Record sale
        const sale = {
            productId: product.id,
            productName: product.name,
            sellingPrice: product.sellingPrice * quantity,
            quantity: quantity,
            paymentType: 'cash',
            eventId: activeEvent ? activeEvent.id : null,
            isDemoMode: isDemoMode
        };

        return this.dataManager.recordSale(sale);
    }

    /**
     * Undo the last sale
     */
    undoLastSale() {
        const settings = this.dataManager.getSettings();
        const isDemoMode = settings.demoMode || false;
        const lastSale = isDemoMode ? this.dataManager.getDemoLastSale() : this.dataManager.getLastSale();

        if (!lastSale) {
            throw new Error('No sale to undo');
        }

        const product = this.dataManager.getProducts().find(p => p.id === lastSale.productId);

        // Restore inventory ONLY if not demo mode
        if (product && !isDemoMode) {
            const saleQuantity = lastSale.quantity || 1;
            const ingredients = this.dataManager.getIngredients();

            product.recipe.forEach(recipeItem => {
                const ingredient = ingredients.find(i => i.id === recipeItem.ingredientId);
                if (ingredient) {
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
     * Get sales summary for accounting
     */
    getSalesSummary() {
        const settings = this.dataManager.getSettings();
        const isDemoMode = settings.demoMode || false;
        const sales = isDemoMode ? this.dataManager.getDemoSales() : this.dataManager.getSales();
        const activeEvent = this.dataManager.getActiveEvent();

        const totalRevenue = sales.reduce((sum, sale) => sum + sale.sellingPrice, 0);
        const fixedCost = activeEvent ? activeEvent.fixedCost : 0;
        const netProfit = totalRevenue - fixedCost;
        const itemsSold = sales.reduce((sum, sale) => sum + (sale.quantity || 1), 0);

        return {
            totalRevenue,
            fixedCost,
            netProfit,
            itemsSold,
            hasActiveEvent: activeEvent && activeEvent.status === 'active',
            isDemoMode
        };
    }

    /**
     * Get sales breakdown by product
     */
    getSalesBreakdown() {
        const settings = this.dataManager.getSettings();
        const isDemoMode = settings.demoMode || false;
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
            breakdown[sale.productId].count += (sale.quantity || 1);
            breakdown[sale.productId].revenue += sale.sellingPrice;
        });

        return Object.values(breakdown).sort((a, b) => b.revenue - a.revenue);
    }

    /**
     * Get low stock ingredients
     */
    getLowStockIngredients() {
        const ingredients = this.dataManager.getIngredients();
        return ingredients.filter(i =>
            i.lowStockThreshold && i.totalQuantity <= i.lowStockThreshold
        );
    }
}
