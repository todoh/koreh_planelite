// --- camera.js ---
// Gestiona el estado de la cámara (zoom)
// y las transformaciones del canvas.

// --- ESTADO DE LA CÁMARA ---
const camera = {
    width: 0,
    height: 0
};

let currentZoom = 1.0;
let targetZoom = 1.0; 
const ZOOM_STEP = 0.15;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;

// ... (el resto de initializeCamera, resizeCamera, handleZoom, handleWheel, updateCamera no cambia) ...
export function initializeCamera($canvas) {
    resizeCamera($canvas);
}
export function resizeCamera($canvas) {
    camera.width = $canvas.width;
    camera.height = $canvas.clientHeight;
    console.log(`Cámara redimensionada a ${camera.width}x${camera.height}`);
}
export function handleZoom(zoomIn) {
    if (zoomIn) {
        targetZoom = Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP);
    } else {
        targetZoom = Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP);
    }
    currentZoom = targetZoom; 
    console.log(`Zoom nivel: ${currentZoom}`);
}
export function handleWheel(e) {
    e.preventDefault();
    if (e.deltaY < 0) {
        handleZoom(true);
    } else if (e.deltaY > 0) {
        handleZoom(false);
    }
}
export function updateCamera() {
    // Esta función ahora está vacía, pero la mantenemos
    // por si queremos añadir interpolación de zoom en el futuro.
    // ...
}


/**
 * Calcula el AABB (Caja Delimitadora Alineada con Ejes) del viewport
 * ¡MODIFICADO!
 * @param {number} playerX 
 * @param {number} playerY 
 * @returns {object} { minX, minY, maxX, maxY }
 */
export function getViewportAABB(playerX, playerY) {
    
    // --- ¡FIX 3D CULLING! ---
    // El zoom 2D ya no se usa. Hacemos la caja de culling 2D
    // permanentemente gigante. El motor 3D (Three.js)
    // se encargará del culling real (frustum culling).
    // Esto soluciona que los objetos desaparezcan.
    const GIGANTIC_SIZE = 20000; // Un valor lo suficientemente grande
    
    const halfWidth = GIGANTIC_SIZE / 2;
    const halfHeight = GIGANTIC_SIZE / 2;

    // Cálculo simplificado (un cuadrado gigante centrado en el jugador)
    return {
        minX: playerX - halfWidth,
        maxX: playerX + halfWidth,
        minY: playerY - halfHeight,
        maxY: playerY + halfHeight
    };
}

/**
 * Convierte coordenadas de pantalla a coordenadas de mundo
 * (Simplificado para 0 rotación)
 * @param {number} screenX 
 * @param {number} screenY 
 * @param {number} playerX 
 * @param {number} playerY 
 * @returns {object} { x, y }
 */
export function screenToWorld(screenX, screenY, playerX, playerY) {
    // ... (Sin cambios) ...
    const relativeX = (screenX - camera.width / 2) / currentZoom;
    const relativeY = (screenY - camera.height / 2) / currentZoom;
    return {
        x: relativeX + playerX,
        y: relativeY + playerY
    };
}

/**
 * Aplica TODAS las transformaciones de la cámara al contexto
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} playerX 
 * @param {number} playerY 
 */
export function applyCameraTransforms(ctx, playerX, playerY) {
    ctx.save();
    // Mover origen al centro de la pantalla
    ctx.translate(camera.width / 2, camera.height /2);
    // Aplicar zoom
    ctx.scale(currentZoom, currentZoom);
    // Aplicar ROTACIÓN -> ELIMINADO
    // ...
    // Mover el "mundo" para centrar al jugador
    ctx.translate(-playerX, -playerY);
    // ¡CRÍTICO para pixel art!
    ctx.imageSmoothingEnabled = false;
}

/**
 * Restaura el contexto del canvas
 * @param {CanvasRenderingContext2D} ctx 
 */
export function restoreCameraTransforms(ctx) {
    ctx.restore();
}