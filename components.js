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
        // Si no se proporciona caja, se usará una por defecto en el sistema de colisión
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
        // Puede ser un string o un array de strings para diálogos complejos
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
        this.currentTime = 0; // El sistema de crecimiento actualizará esto
    }
}

/**
 * Componente para entidades que se pueden conducir (¡futuro!).
 */
export class VehicleComponent {
    constructor(speed, fuelType) {
        this.speed = speed;
        this.fuelType = fuelType;
        this.isMounted = false;
    }
}

/**
 * Componente para entidades que se mueven solas (¡futuro!).
 * --- ¡MODIFICADO! ---
 */
export class MovementAIComponent {
    constructor(pattern, speed) {
        this.pattern = pattern; // Ej: "WANDER", "PATROL"
        this.speed = speed;
        
        // Estado interno para la IA
        this.timeUntilNextAction = 0; // ms
        this.currentVelocity = { x: 0, y: 0 };
    }
}

/**
 * Componente para entidades que tienen vida (¡futuro!).
 * (Para árboles o rocas que se destruyen por daño en lugar de 1-hit).
 */
export class HealthComponent {
    constructor(maxHealth) {
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
    }
}