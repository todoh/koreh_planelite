// --- biome_definitions.js ---
// Contiene la configuración específica para cada bioma.
// Define qué terreno y qué entidades generar bajo qué condiciones.

// --- ¡MODIFICADO! ---
// La función 'getTileAndEntities' ahora recibe 'createEntity'
// para que pueda usar la fábrica de entidades directamente.

export const BIOME_CONFIG = {
    
    'OCEAN': {
        getTileAndEntities: (noises, uid, x, y, createEntity) => {
            return { tileKey: 'WATER', entities: [] };
        }
    },

    'BEACH': {
        getTileAndEntities: (noises, uid, x, y, createEntity) => {
            return { tileKey: 'DIRT', entities: [] };
        }
    },

    'DESERT': {
        getTileAndEntities: (noises, uid, x, y, createEntity) => {
            const entities = [];
            if (noises.vegetation > 0.97) {
                entities.push(createEntity('CACTUS', x, y, `${uid}_CACTUS`));
            }
            return { tileKey: 'SAND', entities: entities };
        }
    },

    'SAVANNA': {
        getTileAndEntities: (noises, uid, x, y, createEntity) => {
            const entities = [];
            if (noises.vegetation > 0.96) {
                entities.push(createEntity('ACACIA_TREE', x, y, `${uid}_ACACIA`));
            }
            return { tileKey: 'SAVANNA_GRASS', entities: entities };
        }
    },

    'JUNGLE': {
        getTileAndEntities: (noises, uid, x, y, createEntity) => {
            const entities = [];
            if (noises.vegetation > 0.85) { // Más denso
                entities.push(createEntity('JUNGLE_TREE', x, y, `${uid}_JUNGLE`));
            }
            return { tileKey: 'JUNGLE_GRASS', entities: entities };
        }
    },

    'PLAINS': {
        getTileAndEntities: (noises, uid, x, y, createEntity) => {
            const entities = [];
            if (noises.vegetation > 0.9) {
                entities.push(createEntity('TREE', x, y, `${uid}_TREE`));
            }
            return { tileKey: 'GRASS', entities: entities };
        }
    },

    'ROCKY': {
        getTileAndEntities: (noises, uid, x, y, createEntity) => {
            const entities = [];
            const tileKey = (noises.terrain > 0.75) ? 'STONE_GROUND' : 'DIRT';
            
            if (noises.vegetation > 0.85) {
                entities.push(createEntity('ROCK', x, y, `${uid}_ROCK`));
            }
            return { tileKey: tileKey, entities: entities };
        }
    },

    'TUNDRA': {
        getTileAndEntities: (noises, uid, x, y, createEntity) => {
            const entities = [];
            if (noises.vegetation > 0.95) {
                entities.push(createEntity('SNOW_TREE', x, y, `${uid}_SNOWTREE`));
            }
            return { tileKey: 'SNOW', entities: entities };
        }
    }
};