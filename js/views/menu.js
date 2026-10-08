// Menu screen: products (with recipes), categories, add-ons (modifiers).

import * as store from '../store.js';
import { S, byId } from '../store.js';
import { esc, money, num, qtyFmt } from '../util.js';
import { icon, toast, formModal, confirmDialog, val, checked } from '../ui.js';
import { ingredientDialog } from './stock.js';

export const SWATCHES = ['', '#8b5e3c', '#c2410c', '#b45309', '#4d7c0f', '#0f766e', '#1d4ed8', '#7c3aed', '#be185d'];
let tab = 'products';

export function render(el) {
    el.innerHTML = `<div class="page">
        <header class="page-head"><h1>Menu</h1>
            <div class="seg seg-sm">
                <button class="seg-btn ${tab === 'products' ? 'on' : ''}" data-tab="products">Products</button>
                <button class="seg-btn ${tab === 'categories' ? 'on' : ''}" data-tab="categories">Categories</button>
                <button class="seg-btn ${tab === 'modifiers' ? 'on' : ''}" data-tab="modifiers">Add-ons</button>
            </div></header>
        ${tab === 'products' ? productsHTML() : tab === 'categories' ? categoriesHTML() : modifiersHTML()}
    </div>`;
    if (!el.dataset.wired) {
        el.dataset.wired = '1';
        el.addEventListener('click', async (e) => {
            const t = e.target.closest('[data-tab], [data-act]');
            if (!t) return;
            if (t.dataset.tab) { tab = t.dataset.tab; render(el); return; }
            const id = t.dataset.id;
            switch (t.dataset.act) {
                case 'new-product': productDialog(); break;
                case 'edit-product': productDialog(byId('products', id)); break;
                case 'up': store.moveProduct(id, -1); break;
                case 'down': store.moveProduct(id, 1); break;
                case 'toggle': { const p = byId('products', id); store.saveProduct({ ...p, active: p.active === false }); break; }
                case 'new-cat': categoryDialog(); break;
                case 'edit-cat': categoryDialog(byId('categories', id)); break;
                case 'new-mod': modifierDialog(); break;
                case 'edit-mod': modifierDialog(byId('modifiers', id)); break;
            }
        });
    }
}

const recipeText = (recipe) => (recipe || []).map((r) => {
    const ing = byId('ingredients', r.ingredientId);
    return ing ? `${qtyFmt(r.qty)}${ing.unit} ${ing.name}${r.optional ? ' (optional)' : ''}` : '';
}).filter(Boolean).join(' · ');

function productsHTML() {
    const products = store.sortedProducts();
    if (!products.length) {
        return `<div class="card"><h2>No products yet</h2><p class="muted">A product is what you sell (e.g. Iced Latte). Its recipe says which ingredients each one uses, so stock goes down automatically.</p>
            <button class="btn btn-primary" data-act="new-product">${icon('plus')} Add product</button></div>`;
    }
    return `<div class="toolbar"><span class="muted grow">${products.length} products · order here = order on the Sell screen</span>
        <button class="btn btn-primary" data-act="new-product">${icon('plus')} Product</button></div>
        <ul class="list menu-list">${products.map((p, i) => {
            const cat = p.categoryId && byId('categories', p.categoryId);
            const cost = store.estUnitCost(p.recipe || []);
            const avail = store.unitsAvailable(p);
            return `<li class="list-item ${p.active === false ? 'inactive' : ''}">
                <span class="swatch" style="--sw:${p.color || cat?.color || 'var(--line)'}"></span>
                <button class="grow menu-main" data-act="edit-product" data-id="${p.id}">
                    <b>${esc(p.name)}</b> <span class="muted">${money(p.price)}</span>
                    <small class="muted">${cat ? `${esc(cat.name)} · ` : ''}${esc(recipeText(p.recipe)) || 'No recipe'}</small>
                    <small class="muted">${cost !== null ? `Est. cost ${money(cost)} · margin ${p.price ? Math.round(((p.price - cost) / p.price) * 100) : 0}%` : ''}${Number.isFinite(avail) ? `${cost !== null ? ' · ' : ''}${avail > 0 ? `can make ${avail} more` : `<span class="neg">Out: ${esc(store.missingIngredients(p).map((m) => `${m.name} at ${qtyFmt(m.left)} ${m.unit}`).join(', '))}</span>`}` : ''}</small>
                </button>
                <label class="switch" title="Show on Sell screen"><input type="checkbox" data-act="toggle" data-id="${p.id}" ${p.active === false ? '' : 'checked'}><span></span></label>
                <div class="updown">
                    <button class="icon-btn" data-act="up" data-id="${p.id}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('up')}</button>
                    <button class="icon-btn" data-act="down" data-id="${p.id}" ${i === products.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('down')}</button>
                </div></li>`;
        }).join('')}</ul>`;
}

function categoriesHTML() {
    const cats = store.sortedCategories();
    return `<div class="toolbar"><span class="muted grow">Categories become tabs on the Sell screen.</span>
        <button class="btn btn-primary" data-act="new-cat">${icon('plus')} Category</button></div>
        ${cats.length ? `<ul class="list">${cats.map((c) => `<li class="list-item clickable" data-act="edit-cat" data-id="${c.id}">
            <span class="swatch" style="--sw:${c.color || 'var(--line)'}"></span><b class="grow">${esc(c.name)}</b>
            <span class="muted">${S.products.filter((p) => p.categoryId === c.id).length} products</span></li>`).join('')}</ul>`
            : '<p class="muted pad">No categories. Optional, but handy once you have more than ~8 products.</p>'}`;
}

function modifiersHTML() {
    return `<div class="toolbar"><span class="muted grow">Add-ons change price and/or ingredients: extra shot, oat milk, large size.</span>
        <button class="btn btn-primary" data-act="new-mod">${icon('plus')} Add-on</button></div>
        ${S.modifiers.length ? `<ul class="list">${S.modifiers.map((m) => `<li class="list-item clickable" data-act="edit-mod" data-id="${m.id}">
            <div class="grow"><b>${esc(m.name)}</b> <span class="muted">${m.priceDelta ? money(m.priceDelta, { sign: true }) : 'free'}</span>
            <small class="muted">${esc(recipeText(m.recipe)) || 'No ingredient change'}</small></div></li>`).join('')}</ul>`
            : '<p class="muted pad">No add-ons yet.</p>'}`;
}

// ---------- recipe editor (shared by products and add-ons) ----------

const NEW_ING = '__new__';

const ingSelect = (selected) => {
    const ings = [...S.ingredients].sort((a, b) => a.name.localeCompare(b.name));
    return `<select data-ing aria-label="Ingredient"><option value="">Ingredient…</option>${ings.map((i) =>
        `<option value="${i.id}" ${i.id === selected ? 'selected' : ''}>${esc(i.name)}${i.tracked ? '' : ' (untracked)'}</option>`).join('')}
        <option value="${NEW_ING}">＋ New ingredient…</option></select>`;
};

/** withOptional: products can mark a row optional (free per-order choice, e.g. sweetener). */
function recipeRow(r = {}, { allowNegative = false, withOptional = false } = {}) {
    return `<div class="recipe-row ${withOptional ? 'has-opt' : ''}">
        ${ingSelect(r.ingredientId)}
        <input type="number" data-qty inputmode="decimal" step="any" ${allowNegative ? '' : 'min="0"'} value="${r.qty ?? ''}" placeholder="qty" aria-label="Amount per item">
        <span class="unit" data-unit>${esc(byId('ingredients', r.ingredientId)?.unit || '')}</span>
        ${withOptional ? `<label class="opt-toggle" title="Optional: only used when the customer asks for it (tap it on the order)">
            <input type="checkbox" data-optional ${r.optional ? 'checked' : ''}><span>Optional</span></label>` : ''}
        <button type="button" class="icon-btn" data-rmrow aria-label="Remove">${icon('x')}</button></div>`;
}

function wireRecipe(m, rowOpts, onChange = () => {}) {
    const box = m.querySelector('[data-recipe]');
    m.addEventListener('click', (e) => {
        if (e.target.closest('[data-addrow]')) { box.insertAdjacentHTML('beforeend', recipeRow({}, rowOpts)); onChange(); }
        if (e.target.closest('[data-rmrow]')) { e.target.closest('.recipe-row').remove(); onChange(); }
    });
    box.addEventListener('change', async (e) => {
        if (e.target.matches('[data-ing]')) {
            const sel = e.target;
            if (sel.value === NEW_ING) {
                // Create an ingredient without leaving the product, then pick it in this row.
                sel.value = '';
                const created = await ingredientDialog().result;
                if (created) {
                    const newest = [...S.ingredients].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                    box.querySelectorAll('[data-ing]').forEach((other) => {
                        const v = other === sel ? newest.id : other.value;
                        other.outerHTML = ingSelect(v);
                    });
                }
            }
            box.querySelectorAll('.recipe-row').forEach((row) => {
                row.querySelector('[data-unit]').textContent = byId('ingredients', row.querySelector('[data-ing]').value)?.unit || '';
            });
        }
        onChange();
    });
    box.addEventListener('input', onChange);
}

function readRecipe(m) {
    const out = [];
    const seen = new Set();
    m.querySelectorAll('.recipe-row').forEach((row) => {
        const ingredientId = row.querySelector('[data-ing]').value;
        const qty = num(row.querySelector('[data-qty]').value);
        if (!ingredientId || ingredientId === NEW_ING || !qty) return;
        if (seen.has(ingredientId)) throw new Error(`${byId('ingredients', ingredientId).name} is listed twice.`);
        seen.add(ingredientId);
        const optional = !!row.querySelector('[data-optional]')?.checked;
        out.push(optional ? { ingredientId, qty, optional: true } : { ingredientId, qty });
    });
    return out;
}

const swatchPicker = (current) => `<div class="swatches">${SWATCHES.map((c) =>
    `<button type="button" class="sw ${c === (current || '') ? 'on' : ''}" data-color="${c}" style="--sw:${c || 'transparent'}" aria-label="${c || 'No colour'}">${c ? '' : icon('x')}</button>`).join('')}</div>
    <input type="hidden" name="color" value="${current || ''}">`;

function wireSwatches(m) {
    m.addEventListener('click', (e) => {
        const b = e.target.closest('[data-color]');
        if (!b) return;
        m.querySelector('[name=color]').value = b.dataset.color;
        m.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x === b));
    });
}

// ---------- dialogs ----------

/** Product editor fields: name, price, category, colour, recipe rows (with Optional), add-ons offered. */
function productFormHTML(p, cats) {
    return `
            <div class="row2">
                <label class="field"><span>Name *</span><input name="name" value="${esc(p?.name || '')}" placeholder="e.g. Iced Latte" required></label>
                <label class="field"><span>Price *</span><input type="number" name="price" inputmode="decimal" min="0" step="any" value="${p?.price ?? ''}" required></label>
            </div>
            <div class="row2">
                <label class="field"><span>Category</span><select name="categoryId"><option value="">None</option>${cats.map((c) => `<option value="${c.id}" ${c.id === p?.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
                <label class="check"><input type="checkbox" name="active" ${p?.active === false ? '' : 'checked'}> Show on Sell screen</label>
            </div>
            <div class="field"><span>Tile colour</span>${swatchPicker(p?.color)}</div>
            <fieldset class="field"><legend>Recipe <small>(per 1 item)</small></legend>
                <div data-recipe>${(p?.recipe?.length ? p.recipe : [{}]).map((r) => recipeRow(r, { withOptional: true })).join('')}</div>
                <div class="row-between">
                    <button type="button" class="btn btn-ghost btn-sm" data-addrow>${icon('plus')} Add another ingredient</button>
                    <span class="muted small" data-cost></span>
                </div>
                <small class="muted">Not in the list? Pick <b>＋ New ingredient…</b> at the bottom of the dropdown.
                    Tick <b>Optional</b> for free extras some customers want (e.g. sweetener). It's left out unless you tap it on the order.</small>
            </fieldset>
            ${S.modifiers.length ? `<div class="field"><span>Add-ons offered</span><div class="chips wrap">${S.modifiers.map((md) =>
                `<label class="chip-check"><input type="checkbox" name="mods" value="${md.id}" ${p?.modifierIds?.includes(md.id) ? 'checked' : ''}><span>${esc(md.name)}</span></label>`).join('')}</div></div>` : ''}`;
}

function productDialog(p = null) {
    const cats = store.sortedCategories();
    const ctl = formModal({
        title: p ? `Edit ${p.name}` : 'New product', size: 'l', submitLabel: p ? 'Save' : 'Add product',
        extraFooter: p ? `<button type="button" class="btn btn-danger-ghost" data-del>${icon('trash')} Delete</button>
            <button type="button" class="btn btn-ghost" data-dup>${icon('copy')} Duplicate</button>` : '',
        fields: productFormHTML(p, cats),
        onMount(m) {
            const form = m.querySelector('form');
            const upd = () => {
                let recipe = [];
                try { recipe = readRecipe(m); } catch { /* duplicate row; shown on save */ }
                const cost = store.estUnitCost(recipe);
                const price = num(form.elements.price.value);
                m.querySelector('[data-cost]').textContent = cost !== null && recipe.length
                    ? `Est. cost ${money(cost)}${price ? ` · margin ${Math.round(((price - cost) / price) * 100)}%` : ''}` : '';
            };
            wireRecipe(m, { withOptional: true }, upd);
            wireSwatches(m);
            form.addEventListener('input', upd);
            m.addEventListener('click', async (e) => {
                if (e.target.closest('[data-dup]')) {
                    await store.saveProduct({ ...p, id: undefined, createdAt: undefined, sort: undefined, name: `${p.name} (copy)` });
                    ctl.close();
                    toast('Duplicated. Edit the copy to change size or price.');
                }
                if (e.target.closest('[data-del]') && await confirmDialog('Delete product?', `"${p.name}" will be removed from the menu. Past sales keep their records.`, { danger: true, okLabel: 'Delete' })) {
                    await store.deleteProduct(p.id);
                    ctl.close();
                }
            });
            upd();
        },
        async onSubmit(form, c) {
            const name = val(form, 'name');
            const price = num(val(form, 'price'), NaN);
            if (!name) throw new Error('Name is required.');
            if (!(price >= 0)) throw new Error('Enter a price.');
            const recipe = readRecipe(c.el);
            await store.saveProduct({
                ...p, name, price, recipe, categoryId: val(form, 'categoryId') || null, color: val(form, 'color'),
                active: checked(form, 'active'), modifierIds: [...form.querySelectorAll('[name=mods]:checked')].map((x) => x.value)
            });
            if (!recipe.length) toast('Saved without a recipe, so no stock will be deducted for it.', { type: 'warn' });
            else toast(p ? 'Saved' : `Added ${name}`, { type: 'success' });
        }
    });
}

function categoryDialog(c = null) {
    const ctl = formModal({
        title: c ? 'Edit category' : 'New category', size: 's',
        extraFooter: c ? `<button type="button" class="btn btn-danger-ghost" data-del>${icon('trash')} Delete</button>` : '',
        fields: `<label class="field"><span>Name</span><input name="name" value="${esc(c?.name || '')}" placeholder="e.g. Coffee, Non-coffee, Pastries" required></label>
            <div class="field"><span>Colour</span>${swatchPicker(c?.color)}</div>`,
        onMount(m) {
            wireSwatches(m);
            m.addEventListener('click', async (e) => {
                if (e.target.closest('[data-del]') && await confirmDialog('Delete category?', 'Its products stay on the menu without a category.', { danger: true, okLabel: 'Delete' })) {
                    await store.deleteCategory(c.id);
                    ctl.close();
                }
            });
        },
        async onSubmit(form) {
            const name = val(form, 'name');
            if (!name) throw new Error('Name is required.');
            await store.saveCategory({ ...c, name, color: val(form, 'color') });
        }
    });
}

function modifierDialog(md = null) {
    const ctl = formModal({
        title: md ? 'Edit add-on' : 'New add-on',
        extraFooter: md ? `<button type="button" class="btn btn-danger-ghost" data-del>${icon('trash')} Delete</button>` : '',
        fields: `
            <div class="row2">
                <label class="field"><span>Name</span><input name="name" value="${esc(md?.name || '')}" placeholder="e.g. Extra shot, Oat milk" required></label>
                <label class="field"><span>Price change</span><input type="number" name="priceDelta" inputmode="decimal" step="any" value="${md?.priceDelta ?? 0}"></label>
            </div>
            <fieldset class="field"><legend>Ingredient change <small>(per item)</small></legend>
                <p class="muted small">Use negative amounts to swap: Oat milk = <b>−200 ml</b> fresh milk, <b>+200 ml</b> oat milk.</p>
                <div data-recipe>${(md?.recipe?.length ? md.recipe : [{}]).map((r) => recipeRow(r, { allowNegative: true })).join('')}</div>
                <button type="button" class="btn btn-ghost btn-sm" data-addrow>${icon('plus')} Ingredient</button>
            </fieldset>`,
        onMount(m) {
            wireRecipe(m, { allowNegative: true });
            m.addEventListener('click', async (e) => {
                if (e.target.closest('[data-del]') && await confirmDialog('Delete add-on?', `"${md.name}" will be removed from all products.`, { danger: true, okLabel: 'Delete' })) {
                    await store.deleteModifier(md.id);
                    ctl.close();
                }
            });
        },
        async onSubmit(form, c) {
            const name = val(form, 'name');
            if (!name) throw new Error('Name is required.');
            await store.saveModifier({ ...md, name, priceDelta: num(val(form, 'priceDelta')), recipe: readRecipe(c.el) });
        }
    });
}
