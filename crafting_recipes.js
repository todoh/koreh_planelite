// --- crafting_recipes.js ---
// ¡MODIFICADO!
// Ahora carga las recetas desde crafting_recipes.json

// Esta variable se exporta vacía, pero se rellena al cargar el juego
export let CRAFTING_RECIPES = {};

/**
 * Carga y procesa las definiciones de recetas (desde JSON).
 * Esto debe llamarse una vez al inicio desde generation.js.
 */
export async function loadCraftingRecipes() {
    try {
        const response = await fetch('./crafting_recipes.json');
        if (!response.ok) {
            throw new Error(`Error al cargar crafting_recipes.json: ${response.statusText}`);
        }
        CRAFTING_RECIPES = await response.json();
        console.log("Recetas de crafteo cargadas.");
    } catch (e) {
        console.error("No se pudieron cargar las recetas de crafteo:", e);
        // Dejar CRAFTING_RECIPES como un objeto vacío para evitar crasheos
        CRAFTING_RECIPES = {};
    }
}