// Menu: products, categories and add-ons (modifiers).
// Past orders keep their own snapshots, so editing or deleting here never changes history.

import { S, put, del, commit, sortedProducts } from './state.js';

/** New products go to the end of the Sell screen. */
export async function saveProduct(rec) {
    const sort = rec.sort ?? (Math.max(0, ...S.products.map((p) => p.sort ?? 0)) + 1);
    await commit([put('products', { ...rec, sort })]);
}

export const deleteProduct = (id) => commit([del('products', id)]);

/** Move a product one place up (dir −1) or down (+1) on the Sell screen. */
export async function moveProduct(id, dir) {
    const list = sortedProducts();
    const i = list.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await commit(list.map((p, sort) => put('products', { ...p, sort })));
}

export async function saveCategory(rec) {
    await commit([put('categories', { ...rec, sort: rec.sort ?? S.categories.length })]);
}

/** Its products stay on the menu without a category. */
export async function deleteCategory(id) {
    await commit([
        del('categories', id),
        ...S.products.filter((p) => p.categoryId === id).map((p) => put('products', { ...p, categoryId: null }))
    ]);
}

export const saveModifier = (rec) => commit([put('modifiers', rec)]);

/** Also removes the add-on from every product that offered it. */
export async function deleteModifier(id) {
    await commit([
        del('modifiers', id),
        ...S.products.filter((p) => p.modifierIds?.includes(id))
            .map((p) => put('products', { ...p, modifierIds: p.modifierIds.filter((m) => m !== id) }))
    ]);
}
