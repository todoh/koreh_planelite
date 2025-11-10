// --- vehicle_logic.js ---
// Contiene la lógica específica para montar y desmontar vehículos.

/**
 * Monta al jugador en un vehiculo.
 * Modifica el estado del jugador y del vehículo.
 * @param {object} player - El objeto 'player' de logic.js
 * @param {object} vehicleEntity - La entidad del vehículo a montar
 * @param {function} addDirtyChunk - Función (chunkKey) => void para marcar el chunk
 * @param {function} getChunkKeyForEntity - Helper de world.js
 */
export function mountVehicle(player, vehicleEntity, addDirtyChunk, getChunkKeyForEntity) {
    const vehicleComp = vehicleEntity.components.Vehicle;
    if (player.mountedVehicleUid || vehicleComp.mountedEntityUid) {
        return; // Ya montado o vehiculo ocupado
    }

    // 1. Actualizar estado
    player.mountedVehicleUid = vehicleEntity.uid;
    player.currentSpeed = vehicleComp.speed;
    vehicleComp.mountedEntityUid = 'PLAYER'; 

    // 2. Sincronizar posicion
    player.x = vehicleEntity.x;
    player.y = vehicleEntity.y;
    player.isMovingToTarget = false;
    player.vx = 0;
    player.vy = 0;

    // 3. Marcar chunk como sucio
    const chunkKey = getChunkKeyForEntity(vehicleEntity);
    addDirtyChunk(chunkKey); // Usamos la función pasada
}

/**
 * Desmonta al jugador del vehiculo.
 * @param {object} player - El objeto 'player' de logic.js
 * @param {object|null} vehicleEntity - La entidad del vehículo (puede ser null si se descargó)
 * @param {number} defaultPlayerSpeed - Constante PLAYER_SPEED
 * @param {function} findSafeDismountPos - Helper de player_system.js
 * @param {function} getChunkKeyForEntity - Helper de world.js
 * @param {function} addDirtyChunk - Función (chunkKey) => void para marcar el chunk
 */
export function dismountVehicle(player, vehicleEntity, defaultPlayerSpeed, findSafeDismountPos, getChunkKeyForEntity, addDirtyChunk) {
    if (vehicleEntity) {
        vehicleEntity.components.Vehicle.mountedEntityUid = null;
        
        // Buscar una posicion segura para bajar
        const safePos = findSafeDismountPos(vehicleEntity.x, vehicleEntity.y);
        
        // Mover al jugador a la posicion segura
        player.x = safePos.x;
        player.y = safePos.y;
        
        const chunkKey = getChunkKeyForEntity(vehicleEntity);
        addDirtyChunk(chunkKey); // Usamos la función pasada
    }
    
    player.mountedVehicleUid = null;
    player.currentSpeed = defaultPlayerSpeed;
}