// --- items.js ---
// ¡MODIFICADO!
// Ahora carga las definiciones de items desde items.json

// Esta variable se exporta vacía, pero se rellena al cargar el juego
export let ITEM_DEFINITIONS = {};

/**
 * Carga y procesa las definiciones de items (desde JSON).
 * Esto debe llamarse una vez al inicio desde generation.js.
 */
export async function loadItemDefinitions() {
    try {
        const response = await fetch('./items.json');
        if (!response.ok) {
            throw new Error(`Error al cargar items.json: ${response.statusText}`);
        }
        ITEM_DEFINITIONS = await response.json();
        console.log("Definiciones de items cargadas.");
    } catch (e) {
        console.error("No se pudieron cargar las definiciones de items:", e);
        // Dejar ITEM_DEFINITIONS como un objeto vacío para evitar crasheos
        ITEM_DEFINITIONS = {};
    }
}