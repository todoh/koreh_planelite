// --- terrain_definitions.js ---
// (Archivo nuevo sugerido)

// Variable para almacenar las definiciones de terreno
export let TERRAIN_DEFINITIONS = {};

/**
 * Carga las definiciones de terreno (desde JSON).
 * (Aquí podrías añadir un 'processTerrainDefinitions' si necesitas optimizarlas,
 * similar a como hiciste con las entidades).
 */
export async function loadTerrainDefinitions() {
    try {
        const response = await fetch('./terrain_definitions.json');
        if (!response.ok) {
            throw new Error(`Error al cargar terrain_definitions.json: ${response.statusText}`);
        }
        TERRAIN_DEFINITIONS = await response.json();
        console.log("Definiciones de terreno cargadas.");
        
    } catch (e) {
        console.error("No se pudieron cargar las definiciones de terreno:", e);
        TERRAIN_DEFINITIONS = {};
    }
}

/**
 * Devuelve el mapa de definiciones de terreno.
 * @returns {object} El objeto TERRAIN_DEFINITIONS.
 */
export function getTerrainDefinitions() {
    return TERRAIN_DEFINITIONS;
}