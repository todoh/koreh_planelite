// --- cloud.js ---
// Gestiona la conexión y la E/S con Firebase Realtime Database.

import { applyLoadedData } from './io.js';
// ¡MODIFICADO! Importar player/stats desde logic.js
import { player, stats } from './logic.js';
// ¡MODIFICADO! Importar helpers de world.js
import { getDirtyChunksData, clearDirtyChunks } from './world.js';


// Variable global para almacenar la instancia de la base de datos
let dbInstance = null;
let lastFirebaseConfig = null; 

// --- RUTAS DE BASE DE DATOS ---
const PROFILES_ROOT = 'profiles_v2';
const PLAYER_STATES_ROOT = 'playerStates_v2';
const CHUNKS_ROOT = 'chunks_v2'; 

/**
 * Intenta parsear el string de configuración y conectar con Firebase.
 * @param {string} configString - El string del objeto de configuración.
 * @param {function} showMessage - Callback para mostrar mensajes (de ui.js).
 * @returns {boolean} - true si la conexión fue exitosa.
 */
function initializeFirebase(configString, showMessage) {
    if (dbInstance) return true; // Ya inicializado

    let config;
    try {
        config = (new Function("return " + configString))();
        if (typeof config !== 'object' || !config.apiKey || !config.databaseURL) {
            throw new Error("El objeto de configuración no es válido o está incompleto.");
        }
        lastFirebaseConfig = configString; 
    } catch (e) {
        console.error("Error al parsear la configuración de Firebase:", e);
        showMessage(`Error de Config: ${e.message}`);
        return false;
    }

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        } else {
            firebase.app(); // Usar la app existente
        }
        dbInstance = firebase.database();
        showMessage("Conectado a Firebase Realtime Database.");
        return true;
    } catch (e) {
        console.error("Error al inicializar Firebase:", e);
        showMessage(`Error de Firebase: ${e.message}`);
        dbInstance = null;
        return false;
    }
}

/**
 * Wrapper exportado para solo inicializar la conexión.
 */
export async function initializeCloud(configString, showMessage) {
    return initializeFirebase(configString, showMessage);
}

/**
 * Obtiene la instancia de DB (para main.js).
 */
export function getDbInstance() {
    return dbInstance;
}

/**
 * Lógica unificada para entrar al mundo.
 */
export async function cloudEnterWorld(configString, profileName, pin, showMessage) {
    if (!initializeFirebase(configString, showMessage)) {
        return; // Falló la conexión
    }
    if (pin.length !== 4) {
        showMessage("El PIN debe tener 4 números.");
        return;
    }

    try {
        // 1. Autenticar O Crear Perfil
        const profileRef = dbInstance.ref(`${PROFILES_ROOT}/${profileName}`);
        const profileSnapshot = await profileRef.once('value');
        const existingProfile = profileSnapshot.val();

        if (existingProfile) {
            // El perfil existe -> Comprobar PIN
            if (existingProfile.pin !== pin) {
                showMessage("PIN incorrecto para este perfil.");
                return;
            }
            showMessage("¡PIN correcto! Cargando perfil...");
        } else {
            // El perfil no existe -> Crear
            await profileRef.set({ pin: pin });
            showMessage("Nuevo perfil creado. Cargando mundo...");
        }

        // 2. Cargar datos del Jugador
        const playerStateRef = dbInstance.ref(`${PLAYER_STATES_ROOT}/${profileName}`);
        const playerStateSnapshot = await playerStateRef.once('value');
        const loadedPlayerState = playerStateSnapshot.val();
        
        if (!loadedPlayerState) {
            showMessage("Perfil (re)generado. Iniciando en spawn por defecto.");
        }

        // 3. Cargar el Mapa (Chunks)
        const chunksRef = dbInstance.ref(CHUNKS_ROOT);
        const chunksSnapshot = await chunksRef.once('value');
        const loadedChunks = chunksSnapshot.val();

        // 4. Ensamblar el objeto saveData
        const saveData = {
            playerState: loadedPlayerState, 
            mapData: loadedChunks || {},
            savedAt: new Date().toISOString()
        };

        // 5. Establecer Banderas y Recargar
        showMessage("Datos encontrados. Recargando para Modo Online...");
        localStorage.setItem("ENTER_ONLINE_MODE", "true");
        localStorage.setItem("LAST_FIREBASE_CONFIG", configString);
        localStorage.setItem("CURRENT_PROFILE_NAME", profileName); 
        
        await applyLoadedData(saveData); // Esto recarga la página

    } catch (error)
 {
        console.error("Error durante el 'cloudEnterWorld':", error);
        showMessage(`Error al entrar: ${error.message}`);
    }
}


/**
 * (Función no exportada)
 * Crea o guarda un perfil de jugador Y el estado del juego.
 */
async function cloudSaveGame(configString, profileName, pin, showMessage) {
    if (!initializeFirebase(configString, showMessage)) {
        return false;
    }
    if (pin.length !== 4) {
        showMessage("El PIN debe tener 4 números.");
        return false;
    }

    try {
        const profileRef = dbInstance.ref(`${PROFILES_ROOT}/${profileName}`);
        const profileSnapshot = await profileRef.once('value');
        const existingProfile = profileSnapshot.val();

        if (existingProfile) {
            if (existingProfile.pin !== pin) {
                showMessage("PIN incorrecto para este perfil.");
                return false;
            }
        } else {
            await profileRef.set({ pin: pin });
            showMessage("Nuevo perfil creado.");
        }

        // 2. Guardar el estado del JUGADOR
        showMessage("Guardando datos del jugador...");
        const playerStateRef = dbInstance.ref(`${PLAYER_STATES_ROOT}/${profileName}`);
        const playerState = {
            x: player.x,
            y: player.y,
            z: player.z, // ¡AÑADIDO Z!
            stats: { ...stats },
            facing: player.facing 
        };
        await playerStateRef.set(playerState);

        // 3. Guardar el MAPA (chunks sucios)
        await cloudSaveDirtyChunks(showMessage, true); 

        showMessage(`¡Perfil '${profileName}' guardado con éxito!`);
        return true; 

    } catch (error) {
        console.error("Error durante el guardado/creación:", error);
        showMessage(`Error al guardar: ${error.message}`);
        return false;
    }
}

/**
 * Guarda solo los chunks sucios en la nube (para tiempo real).
 */
export async function cloudSaveDirtyChunks(showMessage, forceClear = false) {
    if (!dbInstance) {
        console.warn("Real-time save: Not connected.");
        return false; 
    }
    
    // ¡MODIFICADO! Esta función viene de world.js
    const dirtyData = getDirtyChunksData(); 
    if (dirtyData.size === 0) {
        return true; // Nada que guardar
    }

    try {
        const chunksRef = dbInstance.ref(CHUNKS_ROOT);
        const promises = [];
        for (const [chunkKey, chunkData] of dirtyData.entries()) {
            promises.push(chunksRef.child(chunkKey).set(chunkData));
        }
        await Promise.all(promises);
        
        clearDirtyChunks(); // ¡MODIFICADO! Esta función viene de world.js
        if (showMessage) showMessage(`Mapa sincronizado (${dirtyData.size} chunks).`);
        return true;

    } catch (error) {
        console.error("Error durante el guardado de chunks en tiempo real:", error);
        if (showMessage) showMessage(`Error de Sinc. Mapa: ${error.message}`);
        if (forceClear) clearDirtyChunks(); 
        return false;
    }
}

/**
 * Guarda solo el estado del jugador (para tiempo real).
 */
export async function cloudSavePlayerState(profileName) {
    if (!dbInstance || !profileName) {
        return; // No conectado o sin perfil
    }
    
    try {
        const playerStateRef = dbInstance.ref(`${PLAYER_STATES_ROOT}/${profileName}`);
        const playerState = {
            x: player.x,
            y: player.y,
            z: player.z, // ¡AÑADIDO Z!
            stats: { ...stats },
            facing: player.facing 
        };
        playerStateRef.set(playerState);
    } catch (error) {
        console.error("Error guardando pos. jugador:", error);
    }
}