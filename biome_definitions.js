// --- biome_definitions.js ---
// Contiene la LÓGICA para interpretar los datos de biome_definitions.json
// ¡MODIFICADO! Ahora usa una función getNoise()

// Almacén para las definiciones cargadas desde JSON
let BIOME_DATA = {};

/**
 * Procesa las definiciones de bioma cargadas desde JSON
 * y genera las funciones lógicas.
 * @param {object} biomeJsonData - El contenido de biome_definitions.json
 */
export function processBiomeDefinitions(biomeJsonData) {
    BIOME_DATA = biomeJsonData;
    
    // Poblar BIOME_CONFIG con funciones que USAN los datos
    for (const biomeKey in BIOME_DATA) {
        if (!BIOME_DATA.hasOwnProperty(biomeKey)) continue;
        
        const data = BIOME_DATA[biomeKey];
        
        // --- ¡SIGNATURA MODIFICADA! ---
        // Ahora recibe 'getNoise' (una función) en lugar de 'noises' (un objeto)
        BIOME_CONFIG[biomeKey] = {
            getTileAndEntities: (getNoise, uid, x, y, z, createEntity) => {
        // --- FIN DE MODIFICACIÓN ---
                
                let tileKey = data.baseTile;
                const entities = [];

                // 1. Comprobar reglas de terreno
                if (data.terrainRules && data.terrainRules.length > 0) {
                    for (const rule of data.terrainRules) {
                        // --- ¡MODIFICADO! ---
                        const noiseVal = getNoise(rule.noise); // Llama a la función
                        // --- FIN DE MODIFICACIÓN ---
                        if (noiseVal > rule.threshold) {
                            tileKey = rule.tileKey; // La última regla que coincida, gana
                        }
                    }
                }

                // 2. Comprobar generación de entidades
                if (data.entities && data.entities.length > 0) {
                    for (const entityRule of data.entities) {
                        // --- ¡MODIFICADO! ---
                        const noiseVal = getNoise(entityRule.noise); // Llama a la función
                        // --- FIN DE MODIFICACIÓN ---
                        
                        // Comparamos el ruido (ej. 0.9) con el umbral (ej. 0.85)
                        if (noiseVal > entityRule.threshold) {
                            
                            // ¡NUEVO! Log para verificar nuevos tipos
                            if (entityRule.type !== 'vegetation') {
                                // console.log(`Generando entidad de tipo [${entityRule.type}] en ${biomeKey}`);
                            }
                            // --- FIN DE NUEVO ---

                            const entity = createEntity(entityRule.entityKey, x, y, z, `${uid}_${entityRule.entityKey}`);
                            if (entity) {
                                entities.push(entity);
                            }
                        }
                    }
                }

                return { tileKey: tileKey, entities: entities };
            }
        };
    }
    
    // El bioma 'UNDERGROUND' es especial
    if (!BIOME_CONFIG['UNDERGROUND']) {
         BIOME_CONFIG['UNDERGROUND'] = {
            getTileAndEntities: () => {
                // Esta función no se llama para 'UNDERGROUND'
                // 'generateUndergroundChunk' se encarga de ello.
                return { tileKey: 'ROCK_WALL', entities: [] };
            }
        };
    }
    
    console.log("Definiciones de bioma procesadas y funciones generadas.");
}

// BIOME_CONFIG se exporta vacío al inicio,
// pero se rellena cuando processBiomeDefinitions() es llamado
// por generation.js al arrancar.
export const BIOME_CONFIG = {};