// --- cloud.js ---
// Gestiona la conexión y la E/S con Firebase Realtime Database.

// Importar el helper de io.js para APLICAR la carga
import { applyLoadedData } from './io.js';
// ¡NUEVO! Importar helpers de logic.js para OBTENER datos
import { player, stats, getDirtyChunksData, clearDirtyChunks } from './logic.js';


// Variable global para almacenar la instancia de la base de datos
let dbInstance = null;
// ¡NUEVO! Almacenar la última config usada
let lastFirebaseConfig = null; 

// --- ¡NUEVAS RUTAS DE BASE DE DATOS! ---
// Usamos v2 para evitar conflictos con datos antiguos
const PROFILES_ROOT = 'profiles_v2';
const PLAYER_STATES_ROOT = 'playerStates_v2';
const CHUNKS_ROOT = 'chunks_v2'; 
// ---

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
        // ... (lógica de parseo sin cambios) ...
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
        // ... (lógica de initializeApp sin cambios) ...
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
 * ¡NUEVO! Obtiene la instancia de DB (para main.js).
 */
export function getDbInstance() {
    return dbInstance;
}

/**
 * ¡NUEVO! Lógica unificada para entrar al mundo.
 * 1. Comprueba si el perfil existe.
 * 2. Si existe, valida el PIN.
 * 3. Si no existe, lo crea con el PIN.
 * 4. Si el PIN es válido (o nuevo), carga el estado del jugador y el mapa.
 * 5. Recarga la página en modo online.
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
            // Esto es normal si el perfil es nuevo
            showMessage("Perfil (re)generado. Iniciando en spawn por defecto.");
        }

        // 3. Cargar el Mapa (Chunks)
        // (Incluso si el perfil es nuevo, cargamos el mapa mundial existente)
        const chunksRef = dbInstance.ref(CHUNKS_ROOT);
        const chunksSnapshot = await chunksRef.once('value');
        const loadedChunks = chunksSnapshot.val();

        // 4. Ensamblar el objeto saveData
        const saveData = {
            playerState: loadedPlayerState, // Si es null, logic.js lo manejará en el spawn
            mapData: loadedChunks || {},
            savedAt: new Date().toISOString()
        };

        // 5. Establecer Banderas y Recargar
        showMessage("Datos encontrados. Recargando para Modo Online...");
        localStorage.setItem("ENTER_ONLINE_MODE", "true");
        localStorage.setItem("LAST_FIREBASE_CONFIG", configString);
        localStorage.setItem("CURRENT_PROFILE_NAME", profileName); // ¡Clave!
        
        await applyLoadedData(saveData); // Esto recarga la página

    } catch (error)
 {
        console.error("Error durante el 'cloudEnterWorld':", error);
        showMessage(`Error al entrar: ${error.message}`);
    }
}


/**
 * (Función cloudSaveGame ya no se exporta)
 * Crea o guarda un perfil de jugador Y el estado del juego.
 * @param {string} configString 
 * @param {string} profileName
 * @param {string} pin
 * @param {function} showMessage 
 * @returns {boolean} - true si tuvo éxito
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
            // El perfil existe -> Comprobar PIN
            if (existingProfile.pin !== pin) {
                showMessage("PIN incorrecto para este perfil.");
                return false;
            }
            // PIN correcto -> Es un "Guardado"
        } else {
            // El perfil no existe -> Es "Crear"
            await profileRef.set({ pin: pin });
            showMessage("Nuevo perfil creado.");
        }

        // 2. Guardar el estado del JUGADOR
        showMessage("Guardando datos del jugador...");
        const playerStateRef = dbInstance.ref(`${PLAYER_STATES_ROOT}/${profileName}`);
        const playerState = {
            x: player.x,
            y: player.y,
            stats: { ...stats } 
        };
        await playerStateRef.set(playerState);

        // 3. Guardar el MAPA (chunks sucios)
        // Pasamos 'true' para forzar la limpieza de chunks sucios
        await cloudSaveDirtyChunks(showMessage, true); 

        showMessage(`¡Perfil '${profileName}' guardado con éxito!`);
        return true; // Éxito

    } catch (error) {
        console.error("Error durante el guardado/creación:", error);
        showMessage(`Error al guardar: ${error.message}`);
        return false;
    }
}

/**
 * ¡NUEVO! Guarda solo los chunks sucios en la nube (para tiempo real).
 * @param {function} showMessage - Callback para mensajes (opcional)
 * @param {boolean} forceClear - ¿Limpiar chunks sucios incluso si la subida falla? (Usado por cloudSaveGame)
 * @returns {boolean} - true si tuvo éxito o no había nada que guardar
 */
export async function cloudSaveDirtyChunks(showMessage, forceClear = false) {
    if (!dbInstance) {
        console.warn("Real-time save: Not connected.");
        return false; 
    }
    
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
        
        clearDirtyChunks(); // Limpiar solo si la subida fue exitosa
        if (showMessage) showMessage(`Mapa sincronizado (${dirtyData.size} chunks).`);
        return true;

    } catch (error) {
        console.error("Error durante el guardado de chunks en tiempo real:", error);
        if (showMessage) showMessage(`Error de Sinc. Mapa: ${error.message}`);
        if (forceClear) clearDirtyChunks(); // Limpiar de todos modos si se fuerza
        return false;
    }
}

/**
 * ¡NUEVO! Guarda solo el estado del jugador (para tiempo real).
 * @param {string} profileName 
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
            stats: { ...stats } 
        };
        // set() es rápido, no necesitamos 'await' aquí
        playerStateRef.set(playerState);
    } catch (error) {
        console.error("Error guardando pos. jugador:", error);
    }
}


/**
 * (Función cloudLoadGame ya no se exporta)
 * Carga un perfil y el estado del juego.
 * @param {string} configString 
 * @param {string} profileName
 * @param {string} pin
 * @param {function} showMessage 
 */
async function cloudLoadGame(configString, profileName, pin, showMessage) {
    if (!initializeFirebase(configString, showMessage)) {
        return;
    }
    if (pin.length !== 4) {
        showMessage("El PIN debe tener 4 números.");
        return;
    }

    try {
        // 1. Autenticar Perfil
        const profileRef = dbInstance.ref(`${PROFILES_ROOT}/${profileName}`);
        const profileSnapshot = await profileRef.once('value');
        const existingProfile = profileSnapshot.val();

        if (!existingProfile) {
            showMessage("Perfil no encontrado.");
            return;
        }
        if (existingProfile.pin !== pin) {
            showMessage("PIN incorrecto.");
            return;
        }

        // 2. Cargar datos del Jugador
        showMessage(`¡PIN correcto! Cargando perfil '${profileName}'...`);
        const playerStateRef = dbInstance.ref(`${PLAYER_STATES_ROOT}/${profileName}`);
        const playerStateSnapshot = await playerStateRef.once('value');
        const loadedPlayerState = playerStateSnapshot.val();
        
        // Si no hay playerState (raro), usaremos el spawn por defecto
        if (!loadedPlayerState) {
            showMessage("Advertencia: No se encontraron datos de jugador, se usará spawn por defecto.");
        }

        // 3. Cargar el Mapa (Chunks)
        const chunksRef = dbInstance.ref(CHUNKS_ROOT);
        const chunksSnapshot = await chunksRef.once('value');
        const loadedChunks = chunksSnapshot.val();

        // 4. Ensamblar el objeto saveData
        const saveData = {
            playerState: loadedPlayerState, // Si es null, logic.js lo manejará
            mapData: loadedChunks || {},
            savedAt: new Date().toISOString()
        };

        // 5. Establecer Banderas y Recargar
        showMessage("Datos encontrados. Recargando para Modo Online...");
        localStorage.setItem("ENTER_ONLINE_MODE", "true");
        localStorage.setItem("LAST_FIREBASE_CONFIG", configString);
        localStorage.setItem("CURRENT_PROFILE_NAME", profileName); // ¡Clave!
        
        await applyLoadedData(saveData); // Esto recarga la página

    } catch (error) {
        console.error("Error durante la carga desde la nube:", error);
        showMessage(`Error al cargar: ${error.message}`);
    }
}