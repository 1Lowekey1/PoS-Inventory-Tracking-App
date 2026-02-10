# 🏪 Offline Cashier & Inventory Tracking App

A fully dynamic, offline-first point-of-sale (POS) system designed for food and beverage booths, pop-ups, and event rentals. Works 100% offline with no external dependencies.

## ✨ Features

### 🎯 Core Capabilities
- **100% Offline** - No internet required, all data stored locally
- **Fully Dynamic** - Zero hard-coded menu items or ingredients
- **Mobile-First** - Optimized for touch interactions, responsive for all devices
- **Inventory Tracking** - Real-time stock deduction with low-stock alerts
- **Cost Analysis** - Automatic profit calculation per sale
- **Audit Trail** - Complete transaction history with ingredient snapshots
- **Undo Sales** - Restore last sale with stock recovery
- **Data Export** - Backup data as JSON for safety
- **Event Reset** - Clear sales while keeping products/ingredients

### 📱 Screens

1. **Cashier** - Fast tap-to-sell interface with real-time stats
2. **Products** - Build menu items with dynamic recipes
3. **Inventory** - Manage ingredients with stock alerts
4. **Reports** - Revenue, costs, profit, and sales breakdown

## 🚀 Quick Start

### Installation

1. **Download the files** to a folder on your device:
   - `index.html`
   - `styles.css`
   - `app.js`

2. **Open `index.html`** in any modern web browser:
   - Chrome, Firefox, Safari, Edge (recommended)
   - No server needed - runs directly from file system

3. **Add to home screen** (Mobile):
   - iOS Safari: Share → Add to Home Screen
   - Android Chrome: Menu → Add to Home Screen

### First-Time Setup

#### Step 1: Add Ingredients
1. Tap **Inventory** tab
2. Tap **+ New Ingredient**
3. Fill in:
   - Name (e.g., "Coffee", "Milk", "Cup")
   - Unit (grams/ml/pieces)
   - Cost per unit
   - Current stock
   - Low stock alert threshold

**Example Ingredients:**
```
Coffee
- Unit: grams
- Cost: ₱0.86
- Stock: 500
- Alert: 100

Milk
- Unit: grams
- Cost: ₱0.28
- Stock: 1000
- Alert: 200

Cup (16oz)
- Unit: pcs
- Cost: ₱4.30
- Stock: 50
- Alert: 10

Salted Caramel Syrup
- Unit: ml
- Cost: ₱0.50
- Stock: 300
- Alert: 50
```

#### Step 2: Create Products
1. Tap **Products** tab
2. Tap **+ New Product**
3. Fill in:
   - Product name (e.g., "Iced Latte")
   - Selling price
   - Active status (on/off)
4. Build recipe:
   - Tap **+ Add Ingredient**
   - Select ingredient and quantity
   - Repeat for all ingredients
5. Tap **Save Product**

**Example Product:**
```
Iced Latte
- Price: ₱120.00
- Recipe:
  • Coffee: 18 grams
  • Milk: 25 grams
  • Cup: 1 piece
```

#### Step 3: Start Selling
1. Tap **Cashier** tab
2. Tap product button to record sale
3. System automatically:
   - Deducts ingredient stock
   - Records transaction
   - Updates revenue totals

## 📊 Using the System

### Making Sales

**Normal Sale:**
- Tap any active product button
- Stock deducted automatically
- Toast notification confirms sale

**Out of Stock:**
- Product buttons show "Out of Stock" badge
- Cannot process sale until ingredients restocked
- Red border indicates unavailable

**Undo Last Sale:**
- Tap "↶ Undo Last Sale" button
- Stock restored to previous levels
- Sale removed from history
- Only works for most recent transaction

### Managing Inventory

**Restocking:**
1. Go to Inventory tab
2. Find ingredient
3. Tap **Edit**
4. Update "Current Stock" value
5. Save

**Low Stock Alerts:**
- Yellow badge appears when stock ≤ threshold
- Visual progress bar shows stock level
- Check Reports tab for affected products

**Deleting Ingredients:**
- Cannot delete if used in any product
- System prevents accidental deletion
- Remove from products first

### Product Management

**Editing Products:**
1. Products tab → Tap **Edit**
2. Modify name, price, or recipe
3. Add/remove ingredients as needed
4. Save changes

**Deactivating Products:**
- Uncheck "Active" when editing
- Product hidden from Cashier screen
- Useful for seasonal items

**Cost & Profit Analysis:**
- Each product card shows:
  - Total ingredient cost
  - Profit per sale
  - Profit margin %

### Viewing Reports

**Today's Summary:**
- Total Revenue
- Estimated Cost
- Estimated Profit
- Items Sold

**Sales Breakdown:**
- Revenue per product
- Quantity sold per product
- Sorted by revenue (highest first)

**Recent Transactions:**
- Last 10 sales
- Product name and price
- Date and time

## 💾 Data Management

### Backup (Export)

**How to Backup:**
1. Reports tab → Tap **💾 Backup Data**
2. JSON file downloads automatically
3. Filename: `booth-data-YYYY-MM-DD.json`

**What's Included:**
- All ingredients
- All products
- All sales history
- Export timestamp

**When to Backup:**
- End of each event
- Before resetting data
- Weekly (recommended)

### Restore (Import)

**Manual Restore:**
1. Open browser console (F12)
2. Paste this code:
```javascript
// Load from file input
const input = document.createElement('input');
input.type = 'file';
input.accept = '.json';
input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = event => {
        const data = JSON.parse(event.target.result);
        const dm = new DataManager();
        dm.importData(data);
        location.reload();
    };
    reader.readAsText(file);
};
input.click();
```

### Reset Event

**What It Does:**
- Clears ALL sales data
- Keeps all products
- Keeps all ingredients
- Keeps all stock levels

**When to Use:**
- Starting a new event
- Beginning new day
- After backing up data

**How to Reset:**
1. Reports tab → Tap **🔄 Reset Event**
2. Confirm action
3. Sales cleared, products/inventory intact

### Complete Reset (Nuclear Option)

**Clear Everything:**
1. Open browser console (F12)
2. Run:
```javascript
localStorage.clear();
location.reload();
```

**Warning:** This deletes EVERYTHING. Backup first!

## 🔧 Technical Details

### Technology Stack
- **HTML5** - Structure
- **CSS3** - Mobile-first responsive design
- **Vanilla JavaScript** - Zero dependencies
- **localStorage** - Client-side data persistence

### Data Models

**Ingredient:**
```json
{
  "id": "unique_id",
  "name": "Coffee",
  "unit": "grams",
  "costPerUnit": 0.86,
  "currentStock": 500,
  "lowStockThreshold": 100
}
```

**Product:**
```json
{
  "id": "unique_id",
  "name": "Iced Latte",
  "sellingPrice": 120.00,
  "active": true,
  "recipe": [
    {
      "ingredientId": "ingredient_id",
      "quantity": 18
    }
  ]
}
```

**Sale:**
```json
{
  "id": "unique_id",
  "timestamp": "2026-02-10T10:30:00.000Z",
  "productId": "product_id",
  "productName": "Iced Latte",
  "sellingPrice": 120.00,
  "paymentType": "cash",
  "ingredientSnapshot": [
    {
      "ingredientId": "ingredient_id",
      "ingredientName": "Coffee",
      "quantity": 18,
      "unit": "grams",
      "costPerUnit": 0.86,
      "totalCost": 15.48
    }
  ]
}
```

### Browser Storage

**localStorage Keys:**
- `booth_ingredients` - All ingredients
- `booth_products` - All products
- `booth_sales` - All sales
- `booth_last_sale` - Last sale (for undo)

**Storage Limits:**
- 5-10MB typical (browser dependent)
- ~10,000 transactions before limits

### Browser Compatibility

✅ **Fully Supported:**
- Chrome 90+ (Desktop/Mobile)
- Safari 14+ (iOS/macOS)
- Firefox 88+
- Edge 90+

⚠️ **Partial Support:**
- Older browsers may lack localStorage
- IE11 not recommended

## 🎯 Use Cases

### Coffee Booth
- Products: Americano, Latte, Cappuccino
- Ingredients: Coffee, Milk, Water, Cups, Lids
- Track milk/coffee usage per day

### Milk Tea Stall
- Products: Classic, Matcha, Wintermelon
- Ingredients: Tea, Milk, Syrups, Pearls, Cups
- Multiple syrup flavors as ingredients

### Food Pop-Up
- Products: Burger, Fries, Drinks
- Ingredients: Buns, Patties, Potatoes, Cups
- Recipe variants (regular/large)

### Event Rental
- Share device with booth operator
- Export data at end of shift
- Reset for next renter

## 🐛 Troubleshooting

### Sales Not Recording
- Check ingredient stock levels
- Verify product is active
- Check browser console for errors

### Data Not Saving
- Check localStorage enabled
- Clear browser cache
- Try different browser

### Products Not Showing
- Ensure products marked as "Active"
- Check if ingredients available
- Refresh page

### Performance Issues
- Export old data
- Reset event after backup
- Clear browser cache

## 🔒 Privacy & Security

- **100% Local** - No data leaves your device
- **No Cloud** - No servers, no accounts
- **No Tracking** - Zero analytics
- **Offline** - Works without internet

**Data Location:**
- Stored in browser's localStorage
- Tied to browser and device
- Cleared if browser data cleared

## 📝 Best Practices

### Daily Operations
1. Start with inventory check
2. Restock low items
3. Activate/deactivate products as needed
4. Process sales throughout day
5. Export data at end of shift

### Weekly Maintenance
1. Backup data (export JSON)
2. Review sales reports
3. Update product prices if needed
4. Adjust stock thresholds

### Event Preparation
1. Full inventory restock
2. Test all products can be sold
3. Backup current data
4. Reset event if starting fresh

## 🤝 Support

### Community
- GitHub Issues (if published)
- Local customization welcome

### Self-Service
- All code fully commented
- Modify as needed
- No license restrictions

## 📄 License

**Public Domain / MIT-style**

Feel free to:
- Use commercially
- Modify freely
- Redistribute
- Rebrand

No attribution required (but appreciated!)

---

## 🚀 Quick Reference Card

### Keyboard Shortcuts
- None (touch-optimized)

### Common Tasks

**Add Product:**
Products → + New Product → Fill form → Add ingredients → Save

**Restock:**
Inventory → Edit ingredient → Update stock → Save

**View Profit:**
Reports → See breakdown and profit margins

**Backup:**
Reports → 💾 Backup Data → File downloads

**Undo Sale:**
Cashier → ↶ Undo Last Sale → Confirm

---

**Version:** 1.0  
**Last Updated:** February 2026  
**Designed for:** Food & beverage booths, pop-ups, events
