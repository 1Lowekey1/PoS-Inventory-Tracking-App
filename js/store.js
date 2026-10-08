// PopPOS data layer: the one module the UI imports for data.
//
// Usage:  import * as store from './store.js';   store.checkout({...})
//         import { S, byId } from './store.js';   read state directly
//
// Rules the store guarantees:
//   - Every change is saved in one IndexedDB transaction (all-or-nothing).
//   - Stock only changes through movements that record why.
//   - Orders keep a snapshot of what was sold, so menu edits never change history.
//   - Profit = gross sales − (capital + expenses).
//
// The code lives in js/store/; this file lists what's public.

// State, persistence, lookups ............................. store/state.js
export {
    S, init, onChange, settings, saveSettings,
    byId, activeEvent, openDay, eventDays, currentContext, realOrders,
    enabledPayments, paymentName, sortedProducts, sortedCategories
} from './store/state.js';

// Recipes, prices and cart lines (pure) ..................... store/recipes.js
export {
    lineRecipe, linePrice, productOptions, addonRecipe,
    contentKey, lineKey, mergeLines, resolveLine,
    cartUsage, orderUsage, cartTotals, unitsAvailable, estUnitCost
} from './store/recipes.js';

// Selling, voids, queue, practice mode ...................... store/sales.js
export {
    checkout, voidOrder, setFulfilment, changePayment, setPractice, clearPractice
} from './store/sales.js';

// Ingredients, stock changes, units ......................... store/stock.js
export {
    saveIngredient, deleteIngredient, ingredientUsedIn,
    adjustStock, restockIngredient, unitFactor, stockSnapshot
} from './store/stock.js';

// Menu: products, categories, add-ons ....................... store/menu.js
export {
    saveProduct, deleteProduct, moveProduct, saveCategory, deleteCategory, saveModifier, deleteModifier
} from './store/menu.js';

// Events, days, cash, expenses ............................. store/events.js
export {
    startEvent, updateEvent, openNewDay, closeDay, reopenDay, endEvent, eventDaysDone,
    expectedCash, saveExpense, deleteExpense, pendingCosts
} from './store/events.js';

// Backup, restore, erase, bulk insert ...................... store/backup.js
export { exportAll, importAll, eraseEverything, bulkInsert } from './store/backup.js';
