// --- ui.js ---
// Gestiona todos los elementos del DOM (HTML) y sus eventos,
// excepto el canvas.

// --- CACHÉ DE ELEMENTOS DEL DOM ---
let $uiPanel, $modalUiPanel, $menuToggleBtn, $menuModal, $closeModalBtn;
let $zoomInBtn, $zoomOutBtn, $saveBtn, $modalSaveBtn, $loadFileInput;
let $statsUI = {};
// Nuevos elementos de Firebase
let $firebaseToggleBtn, $firebaseModal, $firebaseCloseBtn;
let $firebaseConfigInput;
let $firebaseEnterBtn, $firebaseMessagePanel; // MODIFICADO
// ¡NUEVOS! Campos de perfil
let $firebaseProfileName, $firebaseProfilePin;
// Botón de estado online
let $onlineStatusBtn;

/**
 * Inicializa todos los listeners del DOM.
 * @param {object} callbacks - { onSave, onLoadFile, onZoomIn, onZoomOut, onCloudLoad, onDisconnect }
 */
export function initializeUI(callbacks) {
    // Poblar caché de elementos
    $uiPanel = document.getElementById('ui-panel');
    $modalUiPanel = document.getElementById('modal-ui-panel');
    $menuToggleBtn = document.getElementById('menu-toggle-btn');
    $menuModal = document.getElementById('menu-modal');
    $closeModalBtn = document.getElementById('close-modal-btn');
    $zoomInBtn = document.getElementById('zoom-in-btn');
    $zoomOutBtn = document.getElementById('zoom-out-btn');
    $saveBtn = document.getElementById('save-btn');
    $loadFileInput = document.getElementById('load-file-input');
    $modalSaveBtn = document.getElementById('modal-save-btn');
    
    // Caché de Stats
    $statsUI = {
        vida: document.getElementById('stat-vida'),
        vidamax: document.getElementById('stat-vidamax'),
        energia: document.getElementById('stat-energia'),
        energiamax: document.getElementById('stat-energiamax'),
        oro: document.getElementById('stat-oro'),
        madera: document.getElementById('stat-madera'),
        piedra: document.getElementById('stat-piedra'),
        modalOro: document.getElementById('modal-stat-oro'),
        modalMadera: document.getElementById('modal-stat-madera'),
        modalPiedra: document.getElementById('modal-stat-piedra'),
    };
    
    // Caché de Firebase (Actualizado)
    $firebaseToggleBtn = document.getElementById('firebase-toggle-btn');
    $firebaseModal = document.getElementById('firebase-modal');
    $firebaseCloseBtn = document.getElementById('firebase-close-btn');
    $firebaseConfigInput = document.getElementById('firebase-config-input');
    $firebaseEnterBtn = document.getElementById('firebase-enter-btn'); // MODIFICADO
    $firebaseMessagePanel = document.getElementById('firebase-message-panel');

    // ¡NUEVO! Caché de campos de perfil
    $firebaseProfileName = document.getElementById('firebase-profile-name');
    $firebaseProfilePin = document.getElementById('firebase-profile-pin');

    // Caché de botón online
    $onlineStatusBtn = document.getElementById('online-status-btn');


    // Añadir listeners
    addModalListeners();
    addZoomListeners(callbacks.onZoomIn, callbacks.onZoomOut);
    addSaveLoadListeners(callbacks.onSave, callbacks.onLoadFile);
    // Nuevos listeners de Firebase
    addFirebaseListeners(callbacks.onCloudLoad); // Se mantiene onCloudLoad como "nombre" del callback

    // Listener para desconexión
    if ($onlineStatusBtn) {
        $onlineStatusBtn.addEventListener('click', callbacks.onDisconnect);
    }
}

/**
 * Muestra un mensaje en los paneles de UI.
 * @param {string} text 
 */
export function showMessage(text) {
    if ($uiPanel) $uiPanel.textContent = text;
    if ($modalUiPanel) $modalUiPanel.textContent = text;
}

// --- ¡NUEVAS FUNCIONES EXPORTADAS PARA FIREBASE! ---

/**
 * Muestra un mensaje en el panel de Firebase.
 * @param {string} text 
 */
export function showFirebaseMessage(text) {
    if ($firebaseMessagePanel) $firebaseMessagePanel.textContent = text;
}

/**
 * Obtiene el texto de configuración de Firebase.
 * @returns {string}
 */
export function getFirebaseConfig() {
    return $firebaseConfigInput.value;
}

/**
 * ¡NUEVO! Obtiene las credenciales del perfil.
 * @returns {{name: string, pin: string}}
 */
export function getProfileCredentials() {
    return {
        name: $firebaseProfileName.value.trim(),
        pin: $firebaseProfilePin.value
    };
}

/**
 * ¡NUEVO! Establece el texto de configuración de Firebase.
 * (Usado por main.js al recargar en modo online)
 * @param {string} config
 */
export function setFirebaseConfig(config) {
    if ($firebaseConfigInput) $firebaseConfigInput.value = config;
}

/**
 * ¡NUEVO! Establece las credenciales del perfil (al recargar).
 * @param {string} name
 * @param {string} pin
 */
export function setProfileCredentials(name, pin) {
    if ($firebaseProfileName) $firebaseProfileName.value = name;
    if ($firebaseProfilePin) $firebaseProfilePin.value = pin;
}


/**
 * ¡NUEVO! Muestra el indicador de estado online.
 */
export function showOnlineStatus() {
    if ($onlineStatusBtn) $onlineStatusBtn.classList.remove('hidden');
}

/**
 * ¡NUEVO! Oculta el indicador de estado online.
 */
export function hideOnlineStatus() {
    if ($onlineStatusBtn) $onlineStatusBtn.classList.add('hidden');
}

/**
 * Actualiza el panel de estadísticas (HTML).
 * @param {object} stats - El objeto de estadísticas del juego.
 */
export function renderStats(stats) {
    // ¡MODIFICADO! Añadidos checks de nulidad para evitar crasheos
    // si un elemento del DOM no se encuentra.
    if ($statsUI.vida) $statsUI.vida.textContent = stats.vida;
    if ($statsUI.vidamax) $statsUI.vidamax.textContent = stats.vidamax;
    if ($statsUI.energia) $statsUI.energia.textContent = stats.energia;
    if ($statsUI.energiamax) $statsUI.energiamax.textContent = stats.energiamax;
    if ($statsUI.oro) $statsUI.oro.textContent = stats.oro;
    if ($statsUI.madera) $statsUI.madera.textContent = stats.madera;
    if ($statsUI.piedra) $statsUI.piedra.textContent = stats.piedra;
    if ($statsUI.modalOro) $statsUI.modalOro.textContent = stats.oro;
    if ($statsUI.modalMadera) $statsUI.modalMadera.textContent = stats.madera;
    if ($statsUI.modalPiedra) $statsUI.modalPiedra.textContent = stats.piedra;
}

// --- GESTORES INTERNOS ---

function addModalListeners() {
    // ... (sin cambios)
    $menuToggleBtn.addEventListener('click', toggleMenuModal);
    $closeModalBtn.addEventListener('click', toggleMenuModal);
    $menuModal.addEventListener('click', (e) => {
        if (e.target === $menuModal) toggleMenuModal();
    });
}

function toggleMenuModal() {
    $menuModal.classList.toggle('hidden');
}

/**
 * Gestor para el modal de Firebase.
 */
function addFirebaseListeners(onCloudLoad) { // Modificado
    $firebaseToggleBtn.addEventListener('click', toggleFirebaseModal);
    $firebaseCloseBtn.addEventListener('click', toggleFirebaseModal);
    $firebaseModal.addEventListener('click', (e) => {
        if (e.target === $firebaseModal) toggleFirebaseModal();
    });

    // Conectar botones a los callbacks
    
    $firebaseEnterBtn.addEventListener('click', (e) => { // MODIFICADO
        e.stopPropagation();
        onCloudLoad(); // main.js pasará la función 'handleCloudEnter' aquí
    });
}

/**
 * Función para mostrar/ocultar el modal de Firebase.
 */
function toggleFirebaseModal() {
    $firebaseModal.classList.toggle('hidden');
}

function addZoomListeners(onZoomIn, onZoomOut) {
    // ... (sin cambios)
    $zoomInBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); onZoomIn(); });
    $zoomOutBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); onZoomOut(); });
    $zoomInBtn.addEventListener('touchstart', (e) => e.stopPropagation());
    $zoomOutBtn.addEventListener('touchstart', (e) => e.stopPropagation());
}

function addSaveLoadListeners(onSave, onLoadFile) {
    // ... (lógica existente sin cambios)
    $saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onSave();
    });
    $modalSaveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onSave();
        toggleMenuModal(); 
    });
    $loadFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            onLoadFile(file);
        }
        e.target.value = null; 
        if ($menuModal.classList.contains('hidden') === false) {
             toggleMenuModal();
        }
    });
}