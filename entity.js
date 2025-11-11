// --- entity.js ---
// Gestiona la creación de entidades y la carga de definiciones.

// --- ¡ELIMINADO! La importación de definiciones ya no se hace aquí ---
// import { ENTITY_DEFINITIONS } from './entity_definitions.js';
import * as Components from './entity_components.js';

// Almacenes de definiciones
let TERRAIN_DEFINITIONS = {};
// --- ¡MODIFICADO! Ahora es una variable 'let' que se poblará al cargar ---
let ENTITY_TEMPLATES = {}; 

/**
 * Carga y procesa las definiciones de TERRENO (desde JSON).
 * Esto debe llamarse una vez al inicio.
 * @param {object} spriteData - El contenido de terrain_definitions.json
 */
export function processTerrainDefinitions(spriteData) {
    const terrainData = {};
    for (const key in spriteData) {
        if (key.startsWith("//")) continue; // Por si acaso
        terrainData[key] = spriteData[key];
    }
    TERRAIN_DEFINITIONS = terrainData;
    console.log("Definiciones de terreno procesadas.");
}

// --- ¡NUEVA FUNCIÓN! ---
/**
 * Carga y procesa las definiciones de ENTIDAD (desde JSON).
 * @param {object} entityData - El contenido de entity_definitions.json
 */
export function processEntityDefinitions(entityData) {
    ENTITY_TEMPLATES = entityData;
    console.log("Definiciones de entidad procesadas.");
}


/**
 * Devuelve las definiciones de terreno cargadas.
 */
export function getTerrainDefinitions() {
    return TERRAIN_DEFINITIONS;
}

/**
 * Devuelve las plantillas de entidad.
 */
export function getEntityDefinitions() {
    return ENTITY_TEMPLATES;
}


/**
 * Fábrica de Entidades (Entity Factory).
 * Crea una nueva instancia de entidad basada en una plantilla (prefab).
 * --- (Sin cambios en esta función, pero ahora usa ENTITY_TEMPLATES poblado) ---
 * @param {string} key - La clave de la plantilla (ej: "TREE", "NPC").
 * @param {number} x - Coordenada X en el mundo.
 * @param {number} y - Coordenada Y en el mundo (base/pies).
 * @param {number} z - Coordenada Z en el mundo.
 * @param {string} uid - El ID único para esta entidad.
 * @returns {object} La nueva instancia de entidad con componentes.
 */
export function createEntity(key, x, y, z, uid) {
    const template = ENTITY_TEMPLATES[key];
    if (!template) {
        console.warn(`No se encontró definición de entidad para: ${key}`);
        return null;
    }

    // La entidad base
   const entity = {
        uid: uid,
        x: x,
        y: y,
        z: z, 
        key: key, 
        facing: 'right', 
        rotationY: 0, // <-- AÑADE ESTA LÍNEA
        components: {} 
    };

    // Añadir componentes basados en la plantilla
    for (const compDef of template.components) {
        const CompClass = Components[compDef.type + 'Component'];
        if (CompClass) {
            // Usar el 'spread operator' (...) para pasar los 'args' como argumentos al constructor
            const newComponent = new CompClass(...compDef.args);
            entity.components[compDef.type] = newComponent;
        } else {
            console.warn(`Componente desconocido "${compDef.type}Component" en la plantilla "${key}"`);
        }
    }

    return entity;
}