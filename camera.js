// --- camera.js ---
// Gestiona el estado de la cámara (zoom)
// y las transformaciones del canvas.

// --- ESTADO DE LA CÁMARA ---
const camera = {
    width: 0,
    height: 0
};

let currentZoom = 1.0;
let targetZoom = 1.0; // Para zoom suave (no implementado, pero listo)
const ZOOM_STEP = 0.15;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 3.0;

// --- LÓGICA DE ROTACIÓN ELIMINADA ---
// export let currentRotation = 0.0;
// let targetRotation = 0.0;
// const ROTATION_STEP = Math.PI / 4; 
// const LERP_FACTOR = 0.1; 
// const PI2 = Math.PI * 2;

/**
 * Inicializa la cámara con el tamaño del canvas
 * @param {HTMLCanvasElement} $canvas 
 */
export function initializeCamera($canvas) {
    resizeCamera($canvas);
}

/**
 * Actualiza las dimensiones de la cámara (al reescalar)
 * @param {HTMLCanvasElement} $canvas 
 */
export function resizeCamera($canvas) {
    camera.width = $canvas.width;
    camera.height = $canvas.height;
    console.log(`Cámara redimensionada a ${camera.width}x${camera.height}`);
}

/**
 * Modifica el nivel de zoom
 * @param {boolean} zoomIn 
 */
export function handleZoom(zoomIn) {
    if (zoomIn) {
        targetZoom = Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP);
    } else {
        targetZoom = Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP);
    }
    currentZoom = targetZoom; // Por ahora, sin suavizado
    console.log(`Zoom nivel: ${currentZoom}`);
}

/**
 * Función de rotación ELIMINADA
 */
// export function handleRotation(clockwise) { ... }

/**
 * Maneja el zoom con la rueda del ratón
 * @param {WheelEvent} e 
 */
export function handleWheel(e) {
    e.preventDefault();
    if (e.deltaY < 0) {
        handleZoom(true);
    } else if (e.deltaY > 0) {
        handleZoom(false);
    }
}

/**
 * Función de interpolación de rotación ELIMINADA
 */
export function updateCamera() {
    // Esta función ahora está vacía, pero la mantenemos
    // por si queremos añadir interpolación de zoom en el futuro.
    
    // Lógica de rotación eliminada:
    // let angleDiff = targetRotation - currentRotation;
    // ...
    // currentRotation += angleDiff * LERP_FACTOR;
}

/**
 * Calcula el AABB (Caja Delimitadora Alineada con Ejes) del viewport
 * (Simplificado para 0 rotación)
 * @param {number} playerX 
 * @param {number} playerY 
 * @returns {object} { minX, minY, maxX, maxY }
 */
export function getViewportAABB(playerX, playerY) {
    const visibleWorldWidth = camera.width / currentZoom;
    const visibleWorldHeight = camera.height / currentZoom;

    const halfWidth = visibleWorldWidth / 2;
    const halfHeight = visibleWorldHeight / 2;

    // Cálculo simplificado sin rotación
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
    // 1. Coordenadas relativas al centro de la pantalla y escaladas por zoom
    const relativeX = (screenX - camera.width / 2) / currentZoom;
    const relativeY = (screenY - camera.height / 2) / currentZoom;

    // 2. "Des-rotar" -> ELIMINADO
    // const r = currentRotation; ...

    // 3. Añadir la posición del jugador para obtener coordenadas del mundo
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
    // ctx.rotate(-currentRotation);
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