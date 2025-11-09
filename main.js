// --- main.js ---
// Orquestador principal.
// Conecta Lógica, Vista (Render/UI) e Input.
// Controla el bucle de juego.

// --- Módulos de Lógica ---
import {
    player,
    stats,
    initializeGameLogic,
    updateActiveChunks,
    updatePlayer,
    updateEntities, // ¡NUEVO!
    playerInteract,
    checkGameStatus,
    handleWorldTap,
    getVisibleObjects,
    updateAllPlayers
} from './logic.js';

// --- Módulos de Cámara y Persistencia ---
import {
    initializeCamera,
    resizeCamera,
    handleZoom,
    handleWheel,
    updateCamera,
    getViewportAABB,
    screenToWorld,
} from './camera.js';
// Importar solo saveGame/loadGame (para archivos)
import { saveGame, loadGame } from './io.js';
// ¡MODIFICADO! Importar lógica de la nube
import { 
    cloudEnterWorld, 
    initializeCloud,
    cloudSaveDirtyChunks,
    cloudSavePlayerState, 
    getDbInstance         
} from './cloud.js';


// --- Módulos de Vista e Input ---
import { initializeInput, getInputState } from './input.js';
import { initializeRenderer, renderFrame } from './render.js';
// ¡MODIFICADO! Importar helpers de UI para Firebase
import { 
    initializeUI, 
    showMessage, 
    renderStats,
    showFirebaseMessage,
    getFirebaseConfig,
    getProfileCredentials, 
    setFirebaseConfig,
    showOnlineStatus,
    hideOnlineStatus,
    openMenu // ¡NUEVO!
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
// (Sin cambios)
function gameLoop(currentTime) {
    if (!isGameRunning) return;
    const deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;
    
    update(deltaTime);
    render();
    
    requestAnimationFrame(gameLoop);
}

// --- ¡MODIFICADO! CONTROLADOR ---
function update(deltaTime) {
    updateCamera();
    updateActiveChunks(player.x, player.y);
    
    const input = getInputState();
    
    // 1. Actualizar movimiento del jugador y 'onEnter'
    const moveResult = updatePlayer(deltaTime, input);
    
    // 2. ¡NUEVO! Actualizar todas las demás entidades (crecimiento, IA, etc.)
    updateEntities(deltaTime);

    // 3. Procesar mensajes y acciones
    if (moveResult.message) showMessage(moveResult.message);
    
    if (input.interact) {
        // playerInteract ahora puede ser llamado sin argumento
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
// (Sin cambios)
function render() {
    const viewport = getViewportAABB(player.x, player.y);
    const objectsToRender = getVisibleObjects(viewport);
    renderFrame(player.x, player.y, objectsToRender);
    renderStats(stats);
} 

// --- FUNCIONES DE CONEXIÓN ---
// ... (Sin cambios en processTap, endGame) ...
function processTap(screenX, screenY) {
    const worldCoords = screenToWorld(screenX, screenY, player.x, player.y);
    const result = handleWorldTap(worldCoords.x, worldCoords.y);
    if (result.message) {
        showMessage(result.message);
    }
}
function endGame(message) {
    showMessage(message || "Juego terminado.");
    isGameRunning = false;
}

// --- MANEJADORES DE NUBE ---
// ... (Sin cambios en handleCloudEnter, handleConnect, handleDisconnect) ...
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
    
    // Llamar a la nueva función unificada
    await cloudEnterWorld(config, name, pin, showFirebaseMessage);
}
function handleConnect() {
    // 1. Set state
    isOnline = true;
    
    // 2. Show UI
    showOnlineStatus(); 
    showMessage("¡Modo Online ACTIVADO! Sincronizando en tiempo real.");
    showFirebaseMessage("Conectado. Sincronizando...");

    // 3. Obtener DB y Perfil
    const db = getDbInstance();
    const myProfileName = localStorage.getItem("CURRENT_PROFILE_NAME");

    if (!db || !myProfileName) {
        showMessage("Error fatal: No se pudo iniciar sesión online.");
        showFirebaseMessage("Error de perfil. Desconectando.");
        handleDisconnect(); // Llama a desconectar si hay un error
        return;
    }
    
    // 4. Iniciar guardado periódico de CHUNKS (código existente)
    if (onlineChunkSaveInterval) clearInterval(onlineChunkSaveInterval);
    onlineChunkSaveInterval = setInterval(() => {
        if (isOnline) {
            cloudSaveDirtyChunks(showFirebaseMessage);
        }
    }, ONLINE_CHUNK_SAVE_INTERVAL_MS);

    // 5. ¡NUEVO! Iniciar envío periódico de POSICIÓN
    if (onlinePlayerSyncInterval) clearInterval(onlinePlayerSyncInterval);
    onlinePlayerSyncInterval = setInterval(() => {
        if (isOnline) {
            // Llama a la función ligera que solo guarda x, y, stats
            cloudSavePlayerState(myProfileName);
        }
    }, ONLINE_PLAYER_SYNC_INTERVAL_MS);

    // 6. ¡NUEVO! Iniciar listener de POSICIONES de otros
    if (playerStatesListener) playerStatesListener.off(); // Limpiar listener antiguo
    
    const playerStatesRef = db.ref(PLAYER_STATES_ROOT_PATH);
    playerStatesListener = playerStatesRef; // Guardar la referencia para poder desconectarla
    
    playerStatesListener.on('value', (snapshot) => {
        if (!isOnline) return; // No procesar si nos acabamos de desconectar
        
        const allPlayersData = snapshot.val();
        
        // Llama a la función de logic.js para actualizar el estado interno
        updateAllPlayers(allPlayersData, myProfileName);
    });
}
function handleDisconnect() {
    if (!isOnline) return;

    if (confirm("¿Desconectarse del modo online? Los cambios dejarán de guardarse en tiempo real.")) {
        // 1. Set state
        isOnline = false;
        
        // 2. Hide UI
        hideOnlineStatus(); 
        showMessage("Modo Online DESACTIVADO.");
        showFirebaseMessage("Desconectado.");

        // 3. ¡NUEVO! Detener listener de POSICIONES
        if (playerStatesListener) {
            playerStatesListener.off(); // ¡Importante! Detiene el listener
            playerStatesListener = null;
        }
        
        // 4. ¡NUEVO! Detener envío de POSICIÓN
        if (onlinePlayerSyncInterval) {
            clearInterval(onlinePlayerSyncInterval);
            onlinePlayerSyncInterval = null;
        }

        // 5. Detener guardado de CHUNKS (código existente)
        if (onlineChunkSaveInterval) {
            clearInterval(onlineChunkSaveInterval);
            onlineChunkSaveInterval = null;
        }
        
        // 6. (Opcional) Guardar una última vez (código existente)
        showFirebaseMessage("Guardando cambios finales...");
        cloudSaveDirtyChunks(showFirebaseMessage).then(() => {
            showFirebaseMessage("Desconectado. Cambios finales guardados.");
            // Borramos la config para la próxima vez
            localStorage.removeItem("LAST_FIREBASE_CONFIG");
            localStorage.removeItem("CURRENT_PROFILE_NAME"); // Limpiar también el perfil
        });
    }
}


// --- ¡MODIFICADO! INICIAR EL JUEGO ---
async function main() {
    try {
        const $canvas = document.getElementById('game-canvas');
        const $loadFileInput = document.getElementById('load-file-input');

        // 1. Inicializar Cámara
        initializeCamera($canvas);
        
        // 2. ¡MODIFICADO! Cargar assets y estado del juego
        // Ahora pasamos el callback 'openMenu'
        await initializeGameLogic({
            openMenu: openMenu 
        });
        
        // 3. Inicializar Módulo de Renderizado
        initializeRenderer($canvas, resizeCamera);
        
        // 4. Inicializar Módulo de UI (DOM)
        initializeUI({
            onSave: saveGame,
            onLoadFile: loadGame,
            onZoomIn: () => handleZoom(true),
            onZoomOut: () => handleZoom(false),
            $loadFileInput: $loadFileInput,
            onCloudLoad: handleCloudEnter, 
            onDisconnect: handleDisconnect 
        });
        
        // 5. Inicializar Módulo de Input
        initializeInput($canvas, {
            onTap: processTap,
            onWheel: handleWheel
        });

        // 6. Comprobar si venimos de una carga en la nube
        // (Sin cambios)
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

        // 7. Empezar el bucle
        if (!isOnline) { 
            showMessage('¡Mundo procedural! Usa flechas/clic para moverte, [Espacio] para interactuar.');
        }
        lastFrameTime = performance.now();
        requestAnimationFrame(gameLoop);

    } catch (error) {
        console.error("Error al iniciar el juego:", error);
        showMessage(`ERROR: No se pudo cargar el juego. ${error.message}`);
    }
}

main();