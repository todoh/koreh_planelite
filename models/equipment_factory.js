// --- models/equipment_factory.js ---
// Decide qué tipo de mesh 3D crear para un item (Modelo 3D vs Sprite 2D).

import { createSwordMesh } from './sword_model.js';
import { createItemSpriteMesh } from './item_sprite_model.js';

/**
 * Crea un mesh 3D para un item, ya sea un modelo 3D definido o un sprite 2D.
 * @param {object} itemDefinition - La definición del item desde ITEM_DEFINITIONS.
 * @returns {THREE.Object3D | null}
 */
export function createEquipmentMesh(itemDefinition) {
    if (!itemDefinition) {
        return null;
    }

    // 1. Comprobar si tiene un modelo 3D específico definido en items.json
    if (itemDefinition.equipment?.model) {
        switch (itemDefinition.equipment.model) {
            case 'BASIC_SWORD':
                return createSwordMesh();
            // case 'KATANA':
            //     return createKatanaMesh(); // (Ejemplo para el futuro)
            default:
                console.warn(`Modelo 3D desconocido: ${itemDefinition.equipment.model}`);
                // Si falla, intentará hacer un sprite
        }
    }

    // 2. Si no hay modelo 3D, crear un sprite 2D usando su imageKey
    if (itemDefinition.imageKey) {
        return createItemSpriteMesh(itemDefinition.imageKey);
    }

    // 3. Si no tiene ni modelo ni imagen (como "HAND"), no mostrar nada.
    return null;
}