// --- inventory.js ---
// Gestiona el estado y la lógica del inventario del jugador.

import { ITEM_DEFINITIONS } from './items.js';

export const MAX_SLOTS = 30; // 5 filas de 6 columnas
let playerInventory = [];

/**
 * Inicializa el inventario, cargándolo desde datos guardados o creando uno nuevo.
 * @param {Array|null} savedInventory - El array de inventario guardado.
 */
export function initializeInventory(savedInventory) {
    if (savedInventory && Array.isArray(savedInventory)) {
        playerInventory = savedInventory;
        // Asegurarse de que tenga el tamaño correcto si se ha actualizado el juego
        if (playerInventory.length < MAX_SLOTS) {
            playerInventory.push(...new Array(MAX_SLOTS - playerInventory.length).fill(null));
        } else if (playerInventory.length > MAX_SLOTS) {
            playerInventory = playerInventory.slice(0, MAX_SLOTS);
        }
    } else {
        playerInventory = new Array(MAX_SLOTS).fill(null);
    }
    console.log("Inventario inicializado con", MAX_SLOTS, "slots.");
}

/**
 * Devuelve el estado actual del inventario.
 * @returns {Array}
 */
export function getInventory() {
    return playerInventory;
}

/**
 * Añade un objeto al inventario.
 * @param {string} itemId - El ID del objeto (ej: 'WOOD')
 * @param {number} quantity - La cantidad a añadir.
 * @returns {boolean} - true si se añadió (total o parcialmente), false si estaba lleno.
 */
export function addItem(itemId, quantity) {
    const itemDef = ITEM_DEFINITIONS[itemId];
    if (!itemDef) {
        console.warn(`Se intentó añadir un objeto desconocido: ${itemId}`);
        return false;
    }

    let quantityToAdd = quantity;

    // 1. Intentar apilar en stacks existentes (si es apilable)
    if (itemDef.stackable) {
        for (let i = 0; i < playerInventory.length; i++) {
            const slot = playerInventory[i];
            if (slot && slot.itemId === itemId && slot.quantity < itemDef.maxStack) {
                const canAdd = itemDef.maxStack - slot.quantity;
                const toAdd = Math.min(quantityToAdd, canAdd);
                
                slot.quantity += toAdd;
                quantityToAdd -= toAdd;

                if (quantityToAdd === 0) return true; // Terminado
            }
        }
    }

    // 2. Si queda cantidad, buscar slots vacíos
    if (quantityToAdd > 0) {
        for (let i = 0; i < playerInventory.length; i++) {
            if (playerInventory[i] === null) {
                // Encontrado un slot vacío
                // ¡MODIFICADO! Asegurarse de que los stacks nuevos también respeten maxStack
                const maxStackSize = itemDef.stackable ? itemDef.maxStack : 1;
                const toAdd = Math.min(quantityToAdd, maxStackSize);
                
                playerInventory[i] = {
                    itemId: itemId,
                    quantity: toAdd
                };
                quantityToAdd -= toAdd;

                // Si queda más por añadir Y es apilable, seguir buscando slots vacíos
                if (quantityToAdd === 0) return true; // Terminado
                if (!itemDef.stackable) {
                     // Si no es apilable y hemos añadido uno, seguir buscando
                     // (esto permite añadir múltiples espadas, por ejemplo)
                     continue;
                }
            }
        }
    }

    // Si llegamos aquí, el inventario está lleno y no se pudo añadir todo
    if (quantityToAdd < quantity) return true; // Se añadió algo
    
    console.warn(`Inventario lleno. No se pudo añadir ${quantityToAdd} de ${itemId}`);
    return false; // No se pudo añadir nada
}

/**
 * Elimina una cantidad de un objeto del inventario.
 * @param {string} itemId 
 * @param {number} quantity 
 * @returns {boolean} - true si se eliminó con éxito.
 */
export function removeItem(itemId, quantity) {
    let quantityToRemove = quantity;
    let success = false;

    // Iterar al revés para poder vaciar slots
    for (let i = playerInventory.length - 1; i >= 0; i--) {
        const slot = playerInventory[i];
        
        if (slot && slot.itemId === itemId) {
            if (slot.quantity > quantityToRemove) {
                // El stack tiene más de lo que necesitamos
                slot.quantity -= quantityToRemove;
                quantityToRemove = 0;
                success = true;
                break; // Terminamos
            } else {
                // Vaciamos (parcial o totalmente) este stack
                quantityToRemove -= slot.quantity;
                playerInventory[i] = null; // Vaciar el slot
                success = true;
                if (quantityToRemove === 0) {
                    break; // Terminamos
                }
            }
        }
    }
    
    if (quantityToRemove > 0) {
        console.warn(`No se pudo eliminar toda la cantidad. Faltaron ${quantityToRemove} de ${itemId}`);
        return false; // No se pudo eliminar todo lo solicitado
    }

    return success;
}

/**
 * ¡NUEVO! Genera un mapa con el conteo total de cada item en el inventario.
 * @returns {Map<string, number>} - Un mapa de {itemId: totalQuantity}
 */
export function getInventoryCounts() {
    const counts = new Map();
    for (const slot of playerInventory) {
        if (slot) {
            counts.set(slot.itemId, (counts.get(slot.itemId) || 0) + slot.quantity);
        }
    }
    return counts;
}

/**
 * ¡NUEVO! Comprueba si el jugador tiene suficientes materiales para una receta.
 * @param {Array<object>} requirements - ej. [{ itemId: "WOOD", quantity: 2 }]
 * @returns {boolean}
 */
export function hasItems(requirements) {
    if (!requirements || requirements.length === 0) {
        return true; // Una receta sin requisitos siempre se puede craftear
    }
    
    const counts = getInventoryCounts();
    
    for (const req of requirements) {
        if ((counts.get(req.itemId) || 0) < req.quantity) {
            return false; // No hay suficiente de este item
        }
    }
    
    return true; // Se tienen todos los items
}

/**
 * Comprueba si el jugador tiene suficiente de un objeto.
 * @param {string} itemId 
 * @param {number} quantity 
 * @returns {boolean}
 */
export function hasItem(itemId, quantity) {
    const counts = getInventoryCounts();
    return (counts.get(itemId) || 0) >= quantity;
}