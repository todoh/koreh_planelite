// --- player_system.js ---
// Gestiona toda la lógica relacionada con el jugador:
// movimiento, manejo de input, e interacción.
// ¡MODIFICADO! Interacción ahora activa animaciones.
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
    findEntityAt,
    moveEntityToNewChunk
} from './world.js';
import { checkCollision } from './collision.js';
// ¡Imports modificados/añadidos!
import { getInventory, removeItem, addItem } from './inventory.js';
import * as VehicleSystem from './vehicle_logic.js';
import { createEntity } from './entity.js';
import { renderHotbar } from './ui.js';
// --- ¡NUEVO! Importar duraciones de animación ---
import { CHOP_DURATION, PICKUP_DURATION } from './player_animation.js';


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
    
    // --- ¡NUEVO! Sistema de Finalización de Acción ---
    if (player.currentAction) {
        player.actionTimer -= deltaTime;

        // Detener cualquier movimiento mientras se realiza una acción
        input.up = input.down = input.left = input.right = false;
        player.isMovingToTarget = false;
        player.vx = 0;
        player.vy = 0;

        if (player.actionTimer <= 0) {
            // ¡Animación terminada! Completar la acción.
            const targetEntity = findEntityByUid(player.actionTarget);
            
            if (targetEntity && targetEntity.components.InteractableResource) {
                const comp = targetEntity.components.InteractableResource;
                
                if (stats.energia >= comp.energyCost) {
                    // 1. Dar item
                    addItem(comp.itemId, comp.quantity);
                    // 2. Costar energía
                    stats.energia -= comp.energyCost;
                    // 3. Eliminar la entidad del mundo
                    recordDeltaFromEntity(targetEntity, { type: 'REMOVE_ENTITY', uid: targetEntity.uid });
                    
                    const itemDef = ITEM_DEFINITIONS[comp.itemId];
                    message = `¡Has conseguido ${comp.quantity} de ${itemDef.name}!`;
                } else {
                    message = "No tienes suficiente energía.";
                }
            } else {
                // El objetivo desapareció o era inválido
                if (player.actionTarget) { // Evitar spam si solo fue una animación sin objetivo
                    message = "El objetivo ya no está.";
                }
            }
            
            // 4. Resetear estado de acción
            player.currentAction = null;
            player.actionTarget = null;
        }
    }
    // --- FIN DE NUEVO SISTEMA ---


    // --- ¡LÓGICA DE MOVIMIENTO REESCRITA! ---
    
    // 1. Movimiento por Teclado (solo si no hay acción)
    if (!player.currentAction && (input.up || input.down || input.left || input.right)) {
        player.isMovingToTarget = false;
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
    // 2. Lógica de clic-to-move (solo si no hay acción)
    else if (!player.currentAction && player.isMovingToTarget) {
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
    // 3. Sin input (o realizando acción)
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
             player.isMovingToTarget = false; // <-- ¡AÑADIDO!
        }
        
        // Comprobar colisión en Y
        if (!checkCollision(player.x, newY).solid) {
            player.y = newY;
        } else {
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
            vehicle.rotationY = player.rotationY; // Sincronizar rotación 3D
            const newVehicleChunkKey = getChunkKeyForEntity(vehicle);

            recordDelta(oldVehicleChunkKey, { type: 'MOVE_ENTITY', uid: vehicle.uid, x: vehicle.x, y: vehicle.y });
            
            if (oldVehicleChunkKey !== newVehicleChunkKey) {
                moveEntityToNewChunk(vehicle, oldVehicleChunkKey, newVehicleChunkKey);
            }
        } else {
            console.warn(`Vehiculo ${player.mountedVehicleUid} no encontrado, desmontando.`);
            VehicleSystem.dismountVehicle(player, null, PLAYER_SPEED, findSafeDismountPos, getChunkKeyForEntity, (key) => recordDelta(key, {}));
        }
    }

    // 5. Sistema "OnEnter" (Collectible)
    // --- ¡MODIFICADO! Solo recoger si no estamos ocupados ---
    if (!player.currentAction) {
        const chunkX = Math.floor(player.x / CHUNK_PX_WIDTH);
        const chunkY = Math.floor(player.y / CHUNK_PX_HEIGHT);
        const chunkKey = `${chunkX},${chunkY},${player.z}`; // <-- ¡USAR Z!
        const chunk = getActiveChunk(chunkKey);
        
        if(chunk) {
            for (let i = chunk.entities.length - 1; i >= 0; i--) {
                const entity = chunk.entities[i];
                if (!entity) continue; // Seguridad
                const comp = entity.components.Collectible;
                
                if (comp) {
                    const dx = player.x - entity.x;
                    const dy = player.y - entity.y;
                    const distance = Math.sqrt(dx*dx + dy*dy);
                    const enterRadius = TILE_PX_WIDTH / 2; 
                    
                    if (distance < enterRadius) {
                        // --- ¡MODIFICADO! Activar animación de recoger ---
                        player.currentAction = 'pickup';
                        player.actionTimer = PICKUP_DURATION;
                        player.actionTarget = entity.uid;
                        // ¡Ya no damos el item aquí! Se dará cuando termine la animación.
                        // message = `Recogiendo ${ITEM_DEFINITIONS[comp.itemId].name}...`;
                        // Romper el bucle para solo recoger una cosa a la vez
                        break; 
                    }
                }
            }
        }
    } // --- FIN DE MODIFICACIÓN (OnEnter) ---

    // 6. Encontrar el objetivo más cercano para resaltar (PARA EL CÍRCULO AZUL)
    const HOVER_RANGE = TILE_PX_WIDTH * 2; // Rango de 2 tiles
    let closestEntity = null;
    let minDistance = HOVER_RANGE;

    // (Solo buscar si no estamos ocupados)
    if (!player.currentAction) {
        const playerChunk = getActiveChunk(getChunkKeyForEntity(player));
        
        if (playerChunk) {
            for (const entity of playerChunk.entities) {
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
    } // --- FIN DE MODIFICACIÓN (Hover) ---
    
    player.hoveredEntityUID = closestEntity ? closestEntity.uid : null;
    return { message };
}

// --- ¡REEMPLAZAR handleWorldTap CON ESTAS TRES FUNCIONES! ---

/**
 * ¡REESCRITO! Maneja el INICIO de un clic/pulsación en el mundo.
 * Ahora actúa como un "router" para construir, terraformar o interactuar.
 */
export function handleWorldHold(worldX, worldY) {
    
    // --- ¡NUEVO! Comprobar si ya estamos ocupados ---
    if (player.currentAction) {
        return { message: "Ocupado..." };
    }

    const PLACEMENT_COLLISION_BOX = { width: 10, height: 10, offsetY: 5 };
    const inventory = getInventory();
    const activeItem = inventory[player.activeHotbarSlot];
    const itemDef = activeItem ? ITEM_DEFINITIONS[activeItem.itemId] : null;

    // --- MODO: Construcción (Paredes/Entidades) ---
    if (itemDef && itemDef.buildable_entity && activeItem.itemId !== 'HAND') { 
        player.isMovingToTarget = false; 
        
        const gridX = Math.floor(worldX / TILE_PX_WIDTH);
        const gridY = Math.floor(worldY / TILE_PX_HEIGHT);
        const placeX = (gridX * TILE_PX_WIDTH) + (TILE_PX_WIDTH / 2);
        const placeY = (gridY * TILE_PX_HEIGHT) + (TILE_PX_HEIGHT / 2);

        const collision = checkCollision(placeX, placeY, null, PLACEMENT_COLLISION_BOX);
        if (collision.solid) {
            return { message: "No puedes construir ahí." };
        }

        const entityToBuild = itemDef.buildable_entity;
        const newUid = `placed_${placeX}_${placeY}_${player.z}`; 
        const newEntity = createEntity(entityToBuild, placeX, placeY, player.z, newUid);
        
        if (!newEntity) {
            return { message: "Error al crear la entidad." };
        }
        
        const chunkKey = getChunkKeyForEntity(newEntity);
        recordDelta(chunkKey, { type: 'ADD_ENTITY', entity: newEntity });

        removeItem(activeItem.itemId, 1);
        renderHotbar(); 
        
        return { message: `Has colocado: ${itemDef.name}.` };
    }

    // --- MODO: Terraformación (Suelo) ---
    if (itemDef && itemDef.terraform_tile && activeItem.itemId !== 'HAND') { 
        player.isMovingToTarget = false; 
        
        const gridX = Math.floor(worldX / TILE_PX_WIDTH);
        const gridY = Math.floor(worldY / TILE_PX_HEIGHT);
        const placeX = (gridX * TILE_PX_WIDTH) + (TILE_PX_WIDTH / 2);
        const placeY = (gridY * TILE_PX_HEIGHT) + (TILE_PX_HEIGHT / 2);

        const collision = checkCollision(placeX, placeY, null, PLACEMENT_COLLISION_BOX);
        if (collision.solid) {
            return { message: "Hay algo que bloquea el suelo." };
        }

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

        removeItem(activeItem.itemId, 1);
        renderHotbar(); 

        return { message: `Has colocado: ${itemDef.name}.` };
    }
    
    // --- MODO: Interacción/Movimiento (Lógica original) ---
    
    if (player.mountedVehicleUid) {
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

    // Clic en Entidad Interactuable (debajo del cursor)
    const target = findEntityAt(worldX, worldY); 
    if (target) { 
        player.isMovingToTarget = false; 
        player.vx = 0; player.vy = 0;
        
        const dx = player.x - target.entity.x;
        const dy = player.y - target.entity.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < TILE_PX_WIDTH * 1.5) { // Rango de interacción
            // --- ¡MODIFICADO! playerInteract AHORA inicia la animación ---
            return playerInteract(target.entity);
        } else {
            return { message: "Estás demasiado lejos." };
        }
    }

    // Clic en el Terreno
    const gridX = Math.floor(worldX / TILE_PX_WIDTH);
    const gridY = Math.floor(worldY / TILE_PX_HEIGHT);
    const groundTileKey = getMapTileKey(gridX, gridY, player.z);

    if (TERRAIN_DATA[groundTileKey]?.solid) {
        return { message: "No puedes caminar ahí." };
    }
    
    // Moverse al punto
    player.isMovingToTarget = true;
    player.targetX = worldX;
    player.targetY = worldY;

    return { message: null }; // Fallback
}

/**
 * Maneja el MOVIMIENTO de un clic/pulsación en el mundo.
 */
export function handleWorldMove(worldX, worldY) {
    // Si estamos ocupados, no hacer nada
    if (player.currentAction) return;

    const inventory = getInventory();
    const activeItem = inventory[player.activeHotbarSlot];
    const itemDef = activeItem ? ITEM_DEFINITIONS[activeItem.itemId] : null;

    if (itemDef && (itemDef.buildable_entity || itemDef.terraform_tile) && activeItem.itemId !== 'HAND') {
        // "Pintar" en el mundo (llamar a la lógica de construcción/terraform)
        handleWorldHold(worldX, worldY);
        return;
    }

    // Si nos estamos moviendo (porque hemos pulsado), actualizar el destino.
    if (player.isMovingToTarget) {
        const gridX = Math.floor(worldX / TILE_PX_WIDTH);
        const gridY = Math.floor(worldY / TILE_PX_HEIGHT);
        if (TERRAIN_DATA[getMapTileKey(gridX, gridY, player.z)]?.solid) {
            player.isMovingToTarget = false; // Detener si movemos a un muro
            return; 
        }
        
        player.targetX = worldX;
        player.targetY = worldY;
    }
}

/**
 * Maneja el FIN de un clic/pulsación en el mundo.
 * @param {boolean} didMove - true si el cursor/dedo se movió desde el 'start'.
 */
export function handleWorldRelease(didMove) {
    
    // Si el usuario movió el cursor (fue un "drag" o "hold-to-move"),
    // detenemos el movimiento al soltar.
    if (didMove) {
        
        const inventory = getInventory();
        const activeItem = inventory[player.activeHotbarSlot];
        const itemDef = activeItem ? ITEM_DEFINITIONS[activeItem.itemId] : null;

        // Si estábamos "pintando" (construyendo), no hacemos nada más
        if (itemDef && (itemDef.buildable_entity || itemDef.terraform_tile) && activeItem.itemId !== 'HAND') {
            // No detener el movimiento (ya estaba detenido)
        } else {
             // Si estábamos moviéndonos, detener
            player.isMovingToTarget = false;
            player.vx = 0;
            player.vy = 0;
        }
    }
    // Si no (didMove == false), fue un "tap" o "click".
    // No hacemos nada, el jugador seguirá moviéndose a su destino.
}
 


/**
 * Maneja una acción de interacción (tecla Espacio o clic).
 * Se llama desde main.js o handleWorldTap.
 * ¡MODIFICADO! Ahora inicia acciones en lugar de ejecutarlas.
 */
export function playerInteract(targetEntity = null) {
    
    // --- ¡NUEVO! Comprobar si ya estamos ocupados ---
    if (player.currentAction) {
        return { message: "Ocupado..." };
    }
    
    // Detener cualquier movimiento
    player.isMovingToTarget = false; 
    player.vx = 0;
    player.vy = 0;
    
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
        
        const chunkX = Math.floor(player.x / CHUNK_PX_WIDTH);
        const chunkY = Math.floor(player.y / CHUNK_PX_HEIGHT);
        const chunkKey = `${chunkX},${chunkY},${player.z}`;
        const chunk = getActiveChunk(chunkKey);
        
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
        const entityKey = entityToInteract.key; // ¡Clave de la entidad!
        
        // --- Sistema de Interacción: Prioridad de componentes ---

        // A. ¿Es un cambio de nivel? (Instantáneo)
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
            return { message: message };
        }

        // B. ¿Es un Vehiculo? (Instantáneo)
        if (comps.InteractableVehicle && comps.Vehicle) {            
            VehicleSystem.mountVehicle(player, entityToInteract, (key) => recordDelta(key, {}), getChunkKeyForEntity);
            const entityDef = ENTITY_DATA[entityToInteract.key];
            return { message: `Te has montado en: ${entityDef.name}.` };
        }

        // C. ¿Es un Recurso? (¡INICIA ANIMACIÓN!)
        if (comps.InteractableResource) {
            
            // --- ¡NUEVA LÓGICA DE ANIMACIÓN! ---
            
            // Comprobar si es un árbol
            if (['TREE','CACTUS', 'ARBOL', 'ACACIA_TREE', 'JUNGLE_TREE', 'SNOW_TREE', 'CASTA_O', 'CEREZO_EN_FLOR'].includes(entityKey)) {
                player.currentAction = 'chop';
                player.actionTimer = CHOP_DURATION;
                player.actionTarget = entityToInteract.uid;
                return { message: "Talando..." };
            }
            // Comprobar si es un objeto del suelo
            else if (['ROCK', 'RAMA_SECA_SUELO', 'PIEDRA', 'RAMA_SECA', 'COGOLOS_MARIHUANA', 'PEPITA_ORO', 'TROZO_CARBON', 'CASTAÑA', 'TOMATE'].includes(entityKey)) {
                 player.currentAction = 'pickup';
                 player.actionTimer = PICKUP_DURATION;
                 player.actionTarget = entityToInteract.uid;
                 return { message: "Recogiendo..." };
            }
            // Fallback para otros recursos (ej. Cactus, Veta de Hierro)
            else {
                 player.currentAction = 'pickup'; // Usar anim de recoger
                 player.actionTimer = PICKUP_DURATION;
                 player.actionTarget = entityToInteract.uid;
                 return { message: "Interactuando..." };
            }
            // --- FIN DE NUEVA LÓGICA ---
        }
        
        // D. ¿Es un Menú? (Instantáneo)
        if (comps.InteractableMenu) {
            const comp = comps.InteractableMenu;
            openMenuCallback(comp.menuId); 
            const entityDef = ENTITY_DATA[entityToInteract.key];
            return { message: `Abriendo ${entityDef.name}...` };
        }

        // E. ¿Es un Diálogo? (Instantáneo)
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