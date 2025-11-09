// --- entity_definitions.js ---
// Define las "plantillas" (prefabs) para todas las entidades del juego.
// Esto reemplaza la parte de entidades de 'sprites.json' y 'TILE_BEHAVIORS'.

export const ENTITY_DEFINITIONS = {
    // --- Entidades Recolectables (Interacción) ---
    "TREE": {
        name: "un árbol",
        components: [
            { type: 'Renderable', args: ['TREE'] },
            { type: 'Collision', args: [true, { width: 40, height: 20, offsetY: 60 }] },
            { type: 'InteractableResource', args: ['WOOD', 1, 2] } // itemId, quantity, energyCost
        ]
    },
    "ROCK": {
        name: "una roca",
        components: [
            { type: 'Renderable', args: ['ROCK'] },
            { type: 'Collision', args: [true, { width: 60, height: 30, offsetY: 30 }] },
            { type: 'InteractableResource', args: ['STONE', 1, 1] }
        ]
    },
    "CACTUS": {
        name: "un cactus",
        components: [
            { type: 'Renderable', args: ['CACTUS'] },
            { type: 'Collision', args: [true, { width: 30, height: 20, offsetY: 50 }] },
            { type: 'InteractableResource', args: ['CACTUS_FIBER', 1, 1] }
        ]
    },
    "ACACIA_TREE": {
        name: "una acacia",
        components: [
            { type: 'Renderable', args: ['ACACIA_TREE'] },
            { type: 'Collision', args: [true, { width: 40, height: 20, offsetY: 60 }] },
            { type: 'InteractableResource', args: ['WOOD', 1, 2] }
        ]
    },
    "JUNGLE_TREE": {
        name: "un árbol de jungla",
        components: [
            { type: 'Renderable', args: ['JUNGLE_TREE'] },
            { type: 'Collision', args: [true, { width: 40, height: 20, offsetY: 60 }] },
            { type: 'InteractableResource', args: ['WOOD', 1, 2] }
        ]
    },
    "SNOW_TREE": {
        name: "un árbol nevado",
        components: [
            { type: 'Renderable', args: ['SNOW_TREE'] },
            { type: 'Collision', args: [true, { width: 40, height: 20, offsetY: 60 }] },
            { type: 'InteractableResource', args: ['WOOD', 1, 2] }
        ]
    },

    // --- Entidades de Interacción (Diálogo, Menús) ---
    "NPC": {
        name: "una persona",
        components: [
            { type: 'Renderable', args: ['NPC'] },
            { type: 'Collision', args: [true, { width: 40, height: 20, offsetY: 40 }] },
            // --- ¡MODIFICADO! ---
            { type: 'InteractableDialogue', args: ["Bienvenidos a Planelite!!!"] },
            { type: 'MovementAI', args: ['WANDER', 50] } // pattern, speed (más lento que el jugador)
        ]
    },
    "STATUE": {
        name: "una estatua enorme",
        components: [
            { type: 'Renderable', args: ['STATUE'] },
            { type: 'Collision', args: [true, { width: 120, height: 40, offsetY: 160 }] },
            { type: 'InteractableDialogue', args: ["Una estatua imponente. Marca el spawn (0,0)."] }
        ]
    },
    "CRAFTING_TABLE": {
        name: "Mesa de Trabajo",
        components: [
            { type: 'Renderable', args: ['MESATRABAJO'] }, // Usando 'ROCK' como imagen temporal
            { type: 'Collision', args: [true, { width: 70, height: 30, offsetY: 30 }] },
            { type: 'InteractableMenu', args: ['CRAFTING'] }
        ]
    },

    // --- Entidades Recolectables (OnEnter) ---
    "ITEM_GOLD": {
        name: "un objeto brillante",
        components: [
            { type: 'Renderable', args: ['ITEM'] },
            { type: 'Collision', args: [false] }, // No es sólido, pero necesita un componente para 'findEntityAt'
            { type: 'Collectible', args: ['GOLD_COIN', 10] } // itemId, quantity
        ]
    },

    // --- Entidades de Crecimiento ---
    "SAPLING": {
        name: "un brote",
        components: [
            { type: 'Renderable', args: ['ITEM'] }, // Usando 'ITEM' como imagen temporal
            { type: 'Collision', args: [false] },
            { type: 'Growth', args: [10000, 'TREE'] } // timeToGrowMs, nextEntityKey
        ]
    },
    
    // --- Entidad Jugador (para colisiones) ---
    "PLAYER": {
        name: "jugador",
        components: [
            { type: 'Renderable', args: ['PLAYER'] },
            { type: 'Collision', args: [true, { width: 40, height: 20, offsetY: 40 }] }
        ]
    }
};