# 🏪 Booth POS v2.0

A fully dynamic, offline-first point-of-sale (POS) system designed for food and beverage booths, pop-ups, and event rentals. Works 100% offline with no external dependencies.

## 🚀 What's New in v2.0

Version 2.0 introduces a simplified **Fixed Event Cost** accounting model and several major features:
- **Event Sessions** - Group your sales by specific events (e.g., "Weekend Market").
- **Fixed Cost Accounting** - Simplified profit tracking (Profit = Revenue - Total Event Cost).
- **Demo Mode** - Test your setup and train staff without affecting real inventory.
- **Batch Sales** - Sell multiple quantities of the same item in one tap.
- **Theme Support** - Choose between Light, Dark, or System (Auto) modes.
- **Improved Inventory Tracking** - Track stock changes and get low-stock alerts.

## ✨ Features

### 🎯 Core Capabilities
- **100% Offline** - No internet required, all data stored locally in your browser.
- **Fully Dynamic** - Build your own menu and ingredient list from scratch.
- **Mobile-First** - Optimized for touch interactions and responsive on all devices.
- **Event-Based Tracking** - Start and end events to keep your sales history organized.
- **Audit Trail** - Complete transaction history for every event.
- **Data Export** - Backup your entire database as a JSON file.

### 📱 Screens

1. **Cashier** - The main selling interface. Requires an active event to record real sales.
2. **Products** - Create your menu items and define their recipes.
3. **Inventory** - Manage your raw materials and monitor stock levels.
4. **Reports** - View financial summaries, sales breakdowns, and transaction history.
5. **Settings** - Configure theme preferences and toggle Demo Mode.

## 🚀 Quick Start

### Installation

1. **Download the project folder** to your device. Ensure you have the following structure:
   - `index.html`
   - `styles.css`
   - `js/data-manager.js`
   - `js/business-logic.js`
   - `js/ui-manager.js`
   - `js/main.js`

2. **Open `index.html`** in any modern web browser (Chrome, Safari, Edge, or Firefox).
   - No server needed - runs directly from the file system.

### First-Time Setup

#### Step 1: Add Ingredients
1. Go to the **Inventory** tab.
2. Tap **+ New Ingredient**.
3. Enter the name, unit (grams, ml, or pcs), and starting quantity you have for the event.
4. Set a **Low Stock Alert** threshold if you want to be notified when items run low.

#### Step 2: Create Products
1. Go to the **Products** tab.
2. Tap **+ New Product**.
3. Enter the name and selling price.
4. **Build the Recipe**: Add ingredients and specify the quantity used for one serving of this product.
5. Tap **Save Product**.

#### Step 3: Start an Event
1. On the **Cashier** or **Reports** screen, tap **Start Event**.
2. Enter an **Event Name** (e.g., "Food Expo 2026").
3. Enter the **Fixed Event Cost** - this is the total amount you spent on ALL ingredients for this event.
4. (Optional) Enter a **Planned Output** to see a break-even estimate.
5. Tap **Start Event**.

#### Step 4: Start Selling
1. Go to the **Cashier** tab.
2. Tap a product button to open the **Batch Sale** modal.
3. Enter the quantity and tap **Confirm Sale**.
4. The system will automatically deduct ingredients from your inventory.

## 📊 Accounting Logic (v2.0)

Version 2.0 uses a **Fixed Event Cost** model, which is much simpler and more accurate for booth operations:

### The Formula
> **Net Profit/Loss = Total Revenue - Fixed Event Cost**

- **Total Revenue**: The sum of all sales made during the event.
- **Fixed Event Cost**: The total "sunk cost" you paid upfront for your supplies.

**Why this model?**
In pop-up booths, you usually buy your ingredients in bulk beforehand. Whether you sell 10 cups or 100, your upfront cost remains the same. This model tracks your actual "take-home" profit after covering your initial investment.

## 💾 Data Management

### Backup & Restore
- **Backup**: Go to **Reports** and tap **💾 Backup Data**. This downloads a JSON file containing all your products, ingredients, and sales history.
- **Restore**: You can import your data by using the `DataManager.importData()` method in the browser console, or by restoring from a previous session (all data persists automatically in your browser's `localStorage`).

### Reset Options
- **Reset Event**: Clears current sales but keeps your products and inventory.
- **End Event**: Finalizes the current session and moves the results to history.

## 🔧 Technical Details
- **Tech Stack**: Vanilla JavaScript (ES6+), CSS3, HTML5.
- **Storage**: Uses `localStorage` (approx. 5-10MB limit per browser).
- **Compatibility**: Works on all modern browsers. No internet required.

## 📄 License
MIT / Public Domain. Feel free to use, modify, and distribute.
