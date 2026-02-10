# 🔄 Migration Guide: Old to New Costing Model

## What Changed?

The app now uses a **batch purchase model** to fix a critical costing bug where drinks showed incorrect costs (e.g., ₱780 instead of ₱15.60).

### Old Model (BROKEN)
```
Ingredient stored: costPerUnit = ₱0.50
Problem: If you bought in bulk, you had to manually calculate per-unit cost
```

### New Model (FIXED)
```
Ingredient stores: 
- Batch Cost = ₱780 (what you paid)
- Batch Quantity = 1000ml (what you bought)
System computes: ₱0.78/ml automatically
```

## Do You Need to Migrate?

**If you're a NEW user:** No action needed! Just start using the app.

**If you have EXISTING data:** You need to update your ingredients to the new format.

## Migration Steps

### Option 1: Fresh Start (Recommended for Small Datasets)

1. **Backup your old data:**
   - Reports → 💾 Backup Data
   - Save the JSON file somewhere safe

2. **Clear browser data:**
   - Open browser console (F12)
   - Run: `localStorage.clear(); location.reload();`

3. **Re-enter ingredients with batch data:**
   - Instead of "Cost per unit: ₱0.78"
   - Enter "Batch cost: ₱780, Batch quantity: 1000ml"

4. **Recreate products:**
   - Same recipes, but products will now show correct costs

### Option 2: Automatic Migration (For Existing Data)

If you have lots of ingredients and products, use this automatic migration script:

1. **Export your current data first:**
   - Reports → 💾 Backup Data

2. **Open browser console** (F12)

3. **Paste this migration script:**

```javascript
// MIGRATION SCRIPT: Convert old model to new batch model
(function migrateToBatchModel() {
    console.log('Starting migration to batch purchase model...');
    
    // Get old ingredients
    const oldIngredients = JSON.parse(localStorage.getItem('booth_ingredients') || '[]');
    
    if (oldIngredients.length === 0) {
        console.log('No ingredients to migrate.');
        return;
    }
    
    // Ask user for default batch quantity
    const defaultBatchQty = prompt(
        'Migration: Enter default batch quantity for conversion\n\n' +
        'For example:\n' +
        '- If you typically buy 1000ml bottles, enter: 1000\n' +
        '- If you buy 500g bags, enter: 500\n\n' +
        'Enter default batch size:',
        '1000'
    );
    
    if (!defaultBatchQty) {
        console.log('Migration cancelled.');
        return;
    }
    
    const batchQty = parseFloat(defaultBatchQty);
    
    // Convert each ingredient
    const newIngredients = oldIngredients.map(ing => {
        // If already migrated (has totalCost), skip
        if (ing.totalCost !== undefined) {
            console.log(`✓ ${ing.name} already migrated`);
            return ing;
        }
        
        // Convert old model to new
        const totalQuantity = ing.currentStock || batchQty;
        const totalCost = (ing.costPerUnit || 0) * totalQuantity;
        
        console.log(`Converting ${ing.name}:`);
        console.log(`  Old: ${ing.costPerUnit}/unit, stock: ${ing.currentStock}`);
        console.log(`  New: ₱${totalCost} for ${totalQuantity}${ing.unit}`);
        
        return {
            id: ing.id,
            name: ing.name,
            unit: ing.unit,
            totalCost: totalCost,
            totalQuantity: totalQuantity,
            lowStockThreshold: ing.lowStockThreshold
        };
    });
    
    // Save migrated data
    localStorage.setItem('booth_ingredients', JSON.stringify(newIngredients));
    
    console.log('✓ Migration complete!');
    console.log('Please review your ingredients and adjust batch costs as needed.');
    console.log('Reloading page...');
    
    setTimeout(() => location.reload(), 2000);
})();
```

4. **Press Enter** to run the script

5. **Review all ingredients:**
   - Go to Inventory tab
   - Check that batch costs make sense
   - Edit any that need adjustment

### Option 3: Manual Update (Precise Control)

For each ingredient:

1. **Go to Inventory tab**
2. **Tap Edit on the ingredient**
3. **Convert your data:**
   
   **Example 1: You know the exact batch purchase**
   ```
   Old: Cost per unit = ₱0.78
   
   New:
   Batch Cost = ₱780 (what you paid for the bottle)
   Batch Quantity = 1000 ml (size of bottle)
   ```
   
   **Example 2: You only know per-unit cost**
   ```
   Old: Cost per unit = ₱0.86
   
   New (estimate):
   Batch Cost = ₱430 (₱0.86 × 500)
   Batch Quantity = 500 g (typical bag size)
   ```

4. **Tap Save**

5. **Repeat for all ingredients**

## Verification

After migration, verify costs are correct:

1. **Go to Products tab**
2. **Check each product's cost**
3. **Look for warnings:**
   - ⚠️ "Pricing Mismatch" = cost exceeds selling price
   - This means you need to adjust either the recipe or the price

### Expected Costs

**Example: Iced Caramel Latte**
```
Recipe:
- Syrup: 20ml
- Coffee: 18g
- Milk: 150ml
- Cup: 1pc

Cost Breakdown:
- Syrup: ₱0.78/ml × 20ml = ₱15.60 ✓
- Coffee: ₱0.86/g × 18g = ₱15.48 ✓
- Milk: ₱0.28/ml × 150ml = ₱42.00 ✓
- Cup: ₱4.30/pc × 1pc = ₱4.30 ✓

Total: ₱77.38 ✓
Selling Price: ₱120.00
Profit: ₱42.62 (35.5%)
```

**Red Flags (MUST FIX):**
```
❌ Cost: ₱780.00 (entire batch assigned to one drink!)
❌ Cost: ₱214.00 (partial batch incorrectly assigned)
❌ Cost > Selling Price (losing money per sale)
```

## Common Issues

### Issue: "All my costs are showing as ₱0.00"

**Cause:** Batch quantity is zero or not set

**Fix:** 
1. Edit ingredient
2. Set Batch Quantity > 0
3. Save

### Issue: "Cost looks too high"

**Cause:** Batch cost might be wrong or batch quantity too small

**Fix:**
1. Edit ingredient
2. Verify batch cost and quantity
3. Example: If you paid ₱780 for 1L (1000ml), not 1ml
4. Save

### Issue: "Migration script not working"

**Fix:**
1. Make sure you copied the entire script
2. Check browser console for errors
3. If errors persist, use Manual Update option instead

## FAQ

**Q: Do I need to update my products?**  
A: No, products automatically recalculate costs using the new ingredient data.

**Q: Will my sales history be affected?**  
A: No, past sales are preserved in their snapshot form.

**Q: Can I undo the migration?**  
A: Yes, restore from the backup JSON you created in step 1.

**Q: What if I don't know my batch purchase costs?**  
A: Estimate based on typical purchase sizes:
- Syrups: Usually 1L (1000ml) bottles
- Coffee: Usually 250g or 500g bags
- Milk: Usually 1L (1000ml) cartons

**Q: How do I restore from backup?**  
A: See README.md "Restore (Import)" section

## Support

If you encounter issues:

1. **Check the backup** - Make sure it's saved
2. **Try Manual Update** - Slower but more reliable
3. **Fresh Start** - If you have very few items
4. **Document what went wrong** - Save error messages

---

**After migration, your costs will be mathematically correct and scale properly with batch size changes!** 🎯
