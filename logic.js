// --- logic.js ---
// Contiene el ESTADO (Modelo) y las REGLAS del juego.
// Exporta constantes, estado global e inicialización.
// ¡MODIFICADO! Añadido estado de acción al jugador.

import { 
    initializeMetadata, 
    IMAGES as AssetImages 
} from './generation.js';
import { initializeInventory, MAX_SLOTS } from './inventory.js'; // <-- ¡MODIFICADO! Importar MAX_SLOTS
import { 
    getTerrainDefinitions, 
    getEntityDefinitions 
} from './entity.js'; 
import { updateActiveChunks } from './world.js';


// --- CONFIGURACIÓN DEL JUEGO ---
export const TILE_PX_WIDTH = 70;
export const TILE_PX_HEIGHT = 70;
export const CHUNK_GRID_WIDTH = 60;
export const CHUNK_GRID_HEIGHT = 60;
export const CHUNK_PX_WIDTH = CHUNK_GRID_WIDTH * TILE_PX_WIDTH;
export const CHUNK_PX_HEIGHT = CHUNK_GRID_HEIGHT * TILE_PX_HEIGHT;
export const PLAYER_SPEED = 200; // píxeles por segundo
const DAY_DURATION_SECONDS = 300; // 5 minutos por día completo

// --- ESTADO DEL JUEGO (GLOBAL) ---
export const player = {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, 
    facing: 'right', 
    rotationY: 0, // <-- ¡CORRECCIÓN AÑADIDA!
    
    // --- ¡MODIFICACIÓN! Volvemos al estado simple ---
    isMovingToTarget: false,   // <-- ¡AÑADIDO!
    targetX: 0,                // <-- ¡AÑADIDO!
    targetY: 0,                // <-- ¡AÑADIDO!
    // pathWaypoints: [],      // <-- Comentado
    // isHoldingMove: false,   // <-- Comentado
    // --- FIN DE MODIFICACIÓN ---

    mountedVehicleUid: null,
    currentSpeed: PLAYER_SPEED,

    activeHotbarSlot: 0 ,
    hoveredEntityUID: null,
    
    // --- ¡NUEVO! Estado de Animación de Acción ---
    currentAction: null, // 'chop', 'pickup', null
    actionTimer: 0,      // Contador para la duración
    actionTarget: null   // UID de la entidad objetivo
    // --- FIN DE NUEVO ESTADO ---
};

export const stats = {
    vida: 1000, vidamax: 1000,
    energia: 1000, energiamax: 1000,
};

export const worldState = {
    timeOfDay: 0.5 // Empezar al mediodía
};

// --- ESTADO MULTIJUGADOR ---
export let otherPlayers = new Map(); 

// --- ASSETS Y DEFINICIONES ---
export let TERRAIN_DATA = {}; 
export let ENTITY_DATA = {}; 
export const IMAGES = AssetImages;
export { ITEM_DEFINITIONS } from './items.js';

// --- CALLBACKS ---
export let openMenuCallback = (menuId) => {
    console.warn(`openMenuCallback no inicializado. Se intentó abrir: ${menuId}`);
};

// --- ¡NUEVO! Función de fallback para el inventario inicial ---
function createFallbackInventory() {
    console.warn("No se pudo cargar 'initial_inventory.json'. Usando inventario de fallback.");
    const defaultItems = new Array(MAX_SLOTS).fill(null);
    defaultItems[0] = { itemId: 'HAND', quantity: 1 };
    defaultItems[1] = { itemId: 'ITEM_WOOD_WALL', quantity: 10 };
    defaultItems[2] = { itemId: 'ITEM_STONE_GROUND_SLAB', quantity: 10 };
    return defaultItems;
}


// --- INICIALIZACIÓN ---

export async function initializeGameLogic(callbacks) {
    if (callbacks && callbacks.openMenu) {
        openMenuCallback = callbacks.openMenu;
    }

    // 0. Cargar estado del jugador
    try {
        const loadedStateJSON = localStorage.getItem("GAME_STATE_LOAD");
        if (loadedStateJSON) {
            console.log("Detectado estado de jugador cargado. Aplicando...");
            const loadedState = JSON.parse(loadedStateJSON);
            
            if (loadedState) {
                player.x = loadedState.x;
                player.y = loadedState.y;
                player.z = loadedState.z || 0; 
                player.facing = loadedState.facing || 'right'; 
                player.rotationY = loadedState.rotationY || 0; // <-- ¡CORRECCIÓN AÑADIDA!
                Object.assign(stats, loadedState.stats);
                initializeInventory(loadedState.inventory);
            } else {
                throw new Error("El estado del jugador cargado era nulo.");
            }
            localStorage.removeItem("GAME_STATE_LOAD");
        } else {
            // --- ¡BLOQUE MODIFICADO! ---
            console.log("No hay estado de jugador. Empezando en spawn por defecto y cargando inventario inicial...");
            player.x = (30.5 * TILE_PX_WIDTH);
            player.y = (30.5 * TILE_PX_HEIGHT);
            player.z = 0; 
            player.facing = 'right'; 
            player.rotationY = 0;
            
            // Intentar cargar el inventario inicial desde JSON
            let initialItems = null;
            try {
                const response = await fetch('./initial_inventory.json');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                initialItems = await response.json();
                
                // Validar que sea un array y tenga la longitud correcta
                if (!Array.isArray(initialItems)) {
                    console.warn("initial_inventory.json no es un array. Usando fallback.");
                    initialItems = createFallbackInventory();
                } else if (initialItems.length < MAX_SLOTS) {
                     console.warn(`initial_inventory.json tiene ${initialItems.length} slots, se rellenará hasta ${MAX_SLOTS}.`);
                    initialItems.push(...new Array(MAX_SLOTS - initialItems.length).fill(null));
                } else if (initialItems.length > MAX_SLOTS) {
                    console.warn(`initial_inventory.json tiene ${initialItems.length} slots, se truncará a ${MAX_SLOTS}.`);
                    initialItems = initialItems.slice(0, MAX_SLOTS);
                }

            } catch (e) {
                console.error("Error al cargar 'initial_inventory.json':", e);
                initialItems = createFallbackInventory();
            }
            
            initializeInventory(initialItems);
            // --- FIN DE MODIFICACIÓN ---
        }
    } catch (e) {
        console.error("Error al procesar estado de jugador cargado. Usando spawn por defecto.", e);
        player.x = (30.5 * TILE_PX_WIDTH);
        player.y = (30.5 * TILE_PX_HEIGHT);
        player.z = 0;
        player.facing = 'right'; 
        player.rotationY = 0; // <-- ¡CORRECCIÓN AÑADIDA!
        localStorage.removeItem("GAME_STATE_LOAD");
        
        // --- ¡BLOQUE MODIFICADO! ---
        // Usar el fallback también en el catch
        const defaultItems = createFallbackInventory();
        initializeInventory(defaultItems);
        // --- FIN DE MODIFICACIÓN ---
    }
    
    player.currentSpeed = PLAYER_SPEED;

    // 1. Cargar metadata
    await initializeMetadata(); 
    
    // 2. Obtener definiciones
    TERRAIN_DATA = getTerrainDefinitions();
    ENTITY_DATA = getEntityDefinitions();
    
    // 3. Cargar primeros chunks
    console.log("Cargando área de spawn inicial...");
    await updateActiveChunks(player.x, player.y);
    
    // Esperar a que todas las cargas pendientes iniciales terminen
    // (Esta lógica se movió a 'updateActiveChunks', pero necesitamos
    // una forma de esperar aquí si es necesario. Por ahora, asumimos
    // que la primera carga es síncrona o que el bucle puede manejarlo).
    // NOTA: La lógica original tampoco esperaba aquí, así que mantenemos consistencia.
    
    console.log("¡Área de spawn lista!");
}

// --- GESTIÓN DE OTROS JUGADORES ---
export function updateAllPlayers(playersData, myProfileName) {
    otherPlayers.clear();
    if (!playersData) return;
    
    for (const profileName in playersData) {
        if (profileName === myProfileName) {
            continue; 
        }
        
        const data = playersData[profileName];
        
        // Solo añadir otros jugadores si están en el mismo Z-level
        if (data.z === player.z) {
            otherPlayers.set(profileName, {
                ...data, // x, y, z, stats, facing, rotationY
                key: 'PLAYER', 
                name: profileName 
            });
        }
    }
}

// --- ACTUALIZACIONES DE ESTADO SIMPLE ---

/**
 * Actualiza el timeOfDay del mundo
 * @param {number} deltaTime - Tiempo en segundos desde el último frame
 */
export function updateWorldState(deltaTime) {
    const timeDelta = deltaTime / DAY_DURATION_SECONDS;
    worldState.timeOfDay = (worldState.timeOfDay + timeDelta) % 1.0;
}

/**
 * Comprueba el estado de salud/energía del jugador.
 */
export function checkGameStatus() {
    if (stats.vida <= 0) return { alive: false, message: "Has muerto." };
    if (stats.energia <= 0) {
        stats.energia = 0;
        return { alive: true, message: "¡Estás sin energía!" };
    }
    return { alive: true, message: null };
}