// --- models/sword_model.js ---
// Constructor para crear la malla 3D de la espada.

import * as THREE from 'three';

// Los datos de sword_model.json (se hardcodean aquí para simplicidad,
// pero podrían cargarse asincrónicamente en un sistema más complejo).
const SWORD_DATA = {
    "materials": {
        "blade": { "color": 0xc0c0c0 },
        "guard": { "color": 0xa0522d },
        "hilt": { "color": 0x4b3621 }
    },
    "geometries": {
        "blade": { "width": 1.5, "height": 30, "depth": 0.5 },
        "guard": { "width": 6, "height": 1.5, "depth": 1.5 },
        "hilt": { "width": 1.5, "height": 8, "depth": 1.5 }
    },
    "positions": {
        "blade": { "x": 0, "y": 19, "z": 0 },
        "guard": { "x": 0, "y": 4.75, "z": 0 },
        "hilt": { "x": 0, "y": 0, "z": 0 }
    }
};

// Materiales cacheados
const materials = {
    blade: new THREE.MeshBasicMaterial({ color: SWORD_DATA.materials.blade.color }),
    guard: new THREE.MeshBasicMaterial({ color: SWORD_DATA.materials.guard.color }),
    hilt: new THREE.MeshBasicMaterial({ color: SWORD_DATA.materials.hilt.color })
};

// Geometrías cacheadas
const geometries = {
    blade: new THREE.BoxGeometry(
        SWORD_DATA.geometries.blade.width,
        SWORD_DATA.geometries.blade.height,
        SWORD_DATA.geometries.blade.depth
    ),
    guard: new THREE.BoxGeometry(
        SWORD_DATA.geometries.guard.width,
        SWORD_DATA.geometries.guard.height,
        SWORD_DATA.geometries.guard.depth
    ),
    hilt: new THREE.BoxGeometry(
        SWORD_DATA.geometries.hilt.width,
        SWORD_DATA.geometries.hilt.height,
        SWORD_DATA.geometries.hilt.depth
    )
};

/**
 * Crea una nueva malla 3D de una espada.
 * @returns {THREE.Group} Un grupo que contiene la espada.
 */
export function createSwordMesh() {
    const swordGroup = new THREE.Group();

    // Crear Mallas
    const blade = new THREE.Mesh(geometries.blade, materials.blade);
    blade.position.set(
        SWORD_DATA.positions.blade.x,
        SWORD_DATA.positions.blade.y,
        SWORD_DATA.positions.blade.z
    );

    const guard = new THREE.Mesh(geometries.guard, materials.guard);
    guard.position.set(
        SWORD_DATA.positions.guard.x,
        SWORD_DATA.positions.guard.y,
        SWORD_DATA.positions.guard.z
    );

    const hilt = new THREE.Mesh(geometries.hilt, materials.hilt);
    hilt.position.set(
        SWORD_DATA.positions.hilt.x,
        SWORD_DATA.positions.hilt.y,
        SWORD_DATA.positions.hilt.z
    );

    // Ensamblar
    swordGroup.add(hilt);
    swordGroup.add(guard);
    swordGroup.add(blade);

    // --- Rotación por Defecto ---
    // El modelo del jugador tiene los brazos apuntando hacia abajo (eje Y negativo).
    // Queremos que la espada apunte hacia adelante (eje Z positivo del jugador).
    // El "forward" del jugador es el Z positivo del MUNDO.
    // El "forward" del brazo (Y neg) es... complicado.
    // Vamos a rotarla 90 grados en X para que apunte "hacia afuera" de la mano.
    swordGroup.rotation.x = -Math.PI / -2; // -90 grados
    swordGroup.position.y = -HAND_SIZE; // Posicionar en la base de la mano
    swordGroup.position.z = HAND_SIZE * 0.0; // Ligeramente hacia adelante

    return swordGroup;
}

// Re-exportar constantes usadas por player_model.js
export const HAND_SIZE = 3;