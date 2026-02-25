# 🔄 Migration Guide: v1.x to v2.0

Version 2.0 introduces a fundamental change in how costs and profits are calculated to make the system more intuitive for booth operators.

## ⚠️ What has changed?

### 1. Costing Model
- **Old (v1.x)**: Per-unit costing. You entered batch costs and quantities for every ingredient, and the system calculated a "per-cup" cost.
- **New (v2.0)**: **Fixed Event Cost**. You enter the total amount spent on ALL ingredients at the start of an event. Profit is simply `Revenue - Fixed Cost`.

### 2. Event Sessions
- Sales are now grouped into **Events**. You must start an event to record real sales.

### 3. Inventory Management
- Inventory is now focused on **Operational Quantities** (how much do I have left?) rather than accounting costs.

---

## 🛠 How to Migrate

### Option 1: The Fresh Start (Highly Recommended)
Because the data models have changed significantly, a fresh start is the cleanest way to move to v2.0.

1. **Backup your old data**: Go to Reports and tap **Backup Data** in your old version.
2. **Clear Storage**: Open the browser console (F12) and run `localStorage.clear(); location.reload();`.
3. **Re-enter Ingredients**: Add your ingredients with just their current quantities. You no longer need to enter batch costs here.
4. **Re-enter Products**: Recreate your products and recipes.
5. **Start an Event**: When you start your first event in v2.0, enter your total supply cost in the **Fixed Event Cost** field.

### Option 2: Manual Data Update
If you want to keep your current product and ingredient lists:

1. **Update Ingredients**:
   - The system will ignore the old `totalCost` and `costPerUnit` fields.
   - Simply verify that your `totalQuantity` for each ingredient is correct.
2. **Update Products**:
   - Your recipes will still work.
   - Products no longer show "Profit per sale" because profit is now calculated at the Event level.
3. **Start a New Event**:
   - Past sales from v1.x will not be linked to new v2.0 events. It is best to export your v1.x reports before starting your first v2.0 event.

---

## ❓ FAQ

**Q: Where did my "Profit per Drink" go?**
A: In a real-world booth, your profit isn't realized per drink—it's realized once you've covered your initial sunk costs. v2.0 tracks your progress toward breaking even for the entire event.

**Q: Do I still need to enter how much a bottle of syrup costs?**
A: Not in the Ingredient screen. Instead, sum up the cost of all your supplies and enter that total when you tap "Start Event".

**Q: Can I still see how many items I sold?**
A: Yes! The Reports tab provides a full breakdown of quantities sold per product.

**Q: What happens to my old sales?**
A: Old sales will still exist in your browser storage but won't be formatted correctly for the new v2.0 Reports. We recommend clearing your sales history and starting fresh with an Event.

---

**Need help?** All v2.0 code is modular and commented in the `js/` directory!
