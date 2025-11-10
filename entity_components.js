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