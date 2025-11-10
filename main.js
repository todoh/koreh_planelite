// --- main.js ---
// Orquestador principal.
// Conecta Lógica, Vista (Render/UI) e Input.
// Controla el bucle de juego.

// --- Módulos de Lógica (ESTADO) ---
import {
    player,
    stats,
    worldState, 
    initializeGameLogic,
    updateWorldState, 
    checkGameStatus,
    updateAllPlayers,
    TILE_PX_HEIGHT
} from './logic.js';

// --- Módulos de SISTEMAS ---
import {
    updateActiveChunks,
    getVisibleObjects
} from './world.js';
import {
    updatePlayer,
    handleWorldTap,
    playerInteract
} from './player_system.js';
import { updateEntities } from './entity_system.js';

// --- Módulos de Cámara y Persistencia ---
import {
    // ¡RE-ACTIVADO! (Solo para culling)
    initializeCamera,
    // resizeCamera, // <-- Sin uso
    // handleZoom,   // <-- ¡ELIMINADO!
    // handleWheel,  // <-- ¡ELIMINADO!
    updateCamera,
    getViewportAABB,
    screenToWorld,
} from './camera.js';
import { saveGame, loadGame } from './io.js';
import { 
    cloudEnterWorld, 
    initializeCloud,
    cloudSaveDirtyChunks,
    cloudSavePlayerState, 
    getDbInstance         
} from './cloud.js';


// --- Módulos de Vista e Input ---
import { initializeInput, getInputState } from './input.js';

// --- ¡CAMBIO DE MOTOR! ---
// import { initializeRenderer, renderFrame } from './render.js'; // <-- ANTIGUO
import { 
    initialize3DEngine, 
    render3DFrame,
    handle3DZoom,           // <-- ¡NUEVO!
    handle3DCameraRotate,   // <-- ¡NUEVO!
    getWorldCoordsFromScreen // <-- ¡NUEVO!
} from './engine_3d.js'; // <-- ¡MODIFICADO!
// --- FIN DE CAMBIO ---

import { 
    initializeUI, 
    showMessage, 
    renderStats,
    renderClock, 
    showFirebaseMessage,
    getFirebaseConfig,
    getProfileCredentials, 
    setFirebaseConfig,
    showOnlineStatus,
    hideOnlineStatus,
    openMenu 
} from './ui.js';


// --- ESTADO DEL BUCLE ---
let lastFrameTime = 0;
let isGameRunning = true;

// --- ESTADO ONLINE ---
let isOnline = false;
let onlineChunkSaveInterval = null; 
const ONLINE_CHUNK_SAVE_INTERVAL_MS = 5000; 
let onlinePlayerSyncInterval = null;
const ONLINE_PLAYER_SYNC_INTERVAL_MS = 100; 
let playerStatesListener = null;
const PLAYER_STATES_ROOT_PATH = 'playerStates_v2'; 


// --- BUCLE PRINCIPAL ---
function gameLoop(currentTime) {
    if (!isGameRunning) return;
    const deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;
    
    update(deltaTime);
    render(); // <-- Llamará al nuevo render 3D
    
    requestAnimationFrame(gameLoop);
}

// --- CONTROLADOR ---
function update(deltaTime) {
    // 1. Actualizar cámara y reloj
    updateCamera(); // <-- Necesario para getViewportAABB 2D
    updateWorldState(deltaTime); 
    
    // 2. Actualizar estado del mundo (chunks)
    updateActiveChunks(player.x, player.y);
    
    const input = getInputState();
    
    // 3. Actualizar jugador (input, movimiento)
    const moveResult = updatePlayer(deltaTime, input);
    
    // 4. Actualizar entidades (IA, crecimiento)
    updateEntities(deltaTime);

    // 5. Procesar mensajes y acciones
    if (moveResult.message) showMessage(moveResult.message);
    
    if (input.interact) {
        const interactResult = playerInteract(); 
        if (interactResult.message) showMessage(interactResult.message);
        input.interact = false; 
    }
    
    const status = checkGameStatus();
    if (status.message) showMessage(status.message);
    if (!status.alive) {
        endGame(status.message);
    }
}

// --- VISTA ---
function render() {
    
    // --- ¡MODIFICACIÓN! ---
    // 1. Obtenemos los objetos visibles usando el AABB 2D gigante
    const cameraYOffset = TILE_PX_HEIGHT * 1.5;
    const viewport = getViewportAABB(player.x, player.y - cameraYOffset); // <-- ¡FIX APLICADO!
    
    const objectsToRender = getVisibleObjects(viewport); // <-- ¡RE-ACTIVADO!
    const time = worldState.timeOfDay;
    
    // 2. RenderFrame usará el nuevo motor 3D
    // Le pasamos la Z del jugador (que será la 'Y' en 3D)
    render3DFrame(player.x, player.y, player.z, objectsToRender, time);
    
    // 3. La UI (HTML) se renderiza encima, sin cambios.
    renderStats(stats);
    renderClock(time);
}

// --- FUNCIONES DE CONEXIÓN ---
function processTap(screenX, screenY) {
    
    // --- ¡MODIFICACIÓN CRÍTICA! ---
    // ¡Raycaster 3D AHORA HABILITADO!
    
    // 1. Obtener coordenadas del mundo 3D desde el clic
    const worldPoint = getWorldCoordsFromScreen(screenX, screenY);

    if (worldPoint) {
        // 2. Usar la lógica de 'handleWorldTap' existente
        // (worldPoint.y es el 'z' del mundo 3D)
        const result = handleWorldTap(worldPoint.x, worldPoint.y); // Desde player_system.js
        if (result.message) {
            showMessage(result.message);
        }
    } else {
         showMessage("Clic en el vacío.");
    }
    // --- FIN DE MODIFICACIÓN ---
}

function endGame(message) {
    showMessage(message || "Juego terminado.");
    isGameRunning = false;
}

// --- MANEJADORES DE NUBE ---
async function handleCloudEnter() {
    const config = getFirebaseConfig();
    if (!config) {
        showFirebaseMessage("El objeto de configuración está vacío.");
        return;
    }
    
    const { name, pin } = getProfileCredentials();
    if (!name || !pin) {
        showFirebaseMessage("El nombre de perfil y el PIN son obligatorios.");
        return;
    }
    
    await cloudEnterWorld(config, name, pin, showFirebaseMessage);
}

function handleConnect() {
    isOnline = true;
    showOnlineStatus(); 
    showMessage("¡Modo Online ACTIVADO! Sincronizando en tiempo real.");
    showFirebaseMessage("Conectado. Sincronizando...");

    const db = getDbInstance();
    const myProfileName = localStorage.getItem("CURRENT_PROFILE_NAME");

    if (!db || !myProfileName) {
        showMessage("Error fatal: No se pudo iniciar sesión online.");
        showFirebaseMessage("Error de perfil. Desconectando.");
        handleDisconnect();
        return;
    }
    
    // Guardado periódico de CHUNKS
    if (onlineChunkSaveInterval) clearInterval(onlineChunkSaveInterval);
    onlineChunkSaveInterval = setInterval(() => {
        if (isOnline) {
            cloudSaveDirtyChunks(showFirebaseMessage); // Desde cloud.js (que importa desde world.js)
        }
    }, ONLINE_CHUNK_SAVE_INTERVAL_MS);

    // Envío periódico de POSIFICIÓN
    if (onlinePlayerSyncInterval) clearInterval(onlinePlayerSyncInterval);
    onlinePlayerSyncInterval = setInterval(() => {
        if (isOnline) {
            cloudSavePlayerState(myProfileName); // Desde cloud.js
        }
    }, ONLINE_PLAYER_SYNC_INTERVAL_MS);

    // Listener de POSICIONES de otros
    if (playerStatesListener) playerStatesListener.off(); 
    
    const playerStatesRef = db.ref(PLAYER_STATES_ROOT_PATH);
    playerStatesListener = playerStatesRef; 
    
    playerStatesListener.on('value', (snapshot) => {
        if (!isOnline) return; 
        const allPlayersData = snapshot.val();
        updateAllPlayers(allPlayersData, myProfileName); // Desde logic.js
    });
}

function handleDisconnect() {
    if (!isOnline) return;

    if (confirm("¿Desconectarse del modo online? Los cambios dejarán de guardarse en tiempo real.")) {
        isOnline = false;
        hideOnlineStatus(); 
        showMessage("Modo Online DESACTIVADO.");
        showFirebaseMessage("Desconectado.");

        if (playerStatesListener) {
            playerStatesListener.off(); 
            playerStatesListener = null;
        }
        
        if (onlinePlayerSyncInterval) {
            clearInterval(onlinePlayerSyncInterval);
            onlinePlayerSyncInterval = null;
        }

        if (onlineChunkSaveInterval) {
            clearInterval(onlineChunkSaveInterval);
            onlineChunkSaveInterval = null;
        }
        
        showFirebaseMessage("Guardando cambios finales...");
        cloudSaveDirtyChunks(showFirebaseMessage).then(() => {
            showFirebaseMessage("Desconectado. Cambios finales guardados.");
            localStorage.removeItem("LAST_FIREBASE_CONFIG");
            localStorage.removeItem("CURRENT_PROFILE_NAME");
        });
    }
}


/**
 * ¡NUEVO! Manejador para la rueda del ratón en 3D.
 * @param {WheelEvent} e 
 */
function handleWheel3D(e) {
    e.preventDefault();
    if (e.deltaY < 0) {
        handle3DZoom(true); // Llama a la función 3D
    } else if (e.deltaY > 0) {
        handle3DZoom(false); // Llama a la función 3D
    }
}


// --- INICIAR EL JUEGO ---
async function main() {
    try {
        const $canvas = document.getElementById('game-canvas');
        const $loadFileInput = document.getElementById('load-file-input');

        initializeCamera($canvas); // <-- ¡RE-ACTIVADO! (Para culling)
        
        // Pasamos el callback 'openMenu' a 'initializeGameLogic'
        await initializeGameLogic({
            openMenu: openMenu 
        });
        
        // --- ¡CAMBIO DE MOTOR! ---
        initialize3DEngine($canvas); // <-- NUEVO (3D)
        // --- FIN DE CAMBIO ---
        
        initializeUI({
            onSave: saveGame,
            onLoadFile: loadGame,
            // --- ¡MODIFICADO! Conectar a handlers 3D ---
            onZoomIn: () => handle3DZoom(true), 
            onZoomOut: () => handle3DZoom(false),
            onRotateLeft: () => handle3DCameraRotate(false), // <-- ¡NUEVO!
            onRotateRight: () => handle3DCameraRotate(true), // <-- ¡NUEVO!
            // --- FIN DE MODIFICACIÓN ---
            $loadFileInput: $loadFileInput,
            onCloudLoad: handleCloudEnter, 
            onDisconnect: handleDisconnect 
        });
        
        initializeInput($canvas, {
            onTap: processTap,
            // --- ¡MODIFICADO! Conectar a handler 3D ---
            onWheel: handleWheel3D // <-- ¡MODIFICADO!
        });

        // Comprobar si venimos de una carga en la nube
        const shouldEnterOnline = localStorage.getItem("ENTER_ONLINE_MODE") === "true";
        const lastConfig = localStorage.getItem("LAST_FIREBASE_CONFIG");
        
        if (shouldEnterOnline && lastConfig) {
            localStorage.removeItem("ENTER_ONLINE_MODE");
            setFirebaseConfig(lastConfig); 
            const connected = await initializeCloud(lastConfig, showFirebaseMessage);
            
            if (connected) {
                handleConnect(); 
            } else {
                showMessage("Error al reconectar al modo online.");
                showFirebaseMessage("Error al reconectar.");
                localStorage.removeItem("LAST_FIREBASE_CONFIG");
            }
        }

        // Empezar el bucle
        if (!isOnline) { 
            // ¡MODIFICADO! Mensaje de inicio
            showMessage('¡Mundo 3D! Usa flechas para moverte. ¡Clic para moverte HABILITADO!');
        }
        lastFrameTime = performance.now();
        requestAnimationFrame(gameLoop);

    } catch (error) {
        console.error("Error al iniciar el juego:", error);
        showMessage(`ERROR: No se pudo cargar el juego. ${error.message}`);
    }
}

main();