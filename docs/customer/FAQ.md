# PopPOS FAQ

## The basics

**What is PopPOS?**
A point-of-sale and inventory app for pop-ups, market stalls, bazaars and small cafés. You take orders, it tracks your ingredients, and it tells you whether the event made money.

**How much does it cost?**
The app has no fees, subscriptions or accounts. It runs in a web browser and can be hosted for free (e.g. on GitHub Pages). You only pay for your own devices and, if you want one, a receipt printer.

**Do I need internet?**
Only the first time, to open and install it. After that it works fully offline, including selling, stock, reports and printing.

**What devices does it work on?**
Phones, tablets, laptops and mini PCs, using Chrome, Edge or Safari. See the [Hardware Guide](HARDWARE_GUIDE.md) for recommendations.

**Is it an official BIR receipt system?**
No. PopPOS is not BIR-accredited, and its receipts say *"This is not an official receipt."* If you need official receipts, use your registered receipts or POS alongside it.

## Selling

**How fast is a sale?**
Exact cash: tap the products, **Charge**, **Complete sale**. That's two taps after adding items.

**A group ordered 5 Americanos and only 3 want syrup.**
Tap the line → **Apply to 3 of 5 cups** → syrup → **Update**. You get *3 × with syrup* and *2 × plain*.

**Everyone in the group wants something different.**
Tap the line → **Split into single cups**, then set each cup. They're grouped again at checkout.

**Someone already paid and now wants an extra shot.**
Tap **+ Add-on** (top of the order), pick their order number and the add-on, then charge it as a small order.

**I rang up the wrong thing.**
Tap **Undo** on the message right after the sale. Later, go to **Orders** → tap the order → **Void**. Stock goes back automatically.

**I picked the wrong payment method.**
Orders → tap the order → **Wrong payment method?** → choose the right one.

**Can I give senior/PWD discounts?**
Yes. **Discount** → *Senior / PWD* (20%). You can add your own presets or type a custom % or amount.

**The app says something is "Out" but I still have some.**
Tap the product (or check the Menu list) to see which ingredient is short, then fix it with Stock → **Count** or **Restock**. A new ingredient created without an amount on hand starts at 0. Selling isn't blocked by default, so you can keep going.

## Stock & costs

**What's the difference between tracked and untracked?**
Tracked ingredients are counted down with each sale. Untracked items (like ice) have no count; you just log what you spend on them.

**I make my own syrup. How do I add it?**
Event → **Restock** → choose the syrup → **Made** → the amount made. Add the ingredients you used (e.g. sugar); they're taken from stock. Next time PopPOS suggests them for you.

**I don't know what something cost yet.**
Tick **I'll add the cost later**. It shows as *Cost pending* and you'll be reminded. You can fill it in even after the event ends.

**I set beans up in kg but my recipes are in grams.**
No problem: in the recipe, pick **g** in the unit picker next to the amount (it starts there anyway). Or change the ingredient itself to g and everything converts automatically (1 kg → 1,000 g), including recipes.

**A product says "Out" right after I made it.**
Check the unit next to each recipe amount. 180 **L** of milk instead of 180 **ml** is more than you have, so the product is Out. The editor shows a warning when this happens.

**How is profit calculated?**
Gross sales − (capital + expenses). Capital is what you bought before the event; expenses are what you bought during it.

## Events & days

**My event is only one day. Why would it ask about Day 2?**
It won't. Set **How many days?** to 1 when starting. After you close that day, PopPOS offers **End event**.

**The event went longer than planned.**
Use **Add a day** after closing the last day, or Event → **Edit** → How many days.

**I closed the day by mistake.**
Event tab → **Reopen day**.

**My cash count is short.**
The close-day screen shows the expected cash: float + cash sales − cash paid out for expenses. Check that expenses paid from the drawer were ticked *Paid from drawer*, and that GCash sales weren't put through as cash.

## Data

**Where is my data stored?**
Only on the device you use, inside the browser. Nothing is sent anywhere. See [Data & Privacy](DATA_AND_PRIVACY.md).

**Can two phones share the same event?**
Not yet. Each event runs on one device. You can move everything to another device with a backup file.

**How do I avoid losing everything?**
Back up after every day (Close day → **Backup**) and keep the file somewhere safe. Install the app rather than using a private window.

**I had the old Booth POS.**
Your data can come along. See the [Migration Guide](../../MIGRATION_GUIDE.md).

## Printing

**Do I need a receipt printer?**
No. Without one, receipts and summaries use your device's normal print dialog, and day summaries print as a full A4/Letter page.

**Which printer should I buy?**
Any ESC/POS thermal printer (58 mm or 80 mm) with USB or Bluetooth. See the [Hardware Guide](HARDWARE_GUIDE.md).

**Can my iPhone print to a thermal printer?**
Not directly. iPhone and iPad browsers can't connect to USB or Bluetooth printers. Use the normal print dialog, or an Android tablet or laptop for the counter.
