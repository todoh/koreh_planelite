// --- entity_definitions.js ---
// ¡NUEVO ARCHIVO!
// Carga y PROCESA las definiciones de entidades desde entity_definitions.json

// Esta variable se exporta, y se rellena después de cargar y procesar.
export let ENTITY_DEFINITIONS = {};

/**
 * Procesa las definiciones de entidades crudas (del JSON)
 * para optimizar el acceso en tiempo de ejecución.
 *
 * 1. Convierte el array 'components' en un objeto (mapa) para acceso O(1).
 * 2. Añade flags booleanos (ej: 'hasMovementAI', 'hasGrowth') para que
 * el sistema de entidades (createEntity) sepa si debe añadir la
 * entidad a listas de actualización optimizadas (ej: activeAiEntities).
 *
 * @param {object} rawData - El objeto JSON crudo cargado de entity_definitions.json
 * @returns {object} Un nuevo objeto con las definiciones procesadas.
 */
export function processEntityDefinitions(rawData) {
    const processedDefinitions = {};

    // Iteramos sobre cada definición de entidad (ej: "TREE", "NPC", "ROCK")
    for (const key in rawData) {
        const rawDef = rawData[key];
        
        // Copiamos la definición base
        const newDef = { 
            ...rawDef,
            key: key // Aseguramos que la key esté en la definición
        };

        // 1. Inicializamos los flags de optimización
        newDef.hasMovementAI = false;
        newDef.hasGrowth = false;
        newDef.isCollectible = false;
        newDef.isVehicle = false;
        newDef.isInteractable = false;
        newDef.isSolid = false; // Por defecto no es sólido

        // 2. Convertimos el array de componentes en un mapa (objeto)
        const componentsMap = {};
        if (rawDef.components && Array.isArray(rawDef.components)) {
            for (const comp of rawDef.components) {
                // Guardamos los argumentos del componente usando su tipo como clave
                componentsMap[comp.type] = comp.args;

                // 3. Actualizamos los flags basados en los componentes encontrados
                switch (comp.type) {
                    case 'MovementAI':
                        newDef.hasMovementAI = true;
                        break;
                    case 'Growth':
                        newDef.hasGrowth = true;
                        break;
                    case 'Collectible':
                        newDef.isCollectible = true;
                        break;
                    case 'Vehicle':
                        newDef.isVehicle = true;
                        break;
                    case 'Collision':
                        // Analizamos el primer argumento de colisión para 'isSolid'
                        if (comp.args && comp.args.length > 0) {
                            const firstArg = comp.args[0];
                            if (typeof firstArg === 'boolean') {
                                newDef.isSolid = firstArg;
                            } else if (typeof firstArg === 'object' && firstArg.isSolid === true) {
                                newDef.isSolid = true;
                            }
                        }
                        break;
                }
                
                // Cualquier componente que empiece con "Interactable" marca la entidad
                if (comp.type.startsWith('Interactable')) {
                    newDef.isInteractable = true;
                }
            }
        }

        // Reemplazamos el array 'components' por nuestro mapa optimizado
        newDef.components = componentsMap;
        
        // Guardamos la definición procesada
        processedDefinitions[key] = newDef;
    }

    console.log("Definiciones de entidades procesadas y optimizadas.");
    return processedDefinitions;
}


/**
 * Carga y PROCESA las definiciones de entidades (desde JSON).
 * Esto debe llamarse una vez al inicio.
 */
export async function loadEntityDefinitions() {
    try {
        const response = await fetch('./entity_definitions.json');
        if (!response.ok) {
            throw new Error(`Error al cargar entity_definitions.json: ${response.statusText}`);
        }
        const rawData = await response.json();
        
        // ¡Aquí se llama a la nueva función!
        ENTITY_DEFINITIONS = processEntityDefinitions(rawData);

    } catch (e) {
        console.error("No se pudieron cargar o procesar las definiciones de entidades:", e);
        // Dejar ENTITY_DEFINITIONS como un objeto vacío para evitar crasheos
        ENTITY_DEFINITIONS = {};
    }
}

/**
 * ¡NUEVA FUNCIÓN!
 * Devuelve el mapa de definiciones de entidades ya procesadas.
 * @returns {object} El objeto ENTITY_DEFINITIONS.
 */
export function getEntityDefinitions() {
    return ENTITY_DEFINITIONS;
}