// --- equipment_system.js ---
// Sistema para gestionar el acoplamiento de equipo al jugador.

import * as THREE from 'three';

// Constantes para los puntos de "enchufe" (socket)
export const ATTACH_POINT_RIGHT_HAND = 'RIGHT_HAND';
export const ATTACH_POINT_LEFT_HAND = 'LEFT_HAND';
export const ATTACH_POINT_HEAD = 'HEAD';
// ... (añadir más si es necesario: TORSO, FEET, etc.)

const EQUIPMENT_MESH_NAME = "EQUIPMENT_MESH";

/**
 * Elimina cualquier equipo existente de un punto de anclaje.
 * @param {THREE.Group} playerMesh - La malla completa del jugador (el playerGroup).
 * @param {string} attachPoint - Constante del punto de anclaje (ej: ATTACH_POINT_RIGHT_HAND).
 */
export function unequipItem(playerMesh, attachPoint) {
    const anchor = getAnchorPoint(playerMesh, attachPoint);
    if (!anchor) {
        console.warn(`Punto de anclaje no encontrado: ${attachPoint}`);
        return;
    }

    // Buscar y eliminar el objeto de equipo anterior
    const oldEquipment = anchor.getObjectByName(EQUIPMENT_MESH_NAME);
    if (oldEquipment) {
        anchor.remove(oldEquipment);
        // (En un sistema completo, también querrías llamar a geometry.dispose(), etc.)
    }
}

/**
 * Acopla una nueva malla de item a un punto de anclaje del jugador.
 * @param {THREE.Group} playerMesh - La malla completa del jugador (el playerGroup).
 * @param {THREE.Object3D} itemMesh - La malla 3D del item a equipar (ej. createSwordMesh()).
 * @param {string} attachPoint - Constante del punto de anclaje (ej: ATTACH_POINT_RIGHT_HAND).
 */
export function equipItem(playerMesh, itemMesh, attachPoint) {
    const anchor = getAnchorPoint(playerMesh, attachPoint);
    if (!anchor) {
        console.warn(`Punto de anclaje no encontrado: ${attachPoint}`);
        return;
    }

    // Limpiar equipo anterior
    unequipItem(playerMesh, attachPoint);

    // Añadir el nuevo
    itemMesh.name = EQUIPMENT_MESH_NAME; // Ponerle nombre para encontrarlo después
    anchor.add(itemMesh);
}

/**
 * Helper interno para encontrar el grupo 3D correcto (el "hueso" o "enchufe").
 * @param {THREE.Group} playerMesh 
 * @param {string} attachPoint 
 * @returns {THREE.Group | null}
 */
function getAnchorPoint(playerMesh, attachPoint) {
    if (!playerMesh || !playerMesh.userData) {
        return null;
    }

    // Usamos las referencias guardadas en 'player_model.js'
    switch (attachPoint) {
        case ATTACH_POINT_RIGHT_HAND:
            return playerMesh.userData.handRightGroup || null;
        case ATTACH_POINT_LEFT_HAND:
            return playerMesh.userData.handLeftGroup || null;
        case ATTACH_POINT_HEAD:
            return playerMesh.userData.head || null;
        // case ATTACH_POINT_TORSO:
        //     return playerMesh.userData.torso || null;
        default:
            return null;
    }
}