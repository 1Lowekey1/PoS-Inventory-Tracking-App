# What's new in PopPOS

To update, open PopPOS while online. When it says **"A new version is ready"**, tap **Update**. Your data stays as it is.

---

## 3.2.2: clearer "Out"

- When a product shows **Out**, PopPOS now tells you which ingredient is short: tap the product, or check the Menu list ("Out: Caramel syrup at 0 ml").
- Creating an ingredient without an amount on hand now asks before saving it as 0, so new products don't show Out by surprise.

---

## 3.2.1: behind-the-scenes tidy-up

Nothing changes in how you use PopPOS. Small fixes:
- **Erase everything** also clears the order you were building.
- The past-events table counts items the same way as the reports (add-ons sold on their own aren't extra items).
- The sales CSV lists optional extras such as syrup, and the expenses CSV shows which costs are still pending.

---

## 3.2: group orders

**Different cups in one order, without the fuss.**
- Tap any line with several cups and choose **Apply to 3 of 5 cups**. Those cups get the extras or add-ons you pick and the rest stay as they were.
- For very mixed orders, **Split into single cups** gives every cup its own line. Identical cups are grouped back together when you charge, so the receipt stays short.

---

## 3.1: built from real counter testing

**Selling**
- **Optional extras:** mark a recipe ingredient as *Optional* (like syrup in an Iced Americano). It shows as a one-tap chip on each order line, free of charge.
- **Add-ons after paying:** a customer who already paid can add an extra shot. It's linked to their order number.

**Stock**
- **Restock during an event** now lives in **Event → Restock**: *Bought* (cost becomes an expense) or *Made* (homemade syrup uses up the sugar you list, and the recipe is remembered).
- **"I'll add the cost later"** for when you don't have the receipt yet, with reminders until it's filled in, even after the event.
- **Changing units** (g ↔ kg, ml ↔ L) now converts everything, including recipes.

**Events**
- **How many days?** when starting an event. One-day events finish cleanly with **End event**, without being asked about "Day 2".
- **Day summary prints as a full page** on any printer.
- The **Start event** form remembers what you typed if it closes by accident.

**Practice mode**
- Practice sales now show their effect on stock, and everything is put back when you turn practice off.

---

## 3.0: the new PopPOS

A complete rebuild of Booth POS:
- **Orders with many items**, add-ons, discounts (Senior/PWD), notes and a *To make* queue
- **Cash, GCash, Maya, card**, with a change calculator
- **Multi-day events** with cash float, cash count and over/short
- **Capital + expenses** profit model, with break-even tracking
- **Reports** for any event or day: busiest hours, best sellers, payments, ingredient usage, CSV
- **Works offline** as an installed app; one-tap **backup and restore**
- **Receipt printer and cash drawer** support
- **Import** from the old Booth POS
