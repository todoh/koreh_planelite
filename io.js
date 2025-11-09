// --- io.js ---
// Gestiona el guardado y la carga del estado del juego a/desde un archivo JSON
// y expone la lógica para otros sistemas (como la nube).

import { player, stats, flushDirtyChunks } from './logic.js';
import { CHUNK_KEY_REGEX } from './generation.js';

/**
 * Recopila todos los datos del juego necesarios para guardar.
 * ¡NUEVA FUNCIÓN EXPORTADA!
 * @returns {object} El objeto saveData completo.
 */
export async function gatherSaveData() {
    // 1. Guardar todos los chunks modificados de la RAM a localStorage.
    await flushDirtyChunks();

    // 2. Recopilar el estado del jugador
    const playerState = {
        x: player.x,
        y: player.y,
        stats: { ...stats } 
    };

    // 3. Recopilar todos los chunks fusionados del mapa (desde localStorage)
    const mapData = getAllFusedChunks();

    // 4. Combinar todo
    const saveData = {
        playerState,
        mapData,
        savedAt: new Date().toISOString()
    };
    
    return saveData;
}

/**
 * Aplica un objeto saveData cargado y reinicia el juego.
 * ¡NUEVA FUNCIÓN EXPORTADA!
 * @param {object} saveData 
 */
export async function applyLoadedData(saveData) {
if (!saveData || saveData.mapData == null) {
            throw new Error("Archivo de guardado inválido o corrupto.");
    }

    // 1. Limpiar chunks antiguos de localStorage
    clearAllFusedChunks();
    
    // 2. Escribir los nuevos chunks fusionados en localStorage
    for (const chunkKey in saveData.mapData) {
        const chunkString = JSON.stringify(saveData.mapData[chunkKey]);
        // Manejar error de LocalStorage lleno
        try {
            localStorage.setItem(chunkKey, chunkString);
        } catch (e) {
            console.error(`Error al escribir en localStorage (posiblemente lleno): ${e.message}`);
            throw new Error("No se pudo cargar el mapa en el almacenamiento local (¿está lleno?).");
        }
    }

    // 3. Guardar el estado del jugador
    localStorage.setItem("GAME_STATE_LOAD", JSON.stringify(saveData.playerState));

    // 4. Recargar la página
    console.log("Datos cargados en localStorage. Recargando...");
    window.location.reload();
}


/**
 * Inicia la descarga de un archivo JSON con el estado del juego.
 * (Ahora usa el refactor)
 */
export async function saveGame() {
    console.log("Guardando partida en archivo...");
    try {
        // 1. Obtener datos
        const saveData = await gatherSaveData();

        // 2. Convertir a JSON y descargar
        const jsonData = JSON.stringify(saveData);
        downloadJSON(jsonData, 'partida_explorador_ascii.json');

    } catch (error) {
        console.error("Error al guardar la partida:", error);
        console.error("Error al guardar la partida. Revisa la consola.");
    }
}

/**
 * Procesa un archivo JSON cargado por el usuario.
 * (Ahora usa el refactor)
 * @param {File} file - El archivo seleccionado desde el <input type="file">
 */
export function loadGame(file) {
    if (!file) {
        console.warn("No se seleccionó ningún archivo.");
        return;
    }

    console.log("Cargando partida desde:", file.name);
    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            const fileContent = event.target.result;
            const saveData = JSON.parse(fileContent);
            
            // Aplicar los datos cargados
            await applyLoadedData(saveData);

        } catch (error) {
            console.error("Error al cargar y procesar el archivo:", error);
            console.error(`Error al cargar el archivo: ${error.message}`);
        }
    };

    reader.onerror = () => {
        console.error("Error al leer el archivo.");
    };

    reader.readAsText(file);
}

// --- Helpers (sin cambios) ---

function getAllFusedChunks() {
    const chunks = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (CHUNK_KEY_REGEX.test(key)) {
            try {
                const chunk = JSON.parse(localStorage.getItem(key));
                if (chunk && chunk.terrain && chunk.entities) {
                    chunks[key] = chunk;
                }
            } catch (e) {
                console.warn(`Ignorando chunk corrupto en localStorage: ${key}`);
            }
        }
    }
    return chunks;
}

function clearAllFusedChunks() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (CHUNK_KEY_REGEX.test(key)) {
            keysToRemove.push(key);
        }
    }
    console.log(`Limpiando ${keysToRemove.length} chunks guardados...`);
    for (const key of keysToRemove) {
        localStorage.removeItem(key);
    }
}

function downloadJSON(content, fileName) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: 'application/json' });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}