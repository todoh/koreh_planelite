// --- player_system.js ---
// Gestiona toda la lógica relacionada con el jugador:
// movimiento, manejo de input, e interacción.
import { 
    player, 
    stats,
    ENTITY_DATA,
    TERRAIN_DATA, 
    ITEM_DEFINITIONS,
    PLAYER_SPEED,
    TILE_PX_WIDTH,
    TILE_PX_HEIGHT, 
    openMenuCallback,
    CHUNK_PX_WIDTH,
    CHUNK_PX_HEIGHT,
    CHUNK_GRID_WIDTH,  // <-- ¡AÑADIR ESTA!
    CHUNK_GRID_HEIGHT // <-- ¡Y ESTA!
} from './logic.js';
import { 
    findEntityByUid, 
    getChunkKeyForEntity,
    getActiveChunk,
    recordDelta, // <--- ¡AÑADE ESTA LÍNEA!
    recordDeltaFromEntity,
    getMapTileKey,
    findEntityAt
} from './world.js';
import { checkCollision } from './collision.js';
// ¡Imports modificados/añadidos!
import { getInventory, removeItem, addItem } from './inventory.js';
import * as VehicleSystem from './vehicle_logic.js';
import { createEntity } from './entity.js';
import { renderHotbar } from './ui.js';


// --- ¡NUEVA IMPORTACIÓN! ---
// import { findPath } from './pathfinder.js'; // <-- Comentado

// --- ¡NUEVAS VARIABLES! ---
// let pathRecalculateTimer = 0; // <-- Comentado
// const PATH_RECALCULATE_DELAY = 250; // ms (Recalcular path cada 1/4 de segundo si se mantiene pulsado) // <-- Comentado
// --- FIN DE NUEVAS VARIABLES ---


/**
 * Busca una posición segura adyacente para desmontar.
 */
function findSafeDismountPos(startX, startY) {
    const offsets = [
        { x: 0, y: TILE_PX_WIDTH }, 
        { x: -TILE_PX_WIDTH, y: 0 }, 
        { x: TILE_PX_WIDTH, y: 0 }, 
        { x: 0, y: -TILE_PX_WIDTH },
    ];

    for (const offset of offsets) {
        const newX = startX + offset.x;
        const newY = startY + offset.y;
        // checkCollision usa player.z por defecto, lo cual es correcto
        if (!checkCollision(newX, newY).solid) {
            return { x: newX, y: newY };
        }
    }
    // Si no hay sitio, bajar en la misma posición (puede ser problemático)
    return { x: startX, y: startY };
}

/**
 * Actualiza la posición del jugador basándose en el input.
 * Se llama en cada frame desde main.js.
 */
export function updatePlayer(deltaTime, input) {
    let message = null;
    
    // --- ¡LÓGICA DE MOVIMIENTO REESCRITA! ---
    
    // 0. Actualizar timer
    // if (pathRecalculateTimer > 0) { // <-- Comentado
    //     pathRecalculateTimer -= deltaTime * 1000;
    // }

    // 1. Movimiento por Pathfinding (tiene prioridad)
    // if (player.pathWaypoints.length > 0) { // <-- Comentado
        // Detener input de teclado si estamos siguiendo un path
        // input.up = input.down = input.left = input.right = false;
        
        // const targetWaypoint = player.pathWaypoints[0];
        // const dx = targetWaypoint.x - player.x;
        // const dy = targetWaypoint.y - player.y;
        // const distance = Math.sqrt(dx*dx + dy*dy);

        // const arrivalRadius = 10; // Radio para considerar que hemos llegado

        // if (distance < arrivalRadius) {
        //     player.pathWaypoints.shift(); // Llegamos, quitamos el waypoint
        //     if (player.pathWaypoints.length === 0) { // ¿Camino terminado?
        //         player.vx = 0;
        //         player.vy = 0;
        //     }
        // } else {
        //     // Moverse hacia el waypoint
        //     player.vx = (dx / distance) * player.currentSpeed;
        //     player.vy = (dy / distance) * player.currentSpeed;
        // }
        
    // }
    // 2. Movimiento por Teclado (solo si no hay path)
    if (input.up || input.down || input.left || input.right) {
        // --- ¡AÑADIDO! Detener movimiento de clic si usamos teclado ---
        player.isMovingToTarget = false;
        // --- FIN DE AÑADIDO ---
        let baseVx = 0, baseVy = 0;
        
        if (input.left) baseVx = -1;
        else if (input.right) baseVx = 1;
        if (input.up) baseVy = -1;
        else if (input.down) baseVy = 1;

        if (baseVx !== 0 && baseVy !== 0) {
            baseVx /= Math.SQRT2;
            baseVy /= Math.SQRT2;
        }

        player.vx = baseVx * player.currentSpeed;
        player.vy = baseVy * player.currentSpeed;
    } 
    // --- ¡AÑADIDO! Lógica de clic-to-move (recto) ---
    else if (player.isMovingToTarget) {
        // Moverse hacia el objetivo (clic)
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const distance = Math.sqrt(dx*dx + dy*dy);

        if (distance < 10) { // Cerca del objetivo
            player.isMovingToTarget = false;
            player.vx = 0; player.vy = 0;
        } else {
            player.vx = (dx / distance) * player.currentSpeed;
            player.vy = (dy / distance) * player.currentSpeed;
        }
    }
    // --- FIN DE AÑADIDO ---
    
    // 3. Sin input
    else {
        player.vx = 0; player.vy = 0;
    }
    // --- FIN DE LÓGICA DE MOVIMIENTO REESCRITA ---


    // 2. Aplicar movimiento y colisión
    if (player.vx !== 0 || player.vy !== 0) {
        let newX = player.x + player.vx * deltaTime;
        let newY = player.y + player.vy * deltaTime;

        // checkCollision usa player.z por defecto, ¡correcto!
        // Comprobar colisión en X
        if (!checkCollision(newX, player.y).solid) {
            player.x = newX;
        } else {
             // player.pathWaypoints = []; // ¡Detener path si chocamos! // <-- Comentado
             player.isMovingToTarget = false; // <-- ¡AÑADIDO!
        }
        
        // Comprobar colisión en Y
        if (!checkCollision(player.x, newY).solid) {
            player.y = newY;
        } else {
             // player.pathWaypoints = []; // ¡Detener path si chocamos! // <-- Comentado
             player.isMovingToTarget = false; // <-- ¡AÑADIDO!
        }
        
        // 3. Actualizar dirección (facing)
        if (player.vx !== 0 || player.vy !== 0) {
        // Actualizar rotación Y (para 3D)
        player.rotationY = Math.atan2(player.vx, player.vy);

        // Actualizar 'facing' (para 2D o interacciones)
        if (Math.abs(player.vx) > Math.abs(player.vy)) {
            player.facing = player.vx > 0 ? 'right' : 'left';
        } else {
            player.facing = player.vy > 0 ? 'down' : 'up';
        }
    }
    }
    
    // 4. Sincronizar vehículo si estamos montados
    if (player.mountedVehicleUid) {
        const vehicle = findEntityByUid(player.mountedVehicleUid);
        if (vehicle) {
            if (vehicle.z !== player.z) {
                 console.error(`¡ERROR DE Z! Jugador (z=${player.z}) montado en vehículo (z=${vehicle.z})`);
            }
            
            const oldVehicleChunkKey = getChunkKeyForEntity(vehicle);
            vehicle.x = player.x;
            vehicle.y = player.y; 
            vehicle.facing = player.facing; // Sincronizar dirección
            const newVehicleChunkKey = getChunkKeyForEntity(vehicle);

            recordDelta(oldVehicleChunkKey, { type: 'MOVE_ENTITY', uid: vehicle.uid, x: vehicle.x, y: vehicle.y });
            
            if (oldVehicleChunkKey !== newVehicleChunkKey) {
                // Esta lógica ahora se maneja en 'moveEntityToNewChunk'
                // pero necesitamos registrar el delta en el chunk antiguo (hecho arriba)
                // y la lógica de movimiento se encargará del resto.
                // Sin embargo, `moveEntityToNewChunk` no es llamado aquí.
                // ¡ERROR EN LÓGICA ANTIGUA! La entidad debe moverse explícitamente.
                console.warn("Movimiento de vehículo entre chunks no implementado en refactor aún.");
                // NOTA: La lógica original tampoco movía la entidad entre chunks aquí,
                // solo marcaba el chunk antiguo como sucio.
            }
        } else {
            console.warn(`Vehiculo ${player.mountedVehicleUid} no encontrado, desmontando.`);
            VehicleSystem.dismountVehicle(player, null, PLAYER_SPEED, findSafeDismountPos, getChunkKeyForEntity, (key) => recordDelta(key, {}));
        }
    }

    // 5. Sistema "OnEnter" (Collectible)
    const chunkX = Math.floor(player.x / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(player.y / CHUNK_PX_HEIGHT);
    const chunkKey = `${chunkX},${chunkY},${player.z}`; // <-- ¡USAR Z!
    const chunk = getActiveChunk(chunkKey);
    
    if(chunk) {
        for (let i = chunk.entities.length - 1; i >= 0; i--) {
            const entity = chunk.entities[i];
            const comp = entity.components.Collectible;
            
            if (comp) {
                const dx = player.x - entity.x;
                const dy = player.y - entity.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const enterRadius = TILE_PX_WIDTH / 2; 
                
                if (distance < enterRadius) {
                    addItem(comp.itemId, comp.quantity);
                    recordDeltaFromEntity(entity, { type: 'REMOVE_ENTITY', uid: entity.uid });
                    const itemDef = ITEM_DEFINITIONS[comp.itemId];
                    message = `¡Has recogido ${comp.quantity} de ${itemDef.name}!`;
                }
            }
        }
    }
    // 6. Encontrar el objetivo más cercano para resaltar (PARA EL CÍRCULO AZUL)
    const HOVER_RANGE = TILE_PX_WIDTH * 2; // Rango de 2 tiles
    let closestEntity = null;
    let minDistance = HOVER_RANGE;

    // --- ¡OPTIMIZACIÓN! ---
    // Solo comprobar chunks cercanos (3x3)
    // (Optimización simple: por ahora solo el chunk actual)
    const playerChunk = getActiveChunk(getChunkKeyForEntity(player));
    
    if (playerChunk) {
        for (const entity of playerChunk.entities) {
            // Comprobar si es interactuable (¡ignora el vehículo que estás montando!)
            if (entity.uid === player.mountedVehicleUid) continue;
            
            const isInteractable = entity.components.InteractableResource || 
                                 entity.components.InteractableDialogue ||
                                 entity.components.InteractableMenu ||
                                 entity.components.InteractableVehicle ||
                                 entity.components.InteractableLevelChange;

            if (isInteractable) {
                const dx = player.x - entity.x;
                const dy = player.y - entity.y;
                const distance = Math.sqrt(dx*dx + dy*dy);

                if (distance < minDistance) {
                    minDistance = distance;
                    closestEntity = entity;
                }
            }
        }
    }
    // --- FIN DE OPTIMIZACIÓN ---
    
    // Actualizar el estado global
    player.hoveredEntityUID = closestEntity ? closestEntity.uid : null;
    return { message };
}

// --- ¡REEMPLAZAR handleWorldTap CON ESTAS TRES FUNCIONES! ---

/**
 * ¡REESCRITO! Maneja el INICIO de un clic/pulsación en el mundo.
 * Ahora actúa como un "router" para construir, terraformar o interactuar.
 */
export function handleWorldHold(worldX, worldY) {
    
    // --- ¡NUEVO! Definir la caja de colisión para placement ---
    // Una caja pequeña centrada en los pies (el ancla) del tile.
    const PLACEMENT_COLLISION_BOX = { width: 10, height: 10, offsetY: 5 };

    // 1. Obtener el item activo del Hotbar
    const inventory = getInventory();
    const activeItem = inventory[player.activeHotbarSlot];
    const itemDef = activeItem ? ITEM_DEFINITIONS[activeItem.itemId] : null;

    // --- MODO: Construcción (Paredes/Entidades) ---
    // if (itemDef && itemDef.buildable_entity) { // <-- LÍNEA ANTIGUA
    if (itemDef && itemDef.buildable_entity && activeItem.itemId !== 'HAND') { // <-- ¡LÍNEA MODIFICADA!
        player.isMovingToTarget = false; // Detener movimiento
        
        // 2. Alinear a la cuadrícula (snap-to-grid)
        const gridX = Math.floor(worldX / TILE_PX_WIDTH);
        const gridY = Math.floor(worldY / TILE_PX_HEIGHT);
        const placeX = (gridX * TILE_PX_WIDTH) + (TILE_PX_WIDTH / 2);
        const placeY = (gridY * TILE_PX_HEIGHT) + (TILE_PX_HEIGHT / 2);

        // 3. Comprobar colisión
        // --- CÓDIGO MODIFICADO ---
        const collision = checkCollision(placeX, placeY, null, PLACEMENT_COLLISION_BOX);
        if (collision.solid) {
            return { message: "No puedes construir ahí." };
        }

        // 4. Crear entidad
        const entityToBuild = itemDef.buildable_entity;
        const newUid = `placed_${placeX}_${placeY}_${player.z}`; // UID simple
        const newEntity = createEntity(entityToBuild, placeX, placeY, player.z, newUid);
        
        if (!newEntity) {
            return { message: "Error al crear la entidad." };
        }
        
        const chunkKey = getChunkKeyForEntity(newEntity);
        recordDelta(chunkKey, { type: 'ADD_ENTITY', entity: newEntity });

        // 5. Consumir item
        removeItem(activeItem.itemId, 1);
        renderHotbar(); // Actualizar UI
        
        return { message: `Has colocado: ${itemDef.name}.` };
    }

    // --- MODO: Terraformación (Suelo) ---
    // if (itemDef && itemDef.terraform_tile) { // <-- LÍNEA ANTIGUA
    if (itemDef && itemDef.terraform_tile && activeItem.itemId !== 'HAND') { // <-- ¡LÍNEA MODIFICADA!
        player.isMovingToTarget = false; // Detener movimiento
        
        const gridX = Math.floor(worldX / TILE_PX_WIDTH);
        const gridY = Math.floor(worldY / TILE_PX_HEIGHT);
        const placeX = (gridX * TILE_PX_WIDTH) + (TILE_PX_WIDTH / 2);
        const placeY = (gridY * TILE_PX_HEIGHT) + (TILE_PX_HEIGHT / 2);

        // 3. Comprobar colisión (no se puede terraformar bajo un objeto)
        // --- CÓDIGO MODIFICADO ---
        const collision = checkCollision(placeX, placeY, null, PLACEMENT_COLLISION_BOX);
        if (collision.solid) {
            return { message: "Hay algo que bloquea el suelo." };
        }

        // 4. Modificar terreno
        const chunkX = Math.floor(placeX / CHUNK_PX_WIDTH);
        const chunkY = Math.floor(placeY / CHUNK_PX_HEIGHT);
        const chunkKey = `${chunkX},${chunkY},${player.z}`;
        
        const localX = ((gridX % CHUNK_GRID_WIDTH) + CHUNK_GRID_WIDTH) % CHUNK_GRID_WIDTH;
        const localY = ((gridY % CHUNK_GRID_HEIGHT) + CHUNK_GRID_HEIGHT) % CHUNK_GRID_HEIGHT;
        
        recordDelta(chunkKey, { 
            type: 'CHANGE_TILE', 
            localCoord: `${localX},${localY}`, 
            tileKey: itemDef.terraform_tile
        });

        // 5. Consumir item
        removeItem(activeItem.itemId, 1);
        renderHotbar(); // Actualizar UI

        return { message: `Has colocado: ${itemDef.name}.` };
    }
    
    // --- MODO: Interacción/Movimiento (Lógica original) ---
    // (Si el item es un pico, hacha, o manos vacías)
    
    if (player.mountedVehicleUid) {
        // Intento de desmontar (clic en sí mismo)
        const dx = worldX - player.x;
        const dy = worldY - player.y;
        const distSq = dx*dx + dy*dy;
        const playerClickRadius = TILE_PX_WIDTH * 0.7; 
        
        if (distSq < (playerClickRadius * playerClickRadius)) {
            const vehicle = findEntityByUid(player.mountedVehicleUid);
            VehicleSystem.dismountVehicle(player, vehicle, PLAYER_SPEED, findSafeDismountPos, getChunkKeyForEntity, (key) => recordDelta(key, {}));
            return { message: "Te has bajado del vehículo." };
        }
    }

    // --- ¡MODIFICACIÓN REVERTIDA! ---
    // Volvemos a la lógica original.
    // El 'if (player.hoveredEntityUID)' se elimina,
    // porque impedía el movimiento si un círculo estaba activo.
    /*
    if (player.hoveredEntityUID) {
        const targetEntity = findEntityByUid(player.hoveredEntityUID);

        if (targetEntity) {
            // 1. Clic para interactuar con la entidad seleccionada (círculo azul)
            player.isMovingToTarget = false;
            player.vx = 0; player.vy = 0;

            const dx = player.x - targetEntity.x;
            const dy = player.y - targetEntity.y;
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance < TILE_PX_WIDTH * 1.5) { // Rango de interacción
                return playerInteract(targetEntity);
            } else {
                return { message: "Estás demasiado lejos." };
            }
        }
    }
    */
    // --- FIN DE MODIFICACIÓN ---

    // 2. Clic en el Terreno (si no estábamos apuntando a nada)
    // --- ¡LÓGICA ORIGINAL RESTAURADA! ---
    const target = findEntityAt(worldX, worldY); // <-- Esta línea busca BAJO EL CURSOR
    if (target) { // <-- Si encuentra algo BAJO EL CURSOR
        // 1. Clic en Entidad Interactuable (debajo del cursor)
        player.isMovingToTarget = false; // Detener movimiento
        player.vx = 0; player.vy = 0;
        
        const dx = player.x - target.entity.x;
        const dy = player.y - target.entity.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < TILE_PX_WIDTH * 1.5) { // Rango de interacción
            return playerInteract(target.entity);
        } else {
            return { message: "Estás demasiado lejos." };
        }
    }
    // --- FIN DE LÓGICA RESTAURADA ---

    const gridX = Math.floor(worldX / TILE_PX_WIDTH);
    const gridY = Math.floor(worldY / TILE_PX_HEIGHT);
    const groundTileKey = getMapTileKey(gridX, gridY, player.z);

    if (TERRAIN_DATA[groundTileKey]?.solid) {
        return { message: "No puedes caminar ahí." };
    }
    
    // 3. Moverse al punto (¡Lógica simple en línea recta!)
    // const newPath = findPath(player.x, player.y, worldX, worldY, player.z); // <-- Comentado
    
    // if (newPath && newPath.length > 0) { // <-- Comentado
    //     player.pathWaypoints = newPath;
    // } else {
    //     return { message: "No se puede encontrar una ruta." };
    // }
    
    // player.isHoldingMove = true; // Marcar que estamos manteniendo pulsado // <-- Comentado
    // pathRecalculateTimer = PATH_RECALCULATE_DELAY; // Iniciar cooldown // <-- Comentado

    // --- ¡AÑADIDO! Lógica simple ---
    player.isMovingToTarget = true;
    player.targetX = worldX;
    player.targetY = worldY;
    // --- FIN DE AÑADIDO ---

    return { message: null }; // Fallback
}

/**
 * Maneja el MOVIMIENTO de un clic/pulsación en el mundo.
 * Se llama desde main.js (processHoldMove).
 */
export function handleWorldMove(worldX, worldY) {
    // --- ¡LÓGICA REESCRITA! ---

    // --- MODO: Construcción o Terraformación (con item activo) ---
    const inventory = getInventory();
    const activeItem = inventory[player.activeHotbarSlot];
    const itemDef = activeItem ? ITEM_DEFINITIONS[activeItem.itemId] : null;

    if (itemDef && (itemDef.buildable_entity || itemDef.terraform_tile) && activeItem.itemId !== 'HAND') {
        // Si estamos construyendo, "pintar" en el mundo
        // (Llamar a handleWorldHold de nuevo simula un nuevo clic en la nueva posición)
        handleWorldHold(worldX, worldY);
        return;
    }
    // --- FIN DE MODO CONSTRUCCIÓN ---


    // Si nos estamos moviendo (porque hemos pulsado), actualizar el destino.
    if (player.isMovingToTarget) {
        // Comprobar si el destino es válido (no sólido)
        const gridX = Math.floor(worldX / TILE_PX_WIDTH);
        const gridY = Math.floor(worldY / TILE_PX_HEIGHT);
        if (TERRAIN_DATA[getMapTileKey(gridX, gridY, player.z)]?.solid) {
            player.isMovingToTarget = false; // Detener si movemos a un muro
            return; 
        }
        
        // Actualizar destino
        player.targetX = worldX;
        player.targetY = worldY;
    }
    // --- FIN DE LÓGICA REESCRITA ---
}

/**
 * Maneja el FIN de un clic/pulsación en el mundo.
 * Se llama desde main.js (processHoldEnd).
 * --- ¡MODIFICADO! ---
 * @param {boolean} didMove - true si el cursor/dedo se movió desde el 'start'.
 */
export function handleWorldRelease(didMove) { // <-- Aceptar argumento
    // --- ¡LÓGICA REESCRITA! ---
    // player.isHoldingMove = false; // <-- Comentado
    
    // Si el usuario movió el cursor (fue un "drag" o "hold-to-move"),
    // detenemos el movimiento al soltar.
    if (didMove) {
        
        // --- ¡NUEVO! Comprobar si estábamos construyendo ---
        const inventory = getInventory();
        const activeItem = inventory[player.activeHotbarSlot];
        const itemDef = activeItem ? ITEM_DEFINITIONS[activeItem.itemId] : null;

        if (itemDef && (itemDef.buildable_entity || itemDef.terraform_tile) && activeItem.itemId !== 'HAND') {
            // Si estábamos construyendo, no hacer nada más
        } else {
             // Si estábamos moviéndonos, detener
            player.isMovingToTarget = false;
            player.vx = 0;
            player.vy = 0;
        }

    }
    // Si no (didMove == false), fue un "tap" o "click".
    // NO HACEMOS NADA.
    // `player.isMovingToTarget` seguirá siendo 'true' (de handleWorldHold)
    // y el bucle `updatePlayer` seguirá moviendo al jugador
    // hasta que llegue al `player.targetX/Y`.
    // (O, si fue un clic de interacción, `isMovingToTarget` ya se puso a 'false')
    // --- FIN DE LÓGICA REESCRITA! ---
}
 


/**
 * Maneja una acción de interacción (tecla Espacio o clic).
 * Se llama desde main.js o handleWorldTap.
 */
export function playerInteract(targetEntity = null) {
    
    // --- ¡AÑADIDO! ---
    // Detener cualquier movimiento de pathfinding si interactuamos
    // player.pathWaypoints = []; // <-- Comentado
    player.isMovingToTarget = false; // <-- ¡AÑADIDO!
    player.vx = 0;
    player.vy = 0;
    // player.isHoldingMove = false; // <-- Comentado
    // --- FIN DE AÑADIDO ---
    
    if (player.mountedVehicleUid) {
        const vehicle = findEntityByUid(player.mountedVehicleUid);
        VehicleSystem.dismountVehicle(player, vehicle, PLAYER_SPEED, findSafeDismountPos, getChunkKeyForEntity, (key) => recordDelta(key, {}));
        return { message: "Te has bajado del vehículo." };
    }

    let entityToInteract = targetEntity;

    // 1. Si no hay objetivo (tecla Espacio), buscar uno en frente
    if (!entityToInteract) {
        let targetX = player.x, targetY = player.y;
        const reach = TILE_PX_WIDTH * 1.5;

        if (player.facing === 'up') targetY -= reach;
        if (player.facing === 'down') targetY += reach;
        if (player.facing === 'left') targetX -= reach;
        if (player.facing === 'right') targetX += reach;

        let closestDist = Infinity;
        
        // Reutilizamos findEntityAt, pero es menos preciso que el bucle original
        // Volvamos al bucle original para la interacción por 'facing'
        const chunkX = Math.floor(player.x / CHUNK_PX_WIDTH);
        const chunkY = Math.floor(player.y / CHUNK_PX_HEIGHT);
        const chunkKey = `${chunkX},${chunkY},${player.z}`;
        const chunk = getActiveChunk(chunkKey);
        // NOTA: Esto solo comprueba el chunk actual, puede fallar en los bordes
        
        if (chunk) {
            for (const entity of chunk.entities) {
                if (!entity.components.InteractableResource &&
                    !entity.components.InteractableDialogue &&
                    !entity.components.InteractableMenu &&
                    !entity.components.InteractableVehicle &&
                    !entity.components.InteractableLevelChange) { 
                    continue; 
                }
                
                const colComp = entity.components.Collision;
                if (!colComp) continue;

                const dx = entity.x - targetX;
                const dy = entity.y - targetY;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                const interactRadius = (colComp.collisionBox?.width || TILE_PX_WIDTH) * 0.8; 
                
                if (distance < interactRadius && distance < closestDist) {
                    closestDist = distance;
                    entityToInteract = entity;
                }
            }
        }
    }
    
    // 2. Procesar la entidad encontrada
    if (entityToInteract) {
        const comps = entityToInteract.components;
        
        // --- Sistema de Interacción: Prioridad de componentes ---

        // A. ¿Es un cambio de nivel?
        if (comps.InteractableLevelChange) {
            const dir = comps.InteractableLevelChange.direction;
            let message = "";
            if (dir === 'down') {
                player.z -= 1;
                message = "Bajas por la escalera.";
            } else if (dir === 'up') {
                if (player.z === -1) { 
                     player.z = 0;
                } else {
                     player.z += 1;
                }
                message = "Subes por la escalera.";
            }
            // Forzar recarga de chunks (se hará en el próximo 'update' de main)
            return { message: message };
        }

        // B. ¿Es un Vehiculo?
        if (comps.InteractableVehicle && comps.Vehicle) {            
            VehicleSystem.mountVehicle(player, entityToInteract, (key) => recordDelta(key, {}), getChunkKeyForEntity);
            const entityDef = ENTITY_DATA[entityToInteract.key];
            return { message: `Te has montado en: ${entityDef.name}.` };
        }

        // C. ¿Es un Recurso?
        if (comps.InteractableResource) {
            const comp = comps.InteractableResource;
            if (stats.energia >= comp.energyCost) {
                // La importación de addItem está local a esta función
                addItem(comp.itemId, comp.quantity);
                stats.energia -= comp.energyCost;
                recordDeltaFromEntity(entityToInteract, { type: 'REMOVE_ENTITY', uid: entityToInteract.uid });
                const itemDef = ITEM_DEFINITIONS[comp.itemId];
                return { message: `Has conseguido ${comp.quantity} de ${itemDef.name}.` };
            } else {
                return { message: "No tienes suficiente energía." };
            }
        }
        
        // D. ¿Es un Menú?
        if (comps.InteractableMenu) {
            const comp = comps.InteractableMenu;
            openMenuCallback(comp.menuId); 
            const entityDef = ENTITY_DATA[entityToInteract.key];
            return { message: `Abriendo ${entityDef.name}...` };
        }

        // E. ¿Es un Diálogo?
        if (comps.InteractableDialogue) {
            const comp = comps.InteractableDialogue;
            if (Array.isArray(comp.message)) {
                return { message: comp.message[0] || "..." };
            }
            return { message: comp.message };
        }
    }

    return { message: "No hay nada con qué interactuar ahí." };
}