// --- entity_components.js ---
// Define las "clases" de componentes.
// Un componente es un bloque de DATOS que describe un aspecto de una entidad.

/**
 * Componente para entidades que se pueden dibujar.
 */
export class RenderableComponent {
    constructor(imageKey) {
        this.imageKey = imageKey;
    }
}

/**
 * Componente para entidades que tienen colisión física.
 */
export class CollisionComponent {
    constructor(isSolid, collisionBox = null) {
        this.isSolid = isSolid; 
        this.collisionBox = collisionBox; 
    }
}

/**
 * Componente para entidades que dan recursos al interactuar.
 */
export class InteractableResourceComponent {
    constructor(itemId, quantity, energyCost = 1) {
        this.itemId = itemId;
        this.quantity = quantity;
        this.energyCost = energyCost;
    }
}

/**
 * Componente para entidades que muestran un diálogo al interactuar.
 */
export class InteractableDialogueComponent {
    constructor(message) {
        this.message = message; 
    }
}

/**
 * Componente para entidades que abren un menú al interactuar.
 */
export class InteractableMenuComponent {
    constructor(menuId) {
        this.menuId = menuId; // Ej: "CRAFTING", "SHOP"
    }
}

/**
 * ¡NUEVO! Componente para entidades que cambian el Z-level.
 */
export class InteractableLevelChangeComponent {
    constructor(direction) { // "up" o "down"
        this.direction = direction;
    }
}


/**
 * Componente para entidades que se recogen al pasar por encima.
 */
export class CollectibleComponent {
    constructor(itemId, quantity) {
        this.itemId = itemId;
        this.quantity = quantity;
    }
}

/**
 * Componente para entidades que crecen con el tiempo.
 */
export class GrowthComponent {
    constructor(timeToGrowMs, nextEntityKey) {
        this.timeToGrowMs = timeToGrowMs;
        this.nextEntityKey = nextEntityKey;
        this.currentTime = 0; 
    }
}

/**
 * Componente para entidades que se pueden conducir.
 */
export class VehicleComponent {
    constructor(speed) {
        this.speed = speed; 
        this.mountedEntityUid = null; 
    }
}

/**
 * Componente para marcar un vehiculo como interactuable (para montarse).
 */
export class InteractableVehicleComponent {
    constructor() {
        // No necesita args
    }
}


/**
 * Componente para entidades que se mueven solas.
 */
export class MovementAIComponent {
    constructor(pattern, speed) {
        this.pattern = pattern; 
        this.speed = speed;
        this.timeUntilNextAction = 0; 
        this.currentVelocity = { x: 0, y: 0 };
    }
}

/**
 * Componente para entidades que tienen vida.
 */
export class HealthComponent {
    constructor(maxHealth) {
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
    }
}
// --- NUEVOS COMPONENTES AÑADIDOS ---

/**
 * Componente para añadir etiquetas (tags) a una entidad.
 * @param {string} tagsString - Un string de etiquetas separadas por comas (ej: "MONSTRUO, VOLADOR").
 */
export class TagComponent {
    constructor(tagsString) {
        // Guardamos las etiquetas como un array, limpiando espacios
        this.tags = (tagsString || "").split(',')
                      .map(tag => tag.trim())
                      .filter(tag => tag.length > 0);
    }
}

/**
 * Componente para atributos con valor numérico (ej. FUERZA: 10).
 * @param {string} attributesJson - Un string JSON de un array. 
 * Ej: '[{"id":"FUERZA", "value":10}, {"id":"AGILIDAD", "value":5}]'
 */
export class AttributeComponent {
    constructor(attributesJson) {
        try {
            // Guardamos los atributos como un array de objetos
            this.attributes = JSON.parse(attributesJson || '[]');
            if (!Array.isArray(this.attributes)) {
                this.attributes = [];
            }
        } catch (e) {
            console.warn("Error al parsear JSON de AttributeComponent:", e);
            this.attributes = [];
        }
    }
}

/**
 * Componente para constantes vitales (Vida, Energía, etc.)
 * Inspirado en StatsVitales de COMPLEMENTOS.TXT.
 * @param {number} vidaActual 
 * @param {number} vidaMaxima 
 * @param {number} energiaActual 
 * @param {number} energiaMaxima 
 */
export class VitalsComponent {
    constructor(vidaActual, vidaMaxima, energiaActual, energiaMaxima) {
        // Asignamos valores o usamos 100 por defecto
        this.vidaActual = vidaActual !== undefined ? vidaActual : 100;
        this.vidaMaxima = vidaMaxima !== undefined ? vidaMaxima : 100;
        this.energiaActual = energiaActual !== undefined ? energiaActual : 100;
        this.energiaMaxima = energiaMaxima !== undefined ? energiaMaxima : 100;
    }
}

/**
 * ¡NUEVO!
 * Componente para recursos que requieren un Tag de item específico.
 */
export class InteractableFilteredResourceComponent {
    constructor(itemId, quantity, energyCost = 1, requiredTag) {
        this.itemId = itemId;       // Item que suelta
        this.quantity = quantity;   // Cuánto suelta
        this.energyCost = energyCost; // Coste de energía
        this.requiredTag = requiredTag; // Etiqueta requerida (ej: "TAJO")
    }
}



/**
 * ¡ELIMINADO! El componente 'PlaceableComponent' ya no es necesario.
 * El renderizado en cubo ahora se controla con "renderMode": "cube" 
 * en entity_definitions.json.
 */
// export class PlaceableComponent { ... }