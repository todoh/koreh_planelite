// --- biome_definitions.js ---
// Contiene la configuración específica para cada bioma.
// Define qué terreno y qué entidades generar bajo qué condiciones.

export const BIOME_CONFIG = {
    
    'OCEAN': {
        // --- ¡MODIFICADO! ---
        getTileAndEntities: (noises, uid, x, y, z, createEntity) => {
            return { tileKey: 'WATER', entities: [] };
        }
    },

    'BEACH': {
        // --- ¡MODIFICADO! ---
        getTileAndEntities: (noises, uid, x, y, z, createEntity) => {
            return { tileKey: 'DIRT', entities: [] };
        }
    },

    'DESERT': {
        // --- ¡MODIFICADO! ---
        getTileAndEntities: (noises, uid, x, y, z, createEntity) => {
            const entities = [];
            if (noises.vegetation > 0.97) {
                entities.push(createEntity('CACTUS', x, y, z, `${uid}_CACTUS`));
            }
            return { tileKey: 'SAND', entities: entities };
        }
    },

    'SAVANNA': {
        // --- ¡MODIFICADO! ---
        getTileAndEntities: (noises, uid, x, y, z, createEntity) => {
            const entities = [];
            if (noises.vegetation > 0.96) {
                entities.push(createEntity('ACACIA_TREE', x, y, z, `${uid}_ACACIA`));
            }
            return { tileKey: 'SAVANNA_GRASS', entities: entities };
        }
    },

    'JUNGLE': {
        // --- ¡MODIFICADO! ---
        getTileAndEntities: (noises, uid, x, y, z, createEntity) => {
            const entities = [];
            if (noises.vegetation > 0.85) { // Más denso
                entities.push(createEntity('JUNGLE_TREE', x, y, z, `${uid}_JUNGLE`));
            }
            return { tileKey: 'JUNGLE_GRASS', entities: entities };
        }
    },

    'PLAINS': {
        // --- ¡MODIFICADO! ---
        getTileAndEntities: (noises, uid, x, y, z, createEntity) => {
            const entities = [];
            if (noises.vegetation > 0.9) {
                entities.push(createEntity('TREE', x, y, z, `${uid}_TREE`));
            }
            return { tileKey: 'GRASS', entities: entities };
        }
    },

    'ROCKY': {
        // --- ¡MODIFICADO! ---
        getTileAndEntities: (noises, uid, x, y, z, createEntity) => {
            const entities = [];
            const tileKey = (noises.terrain > 0.75) ? 'STONE_GROUND' : 'DIRT';
            
            if (noises.vegetation > 0.85) {
                entities.push(createEntity('ROCK', x, y, z, `${uid}_ROCK`));
            }
            return { tileKey: tileKey, entities: entities };
        }
    },

    'TUNDRA': {
        // --- ¡MODIFICADO! ---
        getTileAndEntities: (noises, uid, x, y, z, createEntity) => {
            const entities = [];
            if (noises.vegetation > 0.95) {
                entities.push(createEntity('SNOW_TREE', x, y, z, `${uid}_SNOWTREE`));
            }
            return { tileKey: 'SNOW', entities: entities };
        }
    },
    
    // --- ¡NUEVO BIOMA! ---
    'UNDERGROUND': {
        getTileAndEntities: (noises, uid, x, y, z, createEntity) => {
            // Esta función no se llama para 'UNDERGROUND'
            // 'generateUndergroundChunk' se encarga de ello.
            return { tileKey: 'ROCK_WALL', entities: [] };
        }
    }
};