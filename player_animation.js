// --- player_animation.js ---
// Gestiona la animación del modelo 3D del jugador.
// --- ¡REFACTORIZADO (v14)! Sistema de Animación por Capas ---
// Las acciones (Capa 2) ahora se aplican SOBRE
// la locomoción (Capa 1), permitiendo caminar y talar.

import { TILE_PX_HEIGHT, player } from './logic.js';

let walkTime = 0;
let breathTime = 0;

// --- Constantes de Animación de Acción ---
export const CHOP_DURATION = 0.5;
export const PICKUP_DURATION = 0.6;

/**
 * Resetea todos los miembros a una posición de reposo (T-pose/A-pose).
 * @param {THREE.Group} playerMesh
 */
function resetToIdle(playerMesh) {
    if (!playerMesh.userData.torso) return;

    // Resetear Pelvis (pivote del torso)
    if (playerMesh.userData.pelvis) {
        playerMesh.userData.pelvis.position.y = playerMesh.userData.basePelvisY;
        playerMesh.userData.pelvis.rotation.x = 0;
    }

    // Resetear Piernas (pivotes de cadera)
    if (playerMesh.userData.legLeft) {
        playerMesh.userData.legLeft.position.y = playerMesh.userData.baseLegLeftY;
        playerMesh.userData.legLeft.rotation.x = 0;
    }
    if (playerMesh.userData.lowerLegLeft) playerMesh.userData.lowerLegLeft.rotation.x = 0;

    if (playerMesh.userData.legRight) {
        playerMesh.userData.legRight.position.y = playerMesh.userData.baseLegRightY;
        playerMesh.userData.legRight.rotation.x = 0;
    }
    if (playerMesh.userData.lowerLegRight) playerMesh.userData.lowerLegRight.rotation.x = 0;

    // Resetear rotación de brazos
    if (playerMesh.userData.armLeft) playerMesh.userData.armLeft.rotation.x = 0;
    if (playerMesh.userData.lowerArmLeft) playerMesh.userData.lowerArmLeft.rotation.x = 0;
    if (playerMesh.userData.armRight) playerMesh.userData.armRight.rotation.x = 0;
    if (playerMesh.userData.lowerArmRight) playerMesh.userData.lowerArmRight.rotation.x = 0;

    // Resetear torso (posición y rotación relativas a la pelvis)
    if (playerMesh.userData.torso) {
        playerMesh.userData.torso.position.y = playerMesh.userData.baseTorsoY;
        playerMesh.userData.torso.rotation.x = 0;
    }
}

/**
 * Aplica la animación de respiración sutil (Capa Base - Reposo).
 * @param {THREE.Group} playerMesh
 * @param {number} deltaTime
 */
function applyIdleAnimation(playerMesh, deltaTime) {
    breathTime += deltaTime;
    const breathSpeed = 1.5;
    const breathAmount = 0.5;

    const breathOffset = Math.sin(breathTime * breathSpeed) * breathAmount;

    // Mover sutilmente el torso (y la cabeza se moverá con él)
    if (playerMesh.userData.torso) {
        playerMesh.userData.torso.position.y = playerMesh.userData.baseTorsoY + breathOffset;
    }
}

/**
 * Aplica la animación de caminar (Capa Base - Movimiento).
 * @param {THREE.Group} playerMesh
 * @param {number} deltaTime
 */
function applyWalkAnimation(playerMesh, deltaTime) {
    // --- Constantes de Animación ---
    const walkAnimSpeed = 15;
    const walkAngle = Math.PI / 4;
    const bobHeight = 1.0;
    const kneeBendAngle = Math.PI / 3;
    const shoulderSwingAngle = Math.PI / 5;
    const elbowBendAngle = Math.PI / 4;

    walkTime += walkAnimSpeed * deltaTime;

    // --- 1. Animación de Piernas (Cadera y Rodilla) ---
    const walkOffset = Math.sin(walkTime) * walkAngle; // Balanceo de cadera
    const kneeBend = (Math.sin(walkTime) * 0.5 + 0.5) * kneeBendAngle;
    const kneeBendOpposite = (Math.sin(walkTime + Math.PI) * 0.5 + 0.5) * kneeBendAngle;

    if (playerMesh.userData.legLeft) playerMesh.userData.legLeft.rotation.x = walkOffset;
    if (playerMesh.userData.lowerLegLeft) playerMesh.userData.lowerLegLeft.rotation.x = kneeBend;
    if (playerMesh.userData.legRight) playerMesh.userData.legRight.rotation.x = -walkOffset;
    if (playerMesh.userData.lowerLegRight) playerMesh.userData.lowerLegRight.rotation.x = kneeBendOpposite;

    // --- 2. Animación de Brazos (Hombro y Codo) ---
    const shoulderOffset = Math.sin(walkTime + Math.PI) * shoulderSwingAngle;
    const elbowBend = (Math.sin(walkTime + Math.PI) * 0.5 + 0.5) * elbowBendAngle;
    const elbowBendOpposite = (Math.sin(walkTime) * 0.5 + 0.5) * elbowBendAngle;

    if (playerMesh.userData.armLeft) playerMesh.userData.armLeft.rotation.x = shoulderOffset;
    if (playerMesh.userData.lowerArmLeft) playerMesh.userData.lowerArmLeft.rotation.x = -elbowBend;
    if (playerMesh.userData.armRight) playerMesh.userData.armRight.rotation.x = -shoulderOffset;
    if (playerMesh.userData.lowerArmRight) playerMesh.userData.lowerArmRight.rotation.x = -elbowBendOpposite;

    // --- 3. Animación de Rebote (v13) ---
    const bobOffset = Math.abs(Math.sin(walkTime)) * bobHeight;
    const basePelvisY = playerMesh.userData.basePelvisY;
    const currentY = basePelvisY - bobOffset; // El cuerpo baja al caminar

    if (playerMesh.userData.pelvis) {
        playerMesh.userData.pelvis.position.y = currentY;
    }
    if (playerMesh.userData.legLeft) {
        playerMesh.userData.legLeft.position.y = currentY;
    }
    if (playerMesh.userData.legRight) {
        playerMesh.userData.legRight.position.y = currentY;
    }
}

/**
 * Aplica animaciones de acción (Capa 2 - Sobrescribir).
 * ¡¡¡YA NO RESETEA LA POSE!!!
 * @param {THREE.Group} playerMesh
 * @param {string} action - 'chop' o 'pickup'
 * @param {number} timer - El player.actionTimer (cuenta atrás)
 */
function updateActionAnimation(playerMesh, action, timer) {
    // --- ¡¡¡IMPORTANTE: resetToIdle(playerMesh) HA SIDO ELIMINADO!!! ---
    // La acción ahora se aplica *sobre* la pose de caminar/reposo.

    const basePelvisY = playerMesh.userData.basePelvisY;
    const baseLegY = playerMesh.userData.baseLegLeftY || basePelvisY;

    if (action === 'chop') {
        // --- Animación de Talar ---
        // Esta acción SOLO afecta los brazos derechos.
        // Las piernas, brazos izquierdos y pelvis seguirán
        // la animación de caminar/reposo.
        const progress = 1 - (timer / CHOP_DURATION);

        let armAngle, elbowAngle;
        if (progress < 0.4) {
            const raiseProgress = progress / 0.4;
            armAngle = -raiseProgress * 1.5;
            elbowAngle = -raiseProgress * 1.0;
        } else {
            const strikeProgress = (progress - 0.4) / 0.6;
            armAngle = -1.5 + (strikeProgress * 2.5);
            elbowAngle = -1.0 + (strikeProgress * 2.0);
        }

        if (playerMesh.userData.armLeft) playerMesh.userData.armLeft.rotation.x = armAngle;
        if (playerMesh.userData.lowerArmLeft) playerMesh.userData.lowerArmLeft.rotation.x = elbowAngle;

    } else if (action === 'pickup') {
        // --- Animación de Recoger (Simplificada) ---
        // Esta acción SÓLO afecta el brazo derecho.
        // No hay sentadilla; el jugador extiende la mano.
        // Las piernas, torso, etc., seguirán la locomoción.

        const progress = 1 - (timer / PICKUP_DURATION);
        
        // Usar sin(progress * PI) para un movimiento suave de ida (0->1) y vuelta (1->0)
        // Esto hace que el brazo se extienda y luego regrese a la posición inicial.
        const reachFactor = Math.sin(progress * Math.PI); 

        // Ángulos objetivo (negativos para "levantar" el brazo hacia adelante)
        const armReachAngle = -1.4;  // Brazo casi recto hacia adelante (aprox -80 grados)
        const elbowBendAngle = -0.7; // Ligera flexión del codo

        if (playerMesh.userData.armRight) {
            playerMesh.userData.armRight.rotation.x = reachFactor * armReachAngle;
        }
        if (playerMesh.userData.lowerArmRight) {
            playerMesh.userData.lowerArmRight.rotation.x = reachFactor * elbowBendAngle;
        }

        // ¡Importante! No se modifica nada más (pelvis, piernas, torso, brazo izq).
        // Seguirán la animación de la capa base (caminar o reposo).
    }
}


/**
 * Actualiza la animación del jugador basándose en su estado.
 * ¡¡¡REFACTORIZADO v14!!!
 * @param {THREE.Group} playerMesh - El grupo de mallas del jugador.
 * @param {object} playerState - El objeto del jugador de 'getVisibleObjects' (con vx, vy, z).
 */
export function updatePlayerAnimation(playerMesh, playerState, deltaTime) {

    // --- 1. RESETEAR A POSE BASE (T-Pose) ---
    // Prepara el esqueleto para la animación de este frame.
    resetToIdle(playerMesh);

    // --- 2. CALCULAR LOCOMOCIÓN (CAPA BASE) ---
    // Decide si aplicar la animación de caminar o de reposo.
    const speed = Math.sqrt(playerState.vx * playerState.vx + playerState.vy * playerState.vy);
    const isMoving = speed > 1.0;

    if (isMoving) {
        // Aplicar movimiento de piernas, brazos y rebote
        applyWalkAnimation(playerMesh, deltaTime);
    } else {
        // Aplicar respiración sutil
        walkTime = 0; // Resetear el tiempo de caminar
        applyIdleAnimation(playerMesh, deltaTime);
    }

    // --- 3. APLICAR ACCIÓN (CAPA SUPERIOR) ---
    // Si hay una acción, se aplica *después* de la locomoción.
    // Sobrescribirá las partes del cuerpo necesarias.
    if (player.currentAction && player.actionTimer > 0) {
        updateActionAnimation(playerMesh, player.currentAction, player.actionTimer);
    }

    // --- 4. APLICAR POSICIÓN GLOBAL (Z-Level) ---
    // Esto mueve el 'playerGroup' raíz (el suelo del jugador).
    const worldYLevel = (playerState.z * TILE_PX_HEIGHT);
    playerMesh.position.y = worldYLevel;
}


/**
 * Aplica una animación de "respiración" sutil al modelo del jugador.
 * (Función para el Modal de inventario/personaje)
 * @param {THREE.Group} playerMesh
 * (Lógica de respiración ahora centralizada en applyIdleAnimation)
 */
export function updatePlayerModalAnimation(playerMesh, deltaTime) {
    if (!playerMesh || !playerMesh.userData.torso) return;

    // Resetear pose
    resetToIdle(playerMesh);

    // Aplicar la misma animación de reposo que en el juego
    applyIdleAnimation(playerMesh, deltaTime);
}