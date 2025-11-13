// --- structure_generation.js ---
// ¡MODIFICADO V2!
// Genera casas con formas orgánicas (rectángulos unidos)
// y limpia el terreno/entidades antes de construir.

import { createEntity } from './entity.js';
import { 
    CHUNK_GRID_WIDTH, 
    CHUNK_GRID_HEIGHT, 
    TILE_PX_WIDTH, 
    TILE_PX_HEIGHT 
} from './logic.js';
// ¡Importar generador de aleatoriedad de generation.js!
import { seededRandom } from './generation.js';

// --- Constantes del Generador ---
const MIN_ROOM_SIZE = 3; // Dimensión interna mínima (3x3)
const MAX_ROOM_SIZE = 7; // Dimensión interna máxima (7x7)
const MAX_GRID_SIZE = 30; // Lienzo temporal para construir la casa

// Mapeo de caracteres
const BLUEPRINT_MAP = {
    'W': { type: 'entity', key: 'WOOD_WALL_ENTITY' }, // Muro
    'F': { type: 'terrain', key: 'STONE_GROUND' },   // Suelo
    'E': { type: 'terrain', key: 'DIRT' },           // Puerta Exterior
    'D': { type: 'terrain', key: 'DIRT' },           // Puerta Interior
    ' ': { type: 'none' }                            // Vacío
};

/**
 * Helper: Entero aleatorio determinista
 */
function randomInt(min, max, seed) {
    const r = seededRandom(seed, min, max);
    return Math.floor(r * (max - min + 1)) + min;
}

/**
 * Helper: Comprueba si un rectángulo se solapa con otros
 */
function checkOverlap(newRoom, existingRooms) {
    for (const room of existingRooms) {
        // Comprobación AABB (con 1 tile de 'padding' para que no se toquen)
        if (newRoom.x < room.x + room.w + 1 &&
            newRoom.x + newRoom.w + 1 > room.x &&
            newRoom.y < room.y + room.h + 1 &&
            newRoom.y + newRoom.h + 1 > room.y) {
            return true; // Hay solapamiento
        }
    }
    return false;
}

/**
 * Helper: Estampa una sala (muros y suelo) en el grid
 */
function stampRoom(grid, x, y, w, h) {
    for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) {
            if (j === y || j === y + h - 1 || i === x || i === x + w - 1) {
                if (grid[j][i] !== 'F') { // No sobrescribir suelo
                   grid[j][i] = 'W'; // Muro
                }
            } else {
                grid[j][i] = 'F'; // Suelo
            }
        }
    }
}

/**
 * Helper: Recorta el ' ' vacío del grid y lo convierte a strings
 */
function cropAndConvert(grid) {
    let minX = MAX_GRID_SIZE, minY = MAX_GRID_SIZE, maxX = 0, maxY = 0;
    for (let j = 0; j < MAX_GRID_SIZE; j++) {
        for (let i = 0; i < MAX_GRID_SIZE; i++) {
            if (grid[j][i] !== ' ') {
                minX = Math.min(minX, i);
                maxX = Math.max(maxX, i);
                minY = Math.min(minY, j);
                maxY = Math.max(maxY, j);
            }
        }
    }

    if (minX > maxX) return []; // Grid vacío

    const finalBlueprint = [];
    for (let j = minY; j <= maxY; j++) {
        finalBlueprint.push(grid[j].slice(minX, maxX + 1).join(''));
    }
    return finalBlueprint;
}

/**
 * ¡NUEVA FUNCIÓN!
 * Genera un blueprint de casa procedural (estilo "unido").
 * @param {number} numRooms - Cuántas salas (2-4)
 * @param {number} seed - Semilla de aleatoriedad
 * @returns {Array<string>} El blueprint generado
 */
export function generateProceduralHouseBlueprint(numRooms, seed) {
    let grid = Array(MAX_GRID_SIZE).fill(null).map(() => Array(MAX_GRID_SIZE).fill(' '));
    let rooms = [];
    let s = seed; // Semilla mutable

    // 1. Colocar la primera sala (semilla)
    const w = randomInt(MIN_ROOM_SIZE, MAX_ROOM_SIZE, s++) + 2; // +2 por los muros
    const h = randomInt(MIN_ROOM_SIZE, MAX_ROOM_SIZE, s++) + 2;
    const x = Math.floor(MAX_GRID_SIZE / 2 - w / 2);
    const y = Math.floor(MAX_GRID_SIZE / 2 - h / 2);
    stampRoom(grid, x, y, w, h);
    rooms.push({ x, y, w, h });

    let attempts = 0;
    
    // 2. Intentar añadir las salas restantes
    while (rooms.length < numRooms && attempts < 20) {
        attempts++;
        s++;

        // Elegir una sala existente y un lado
        const baseRoom = rooms[randomInt(0, rooms.length - 1, s++)];
        const side = randomInt(0, 3, s++); // 0:Arriba, 1:Derecha, 2:Abajo, 3:Izquierda

        // Calcular nuevas dimensiones
        const newW = randomInt(MIN_ROOM_SIZE, MAX_ROOM_SIZE, s++) + 2;
        const newH = randomInt(MIN_ROOM_SIZE, MAX_ROOM_SIZE, s++) + 2;

        let newX, newY, doorX, doorY;

        // Calcular nueva posición y puerta
        switch (side) {
            case 0: // Arriba
                newX = randomInt(baseRoom.x - newW + 3, baseRoom.x + baseRoom.w - 3, s++);
                newY = baseRoom.y - newH + 1; // +1 para solapar muros
                doorX = randomInt(Math.max(newX, baseRoom.x) + 1, Math.min(newX + newW, baseRoom.x + baseRoom.w) - 2, s++);
                doorY = baseRoom.y;
                break;
            case 1: // Derecha
                newX = baseRoom.x + baseRoom.w - 1;
                newY = randomInt(baseRoom.y - newH + 3, baseRoom.y + baseRoom.h - 3, s++);
                doorX = newX;
                doorY = randomInt(Math.max(newY, baseRoom.y) + 1, Math.min(newY + newH, baseRoom.y + baseRoom.h) - 2, s++);
                break;
            case 2: // Abajo
                newX = randomInt(baseRoom.x - newW + 3, baseRoom.x + baseRoom.w - 3, s++);
                newY = baseRoom.y + baseRoom.h - 1;
                doorX = randomInt(Math.max(newX, baseRoom.x) + 1, Math.min(newX + newW, baseRoom.x + baseRoom.w) - 2, s++);
                doorY = newY;
                break;
            case 3: // Izquierda
                newX = baseRoom.x - newW + 1;
                newY = randomInt(baseRoom.y - newH + 3, baseRoom.y + baseRoom.h - 3, s++);
                doorX = baseRoom.x;
                doorY = randomInt(Math.max(newY, baseRoom.y) + 1, Math.min(newY + newH, baseRoom.y + baseRoom.h) - 2, s++);
                break;
        }

        // Validar posición (dentro del lienzo y sin solaparse)
        if (newX < 0 || newY < 0 || newX + newW >= MAX_GRID_SIZE || newY + newH >= MAX_GRID_SIZE) {
            continue; // Fuera del lienzo
        }
        const newRoom = { x: newX, y: newY, w: newW, h: newH };
        if (checkOverlap(newRoom, rooms)) {
            continue; // Se solapa
        }

        // ¡Éxito! Estampar sala y puerta
        stampRoom(grid, newX, newY, newW, newH);
        grid[doorY][doorX] = 'D'; // Poner puerta
        rooms.push(newRoom);
        attempts = 0; // Resetear intentos
    }

    // 3. Colocar puerta exterior (lógica de 'placeExteriorDoor' simplificada)
    let candidates = [];
    for (const room of rooms) {
        // Comprobar muros exteriores que den a ' '
        for (let i = room.x + 1; i < room.x + room.w - 1; i++) {
            if (grid[room.y][i] === 'W' && grid[room.y - 1] && grid[room.y - 1][i] === ' ') candidates.push({ x: i, y: room.y });
            if (grid[room.y + room.h - 1][i] === 'W' && grid[room.y + room.h] && grid[room.y + room.h][i] === ' ') candidates.push({ x: i, y: room.y + room.h - 1 });
        }
        for (let j = room.y + 1; j < room.y + room.h - 1; j++) {
            if (grid[j][room.x] === 'W' && grid[j][room.x - 1] === ' ') candidates.push({ x: room.x, y: j });
            if (grid[j][room.x + room.w - 1] === 'W' && grid[j][room.x + room.w + 1] === ' ') candidates.push({ x: room.x + room.w - 1, y: j });
        }
    }
    
    if (candidates.length > 0) {
        const doorPos = candidates[randomInt(0, candidates.length - 1, s++)];
        grid[doorPos.y][doorPos.x] = 'E';
    } else {
        // Fallback: si no hay candidatos (casa rara), poner en la primera sala
        if (rooms.length > 0) {
            grid[rooms[0].y][rooms[0].x + 1] = 'E';
        }
    }

    // 4. Recortar y devolver
    return cropAndConvert(grid);
}

/**
 * Coloca una casa (blueprint) en los arrays de 'terrain' y 'entities' de un chunk.
 * ¡MODIFICADO! Ahora limpia el área primero.
 */
export function placeHouse(chunkX, chunkY, chunkZ, localX, localY, terrain, entities, createEntity, blueprint) {
    const height = blueprint.length;
    if (height === 0) return;
    const width = blueprint[0].length;

    // --- Comprobación de límites ---
    if (localX + width >= CHUNK_GRID_WIDTH || localY + height >= CHUNK_GRID_HEIGHT) {
        return; // No cabe
    }

    // --- 1. ¡NUEVO! Limpiar área de entidades existentes ---
    // Calcular límites en píxeles
    const minX = (chunkX * CHUNK_GRID_WIDTH + localX) * TILE_PX_WIDTH;
    const maxX = minX + width * TILE_PX_WIDTH;
    const minY = (chunkY * CHUNK_GRID_HEIGHT + localY) * TILE_PX_HEIGHT;
    const maxY = minY + height * TILE_PX_HEIGHT;

    // Filtrar la lista de entidades (modificándola por referencia)
    const entitiesToKeep = entities.filter(e => {
        const inX = e.x >= minX && e.x < maxX;
        const inY = e.y >= minY && e.y < maxY;
        return !inX || !inY; // Mantener si NO está en la zona
    });
    entities.length = 0; // Vaciar array original
    entities.push(...entitiesToKeep); // Rellenar con las filtradas

    // --- 2. Construir la casa (lógica anterior) ---
    for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
            
            const char = blueprint[dy][dx];
            const mapping = BLUEPRINT_MAP[char];
            if (!mapping || mapping.type === 'none') {
                continue; // Dejar ' ' (no hacer nada)
            }

            const currentLocalX = localX + dx;
            const currentLocalY = localY + dy;

            if (mapping.type === 'terrain') {
                // Modificar el tile de terreno (esto limpia el terreno "salvaje")
                terrain[currentLocalY][currentLocalX] = mapping.key;
            } 
            else if (mapping.type === 'entity') {
                // Modificar el tile de terreno (poner suelo debajo del muro)
                terrain[currentLocalY][currentLocalX] = 'DIRT'; // Poner tierra debajo de los muros

                // Añadir la entidad (muro)
                const globalTileX = (chunkX * CHUNK_GRID_WIDTH) + currentLocalX;
                const globalTileY = (chunkY * CHUNK_GRID_HEIGHT) + currentLocalY;
                
                const entityX = (globalTileX * TILE_PX_WIDTH) + (TILE_PX_WIDTH / 2);
                const entityY = (globalTileY * TILE_PX_HEIGHT) + (TILE_PX_HEIGHT / 2);
                
                const uid = `house_${chunkX}_${chunkY}_${chunkZ}_${currentLocalX}_${currentLocalY}`;

                const newEntity = createEntity(mapping.key, entityX, entityY, chunkZ, uid);
                if (newEntity) {
                    entities.push(newEntity);
                }
            }
        }
    }
}