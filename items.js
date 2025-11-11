// --- items.js ---
// Define la "base de datos" de todos los objetos del juego.

export const ITEM_DEFINITIONS = {
    'HAND': {
        name: 'Mano',
        description: 'Tus manos desnudas. Permiten interactuar con el mundo de forma segura sin colocar bloques.',
        imageKey: 'MANO', // Usaremos 'MANO' como clave de imagen
        stackable: false,
        maxStack: 1
    },
    // Recursos
    'WOOD': {
        name: 'Madera',
        description: 'Un trozo de madera útil para construir.',
        imageKey: 'TREE', // Reutilizamos la imagen del árbol por ahora
        stackable: true,
        maxStack: 99
    },
    'STONE': {
        name: 'Piedra',
        description: 'Una roca simple, buena para herramientas.',
        imageKey: 'ROCK', // Reutilizamos la imagen de la roca
        stackable: true,
        maxStack: 99
    },
    'GOLD_COIN': {
        name: 'Oro',
        description: 'Brillante y valioso.',
        imageKey: 'ITEM', // Reutilizamos la imagen del cofre
        stackable: true,
        maxStack: 999
    },
    'CACTUS_FIBER': {
        name: 'Fibra',
        description: 'Fibra resistente de un cactus.',
        imageKey: 'CACTUS', // Reutilizamos la imagen del cactus
        stackable: true,
        maxStack: 99
    },

    // Añade más objetos aquí...

    // --- Items de Construcción (Entidades Verticales) ---
    'ITEM_WOOD_WALL': {
        name: 'Pared de Madera',
        description: 'Una pared de madera básica.',
        imageKey: 'WALL', // Usamos el sprite de la pared por ahora
        stackable: true,
        maxStack: 99,
        buildable_entity: 'WOOD_WALL_ENTITY' // <- ¡NUEVA CLAVE!
    },
    'ITEM_STONE_PILLAR': {
        name: 'Pilar de Piedra',
        description: 'Un pilar de piedra de soporte.',
        imageKey: 'STATUE', // Reusamos un sprite alto por ahora
        stackable: true,
        maxStack: 99,
        buildable_entity: 'STONE_PILLAR_ENTITY' // <- ¡NUEVA CLAVE!
    },

    // --- Items de Terraformación (Suelo Horizontal) ---
    'ITEM_STONE_GROUND_SLAB': {
        name: 'Adoquín de Piedra',
        description: 'Un trozo de suelo de piedra.',
        imageKey: 'STONE_GROUND', // Usamos el sprite del terreno
        stackable: true,
        maxStack: 99,
        terraform_tile: 'STONE_GROUND' // <- ¡NUEVA CLAVE!
    }
};