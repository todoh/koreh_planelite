// --- ui.js ---
// Gestiona todos los elementos del DOM (HTML) y sus eventos,
// excepto el canvas.

// --- ¡NUEVAS IMPORTACIONES! ---
import { getInventory } from './inventory.js';
import { ITEM_DEFINITIONS } from './items.js';
import { IMAGES } from './generation.js'; // Para obtener las imágenes

// --- CACHÉ DE ELEMENTOS DEL DOM ---
// ¡MODIFICADO!
let $messageOverlay, $menuToggleBtn, $menuModal, $closeModalBtn;
let $zoomInBtn, $zoomOutBtn, $saveBtn, $modalSaveBtn, $loadFileInput;
// --- ¡NUEVO! Caché para botones de rotación ---
let $rotateLeftBtn, $rotateRightBtn;
// --- FIN DE MODIFICACIÓN ---
let $statsUI = {};
// Nuevos elementos de Firebase
let $firebaseToggleBtn, $firebaseModal, $firebaseCloseBtn;
let $firebaseConfigInput;
let $firebaseEnterBtn, $firebaseMessagePanel; 
let $firebaseProfileName, $firebaseProfilePin;
let $onlineStatusBtn;

// Caché de Inventario
let $inventoryModal, $inventoryCloseBtn, $inventoryGrid;
let $inventoryToggleBtn, $desktopInventoryBtn;

// --- ¡NUEVO! Caché de Crafting ---
let $craftingModal, $craftingCloseBtn;

// ¡NUEVO! Caché del reloj
let $statTime;

// --- ¡NUEVO! Temporizador para mensajes ---
let messageTimer = null;


/**
 * Inicializa todos los listeners del DOM.
 * @param {object} callbacks - { onSave, onLoadFile, onZoomIn, onZoomOut, onCloudLoad, onDisconnect, onRotateLeft, onRotateRight }
 */
export function initializeUI(callbacks) {
    // Poblar caché de elementos
    // ¡MODIFICADO!
    $messageOverlay = document.getElementById('message-overlay');
    // $uiPanel = document.getElementById('ui-panel'); // ELIMINADO
    // $modalUiPanel = document.getElementById('modal-ui-panel'); // ELIMINADO
    $menuToggleBtn = document.getElementById('menu-toggle-btn');
    $menuModal = document.getElementById('menu-modal');
    $closeModalBtn = document.getElementById('close-modal-btn');
    $zoomInBtn = document.getElementById('zoom-in-btn');
    $zoomOutBtn = document.getElementById('zoom-out-btn');
    // --- ¡NUEVO! Poblar caché de rotación ---
    $rotateLeftBtn = document.getElementById('rotate-left-btn');
    $rotateRightBtn = document.getElementById('rotate-right-btn');
    // --- FIN DE MODIFICACIÓN ---
    $saveBtn = document.getElementById('save-btn');
    $loadFileInput = document.getElementById('load-file-input');
    $modalSaveBtn = document.getElementById('modal-save-btn');
    
    // Caché de Stats
    $statsUI = {
        vida: document.getElementById('stat-vida'),
        vidamax: document.getElementById('stat-vidamax'),
        energia: document.getElementById('stat-energia'),
        energiamax: document.getElementById('stat-energiamax'),
    };
    
    // ¡NUEVO! Caché de Reloj
    $statTime = document.getElementById('stat-time');

    // Caché de Firebase
    $firebaseToggleBtn = document.getElementById('firebase-toggle-btn');
    $firebaseModal = document.getElementById('firebase-modal');
    $firebaseCloseBtn = document.getElementById('firebase-close-btn');
    $firebaseConfigInput = document.getElementById('firebase-config-input');
    $firebaseEnterBtn = document.getElementById('firebase-enter-btn'); 
    $firebaseMessagePanel = document.getElementById('firebase-message-panel');
    $firebaseProfileName = document.getElementById('firebase-profile-name');
    $firebaseProfilePin = document.getElementById('firebase-profile-pin');
    $onlineStatusBtn = document.getElementById('online-status-btn');

    // Caché de Inventario
    $inventoryModal = document.getElementById('inventory-modal');
    $inventoryCloseBtn = document.getElementById('inventory-close-btn');
    $inventoryGrid = document.getElementById('inventory-grid');
    $inventoryToggleBtn = document.getElementById('inventory-toggle-btn');
    $desktopInventoryBtn = document.getElementById('desktop-inventory-btn');

    // --- ¡NUEVO! Caché de Crafting ---
    $craftingModal = document.getElementById('crafting-modal');
    $craftingCloseBtn = document.getElementById('crafting-close-btn');


    // Añadir listeners
    addModalListeners();
    // --- ¡MODIFICADO! Llamar a la nueva función ---
    addCameraControlListeners(
        callbacks.onZoomIn, 
        callbacks.onZoomOut,
        callbacks.onRotateLeft,
        callbacks.onRotateRight
    );
    // --- FIN DE MODIFICACIÓN ---
    addSaveLoadListeners(callbacks.onSave, callbacks.onLoadFile);
    addFirebaseListeners(callbacks.onCloudLoad); 
    addInventoryListeners();
    addCraftingListeners(); // ¡NUEVO!

    if ($onlineStatusBtn) {
        $onlineStatusBtn.addEventListener('click', callbacks.onDisconnect);
    }

    // --- ¡NUEVO! Listener para el fundido de salida del mensaje ---
    if ($messageOverlay) {
        $messageOverlay.addEventListener('transitionend', () => {
            // Cuando la transición de 'opacity' termina, si es invisible, ocúltalo.
            if ($messageOverlay.classList.contains('opacity-0')) {
                $messageOverlay.classList.add('hidden');
            }
        });
    }
}

/**
 * Muestra un mensaje en el panel de superposición.
 * @param {string} text 
 */
export function showMessage(text) {
    // --- ¡LÓGICA COMPLETAMENTE REESCRITA! ---

    if (!$messageOverlay) return; // Salir si el panel no existe

    // Limpiar temporizador anterior si existía
    if (messageTimer) {
        clearTimeout(messageTimer);
    }

    // 1. Poner el texto
    $messageOverlay.textContent = text;

    // 2. Mostrar el elemento (quitar 'hidden' y 'opacity-0')
    $messageOverlay.classList.remove('hidden');
    
    // Forzar un "reflow" del navegador.
    // Esto asegura que la clase 'opacity-0' se elimina ANTES de que
    // el navegador intente hacer la transición, permitiendo el "fade-in".
    void $messageOverlay.offsetWidth; 

    // Quitar opacidad para iniciar el fade-in
    $messageOverlay.classList.remove('opacity-0');

    // 3. Iniciar temporizador para ocultar (fade-out)
    messageTimer = setTimeout(() => {
        $messageOverlay.classList.add('opacity-0');
        messageTimer = null;
    }, 3000); // El mensaje dura 3 segundos
}

// --- FUNCIONES DE FIREBASE ---
// ... (Sin cambios en showFirebaseMessage, getFirebaseConfig, getProfileCredentials, setFirebaseConfig, setProfileCredentials, showOnlineStatus, hideOnlineStatus) ...
export function showFirebaseMessage(text) {
    if ($firebaseMessagePanel) $firebaseMessagePanel.textContent = text;
}
export function getFirebaseConfig() {
    return $firebaseConfigInput.value;
}
export function getProfileCredentials() {
    return {
        name: $firebaseProfileName.value.trim(),
        pin: $firebaseProfilePin.value
    };
}
export function setFirebaseConfig(config) {
    if ($firebaseConfigInput) $firebaseConfigInput.value = config;
}
export function setProfileCredentials(name, pin) {
    if ($firebaseProfileName) $firebaseProfileName.value = name;
    if ($firebaseProfilePin) $firebaseProfilePin.value = pin;
}
export function showOnlineStatus() {
    if ($onlineStatusBtn) $onlineStatusBtn.classList.remove('hidden');
}
export function hideOnlineStatus() {
    if ($onlineStatusBtn) $onlineStatusBtn.classList.add('hidden');
}


/**
 * Actualiza el panel de estadísticas (HTML).
 * @param {object} stats - El objeto de estadísticas del juego.
 */
export function renderStats(stats) {
    // ... (Sin cambios) ...
    if ($statsUI.vida) $statsUI.vida.textContent = stats.vida;
    if ($statsUI.vidamax) $statsUI.vidamax.textContent = stats.vidamax;
    if ($statsUI.energia) $statsUI.energia.textContent = stats.energia;
    if ($statsUI.energiamax) $statsUI.energiamax.textContent = stats.energiamax;
}

/**
 * ¡NUEVO! Actualiza el reloj del juego en la UI.
 * @param {number} timeOfDay - Valor de 0.0 a 1.0
 */
export function renderClock(timeOfDay) {
    if (!$statTime) return;

    const totalMinutes = Math.floor(timeOfDay * 24 * 60);
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    const formattedTime = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
    $statTime.textContent = formattedTime;
}


// --- GESTORES INTERNOS ---

// ... (Sin cambios en addModalListeners, toggleMenuModal, addFirebaseListeners, toggleFirebaseModal) ...
function addModalListeners() {
    $menuToggleBtn.addEventListener('click', toggleMenuModal);
    $closeModalBtn.addEventListener('click', toggleMenuModal);
    $menuModal.addEventListener('click', (e) => {
        if (e.target === $menuModal) toggleMenuModal();
    });
}
function toggleMenuModal() {
    $menuModal.classList.toggle('hidden');
}
function addFirebaseListeners(onCloudLoad) { 
    $firebaseToggleBtn.addEventListener('click', toggleFirebaseModal);
    $firebaseCloseBtn.addEventListener('click', toggleFirebaseModal);
    $firebaseModal.addEventListener('click', (e) => {
        if (e.target === $firebaseModal) toggleFirebaseModal();
    });
    $firebaseEnterBtn.addEventListener('click', (e) => { 
        e.stopPropagation();
        onCloudLoad(); 
    });
}
function toggleFirebaseModal() {
    $firebaseModal.classList.toggle('hidden');
}

// --- ¡MODIFICADO! Renombrado de addZoomListeners a addCameraControlListeners ---
function addCameraControlListeners(onZoomIn, onZoomOut, onRotateLeft, onRotateRight) {
    // Listeners de Zoom
    $zoomInBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); onZoomIn(); });
    $zoomOutBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); onZoomOut(); });
    $zoomInBtn.addEventListener('touchstart', (e) => e.stopPropagation());
    $zoomOutBtn.addEventListener('touchstart', (e) => e.stopPropagation());

    // ¡NUEVO! Listeners de Rotación
    if ($rotateLeftBtn) {
        $rotateLeftBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); onRotateLeft(); });
        $rotateLeftBtn.addEventListener('touchstart', (e) => e.stopPropagation());
    }
    if ($rotateRightBtn) {
        $rotateRightBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); onRotateRight(); });
        $rotateRightBtn.addEventListener('touchstart', (e) => e.stopPropagation());
    }
}
// --- FIN DE MODIFICACIÓN ---

function addSaveLoadListeners(onSave, onLoadFile) {
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


// --- GESTORES DE INVENTARIO ---
// ... (Sin cambios en addInventoryListeners, toggleInventoryModal, renderInventory) ...
function addInventoryListeners() {
    if ($inventoryToggleBtn) $inventoryToggleBtn.addEventListener('click', toggleInventoryModal);
    if ($desktopInventoryBtn) $desktopInventoryBtn.addEventListener('click', toggleInventoryModal);
    if ($inventoryCloseBtn) $inventoryCloseBtn.addEventListener('click', toggleInventoryModal);
    
    if ($inventoryModal) {
        $inventoryModal.addEventListener('click', (e) => {
            if (e.target === $inventoryModal) toggleInventoryModal();
        });
    }
}
function toggleInventoryModal() {
    if (!$inventoryModal) return;
    const isHidden = $inventoryModal.classList.toggle('hidden');
    if (!isHidden) {
        renderInventory(); // Renderiza el inventario CADA VEZ que se abre
    }
}
export function renderInventory() {
    if (!$inventoryGrid) return;

    const inventory = getInventory();
    $inventoryGrid.innerHTML = ''; // Limpiar grid

    if (!inventory || inventory.length === 0) {
        $inventoryGrid.innerHTML = '<p class="text-gray-400 col-span-full">El inventario no se ha cargado.</p>';
        return;
    }

    // Por cada slot en el array de inventario...
    inventory.forEach(slot => {
        const $slotDiv = document.createElement('div');
        // Estilos base para CADA slot (lleno o vacío)
        $slotDiv.className = 'aspect-square bg-gray-800 rounded-md border border-gray-700 p-1 flex flex-col items-center justify-center relative overflow-hidden shadow-inner';

        if (slot && slot.itemId) {
            // --- Slot LLENO ---
            const itemDef = ITEM_DEFINITIONS[slot.itemId];
            if (itemDef) {
                const img = IMAGES[itemDef.imageKey];
                if (img) {
                    // Si tenemos la imagen, la mostramos
                    $slotDiv.innerHTML = `
                        <img src="${img.src}" alt="${itemDef.name}" class="w-full h-full object-contain" style="image-rendering: pixelated;" title="${itemDef.name}\n${itemDef.description || ''}">
                        <span class="absolute top-0 left-0 w-full text-xs font-bold bg-black bg-opacity-60 px-1 rounded-b-sm truncate text-center text-white" title="${itemDef.name}">${itemDef.name}</span>
                        <span class="absolute bottom-0 right-0 text-sm font-bold bg-black bg-opacity-60 px-2 rounded-tl-sm text-white">${slot.quantity}</span>
                    `;
                } else {
                    // Si falta la imagen, mostramos texto de error
                    $slotDiv.innerHTML = `<span class="text-xs text-red-400 p-1 text-center">Sin<br>Img</span>`;
                    $slotDiv.title = itemDef.name;
                }
            } else {
                // Si el ID del objeto no existe, mostramos error
                 $slotDiv.innerHTML = `<span class="text-xs text-red-400 p-1 text-center">Error:<br>${slot.itemId}</span>`;
            }
        } else {
            // --- Slot VACÍO ---
            $slotDiv.classList.add('opacity-50'); // hacerlo semi-transparente
        }
        $inventoryGrid.appendChild($slotDiv);
    });
}

// --- ¡NUEVAS FUNCIONES DE MENÚ! ---

/**
 * Añade listeners para el modal de crafting.
 */
function addCraftingListeners() {
    if ($craftingCloseBtn) $craftingCloseBtn.addEventListener('click', () => toggleCraftingModal(false));
    if ($craftingModal) {
        $craftingModal.addEventListener('click', (e) => {
            if (e.target === $craftingModal) toggleCraftingModal(false);
        });
    }
}

/**
 * Muestra/oculta el modal de crafting.
 * @param {boolean} [forceShow] - true para mostrar, false para ocultar.
 */
function toggleCraftingModal(forceShow) {
    if (!$craftingModal) return;
    if (forceShow === true) {
        $craftingModal.classList.remove('hidden');
    } else if (forceShow === false) {
        $craftingModal.classList.add('hidden');
    } else {
        $craftingModal.classList.toggle('hidden');
    }
}

/**
 * ¡FUNCIÓN EXPORTADA! Abre un menú basado en su ID.
 * Llamada desde logic.js (a través de main.js).
 * @param {string} menuId 
 */
export function openMenu(menuId) {
    switch(menuId) {
        case 'CRAFTING':
            toggleCraftingModal(true);
            break;
        // case 'SHOP':
        //    toggleShopModal(true);
        //    break;
        default:
            showMessage(`Error: Menú desconocido '${menuId}'`);
            console.warn(`Se intentó abrir un menú desconocido: ${menuId}`);
    }
}