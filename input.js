// --- input.js ---
// Gestiona todos los listeners de entrada (teclado, ratón, táctil, rueda)

// --- ESTADO DE ENTRADA ---
const inputState = {
    up: false, down: false, left: false, right: false,
    interact: false
};

// --- ESTADO DE TAP (TÁCTIL) ---
let touchTapState = {
    id: null, startTime: 0, startX: 0, startY: 0
};

// --- ESTADO DE TAP (MOUSE) ---
let mouseTapState = {
    isDown: false, startTime: 0, startX: 0, startY: 0
};

const MAX_TAP_TIME = 200; // ms
const MAX_TAP_DISTANCE = 10; // px

let onTapCallback = () => {};
let onWheelCallback = () => {};

/**
 * Inicializa todos los listeners de entrada.
 * @param {HTMLCanvasElement} $canvas
 * @param {object} callbacks - { onTap, onWheel }
 */
export function initializeInput($canvas, callbacks) {
    onTapCallback = callbacks.onTap || onTapCallback;
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
    $canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
}

function addMouseListeners($canvas) {
    $canvas.addEventListener('mousedown', handleMouseDown, { passive: false });
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

function handleTouchStart(e) {
    e.preventDefault();
    if (touchTapState.id !== null) return; 
    const touch = e.changedTouches[0]; 
    touchTapState.id = touch.identifier;
    touchTapState.startTime = Date.now();
    touchTapState.startX = touch.clientX;
    touchTapState.startY = touch.clientY;
}

function handleTouchEnd(e) {
    e.preventDefault();
    let touch = null;
    for (const t of e.changedTouches) {
        if (t.identifier === touchTapState.id) { touch = t; break; }
    }
    if (!touch) return;
    touchTapState.id = null;
    const tapDuration = Date.now() - touchTapState.startTime;
    const dx = touch.clientX - touchTapState.startX;
    const dy = touch.clientY - touchTapState.startY;
    const tapDistance = Math.sqrt(dx*dx + dy*dy);
    if (tapDuration < MAX_TAP_TIME && tapDistance < MAX_TAP_DISTANCE) {
        onTapCallback(touch.clientX, touch.clientY);
    }
}

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
    mouseTapState.startTime = Date.now();
    mouseTapState.startX = e.clientX;
    mouseTapState.startY = e.clientY;
}

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
    const tapDuration = Date.now() - mouseTapState.startTime;
    const dx = e.clientX - mouseTapState.startX;
    const dy = e.clientY - mouseTapState.startY;
    const tapDistance = Math.sqrt(dx*dx + dy*dy);
    if (tapDuration < MAX_TAP_TIME && tapDistance < MAX_TAP_DISTANCE) {
        onTapCallback(e.clientX, e.clientY);
    }
}

function handleWheel(e) {
    e.preventDefault();
    onWheelCallback(e);
}