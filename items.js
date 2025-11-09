// --- items.js ---
// Define la "base de datos" de todos los objetos del juego.

export const ITEM_DEFINITIONS = {
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
};