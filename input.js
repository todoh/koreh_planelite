// --- input.js ---
// Gestiona todos los listeners de entrada (teclado, ratón, táctil, rueda)

// --- ESTADO DE ENTRADA ---
const inputState = {
    up: false, down: false, left: false, right: false,
    interact: false
};

// --- ESTADO DE TAP (TÁCTIL) ---
let touchTapState = {
    id: null
    // startTime: 0, startX: 0, startY: 0 // <-- Ya no se necesitan
};

// --- ESTADO DE TAP (MOUSE) ---
let mouseTapState = {
    isDown: false
    // startTime: 0, startX: 0, startY: 0 // <-- Ya no se necesitan
};

// --- ¡NUEVO! Estado de movimiento ---
let didMoveSinceTap = false;

// --- ¡ELIMINADO! ---
// const MAX_TAP_TIME = 200; // ms
// const MAX_TAP_DISTANCE = 10; // px

// --- ¡MODIFICADO! ---
let onHoldStartCallback = () => {};
let onHoldMoveCallback = () => {};
let onHoldEndCallback = (didMove) => {}; // <-- ¡Acepta argumento!
// --- FIN DE MODIFICACIÓN ---

let onWheelCallback = () => {};

/**
 * Inicializa todos los listeners de entrada.
 * @param {HTMLCanvasElement} $canvas
 * @param {object} callbacks - { onHoldStart, onHoldMove, onHoldEnd, onWheel }
 */
export function initializeInput($canvas, callbacks) {
    // --- ¡MODIFICADO! ---
    onHoldStartCallback = callbacks.onHoldStart || onHoldStartCallback;
    onHoldMoveCallback = callbacks.onHoldMove || onHoldMoveCallback;
    onHoldEndCallback = callbacks.onHoldEnd || onHoldEndCallback;
    // --- FIN DE MODIFICACIÓN ---
    onWheelCallback = callbacks.onWheel || onWheelCallback;

    addKeyListeners();
    addTouchListeners($canvas);
    addMouseListeners($canvas);
    addWheelListener($canvas);
}

/**
 * Devuelve el estado actual de las teclas de movimiento/interacción.
 */
export function getInputState() {
    return inputState;
}

// --- GESTORES INTERNOS ---

function addKeyListeners() {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function addTouchListeners($canvas) {
    $canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    // --- ¡AÑADIDO! ---
    $canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    // --- FIN DE AÑADIDO ---
    $canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
}

function addMouseListeners($canvas) {
    $canvas.addEventListener('mousedown', handleMouseDown, { passive: false });
    // --- ¡AÑADIDO! ---
    $canvas.addEventListener('mousemove', handleMouseMove, { passive: false });
    // --- FIN DE AÑADIDO ---
    $canvas.addEventListener('mouseup', handleMouseUp, { passive: false });
    $canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { passive: false });
}

function addWheelListener($canvas) {
    $canvas.addEventListener('wheel', handleWheel, { passive: false });
}

// --- MANEJO DE ENTRADA (Input) ---

function handleKeyDown(e) {
    // ¡NUEVO! Si estamos en un input, no mover al jugador.
    const targetTag = e.target ? e.target.tagName.toLowerCase() : '';
    if (targetTag === 'input' || targetTag === 'textarea') return;
    
    // ¡NUEVO! Comprobación de seguridad por si e.key es undefined
    if (!e.key) return; 

    if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
    switch (e.key) {
        case 'ArrowUp': case 'w': inputState.up = true; break;
        case 'ArrowDown': case 's': inputState.down = true; break;
        case 'ArrowLeft': case 'a': inputState.left = true; break;
        case 'ArrowRight': case 'd': inputState.right = true; break;
        case ' ': case 'Enter': inputState.interact = true; break;
    }
}

function handleKeyUp(e) {
    // ¡NUEVO! Si estamos en un input, no mover al jugador.
    const targetTag = e.target ? e.target.tagName.toLowerCase() : '';
    if (targetTag === 'input' || targetTag === 'textarea') return;

    // ¡NUEVO! Comprobación de seguridad por si e.key es undefined
    if (!e.key) return; 

    if (e.key.startsWith('Arrow')) e.preventDefault();
    switch (e.key) {
        case 'ArrowUp': case 'w': inputState.up = false; break;
        case 'ArrowDown': case 's': inputState.down = false; break;
        case 'ArrowLeft': case 'a': inputState.left = false; break;
        case 'ArrowRight': case 'd': inputState.right = false; break;
    }
}

// --- ¡handleTouchStart MODIFICADO! ---
function handleTouchStart(e) {
    e.preventDefault();
    if (touchTapState.id !== null) return; 
    const touch = e.changedTouches[0]; 
    touchTapState.id = touch.identifier;
    
    // ¡NUEVO!
    didMoveSinceTap = false;

    // ¡Llamar al callback de INICIO!
    onHoldStartCallback(touch.clientX, touch.clientY);
}

// --- ¡NUEVA FUNCIÓN handleTouchMove! ---
function handleTouchMove(e) {
    e.preventDefault();
    let touch = null;
    for (const t of e.changedTouches) {
        if (t.identifier === touchTapState.id) { touch = t; break; }
    }
    if (!touch) return;
    
    // ¡NUEVO!
    didMoveSinceTap = true;
    
    // ¡Llamar al callback de MOVER!
    onHoldMoveCallback(touch.clientX, touch.clientY);
}

// --- ¡handleTouchEnd MODIFICADO! ---
function handleTouchEnd(e) {
    e.preventDefault();
    let touch = null;
    for (const t of e.changedTouches) {
        if (t.identifier === touchTapState.id) { touch = t; break; }
    }
    if (!touch) return;
    
    touchTapState.id = null;
    
    // ¡Llamar al callback de FIN!
    onHoldEndCallback(didMoveSinceTap); // <-- ¡Pasar flag!
}

// --- ¡handleMouseDown MODIFICADO! ---
function handleMouseDown(e) {
    e.preventDefault();
    const targetId = e.target.id || (e.target.htmlFor || '');
    const isUIButton = targetId.includes('btn') || targetId.includes('input');
    
    if (e.button !== 0 || (mouseTapState.isDown && !isUIButton)) {
        if (isUIButton) return;
        e.stopPropagation();
        return;
    }
    
    if(isUIButton) return; 

    mouseTapState.isDown = true;
    
    // ¡NUEVO!
    didMoveSinceTap = false;
    
    // ¡Llamar al callback de INICIO!
    onHoldStartCallback(e.clientX, e.clientY);
}

// --- ¡NUEVA FUNCIÓN handleMouseMove! ---
function handleMouseMove(e) {
    e.preventDefault();
    if (!mouseTapState.isDown) return; // Solo si estamos pulsando
    
    // ¡NUEVO!
    didMoveSinceTap = true;
    
    // ¡Llamar al callback de MOVER!
    onHoldMoveCallback(e.clientX, e.clientY);
}


// --- ¡handleMouseUp MODIFICADO! ---
function handleMouseUp(e) {
    e.preventDefault();
    if (e.button !== 0) return; 
    
    const targetId = e.target.id || (e.target.htmlFor || '');
    const isUIButton = targetId.includes('btn') || targetId.includes('input');
    
    if (isUIButton) {
        mouseTapState.isDown = false;
        return;
    }
    if (!mouseTapState.isDown) return; 
    
    mouseTapState.isDown = false; 
    
    // ¡Llamar al callback de FIN!
    onHoldEndCallback(didMoveSinceTap); // <-- ¡Pasar flag!
}


function handleWheel(e) {
    e.preventDefault();
    onWheelCallback(e);
}