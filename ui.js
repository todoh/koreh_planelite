// --- ui.js ---
// Gestiona todos los elementos del DOM (HTML) y sus eventos,
// excepto el canvas.

// --- ¡NUEVAS IMPORTACIONES! ---
import * as THREE from 'three';
import { createPlayerMesh } from './player_model.js';
import { updatePlayerModalAnimation } from './player_animation.js';
import { skinMaterial, shirtMaterial, pantsMaterial, shoesMaterial } from './player_skin.js';
// --- FIN DE NUEVAS IMPORTACIONES ---

import { getInventory, hasItems, removeItem, addItem } from './inventory.js';
import { ITEM_DEFINITIONS } from './items.js';
import { IMAGES } from './generation.js'; // Para obtener las imágenes
import { CRAFTING_RECIPES } from './crafting_recipes.js'; // ¡NUEVO!
// --- ¡NUEVA IMPORTACIÓN! ---
import { player } from './logic.js';

import { equipItem, unequipItem, ATTACH_POINT_LEFT_HAND } from './equipment_system.js';
import { createEquipmentMesh } from './models/equipment_factory.js';
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

// --- ¡CACHÉ DE CRAFTEO SIMPLIFICADO! ---
let $craftingModal, $craftingCloseBtn, $craftingModalTitle;
// let $craftingTabAvailable, $craftingTabAll; // ELIMINADOS
let $craftingPanelAvailable;
// let $craftingPanelAll; // ELIMINADO
let $craftingAvailableList;
// let $craftingAllList; // ELIMINADO

// ¡NUEVO! Caché del reloj
let $statTime;

// ¡NUEVO! Caché de Hotbar
let $hotbar;

// --- ¡NUEVO! Caché de Modal de Aspecto (MODIFICADO) ---
let $playerAspectBtn, $playerAspectModal, $playerAspectCloseBtn, $playerAspectPreview, $playerAspectCanvas, $playerAspectControls;
let $aspectColorSkin; //, $aspectColorShirt, $aspectColorPants, $aspectColorShoes; // Controles de ropa eliminados

// --- ¡NUEVO! Estado de la Escena 3D del Modal de Aspecto ---
let aspectScene, aspectCamera, aspectRenderer, aspectPlayerMesh;
let aspectAnimId = null;
let isAspectSceneInit = false;
let aspectSceneClock = new THREE.Clock();
let playerMeshInstance = null;

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

    // --- ¡CACHÉ DE CRAFTEO SIMPLIFICADO! ---
    $craftingModal = document.getElementById('crafting-modal');
    $craftingCloseBtn = document.getElementById('crafting-close-btn');
    $craftingModalTitle = document.getElementById('crafting-modal-title');
    // $craftingTabAvailable = document.getElementById('crafting-tab-available'); // ELIMINADO
    // $craftingTabAll = document.getElementById('crafting-tab-all'); // ELIMINADO
    $craftingPanelAvailable = document.getElementById('crafting-panel-available');
    // $craftingPanelAll = document.getElementById('crafting-panel-all'); // ELIMINADO
    $craftingAvailableList = document.getElementById('crafting-available-list');
    // $craftingAllList = document.getElementById('crafting-all-list'); // ELIMINADO

    // --- ¡NUEVO! Caché de Modal de Aspecto (MODIFICADO) ---
    $playerAspectBtn = document.getElementById('player-aspect-btn');
    $playerAspectModal = document.getElementById('player-aspect-modal');
    $playerAspectCloseBtn = document.getElementById('player-aspect-close-btn');
    $playerAspectPreview = document.getElementById('player-aspect-preview');
    $playerAspectCanvas = document.getElementById('player-aspect-canvas');
    $playerAspectControls = document.getElementById('player-aspect-controls');
    $aspectColorSkin = document.getElementById('aspect-color-skin');
    // $aspectColorShirt = document.getElementById('aspect-color-shirt'); // Eliminado
    // $aspectColorPants = document.getElementById('aspect-color-pants'); // Eliminado
    // $aspectColorShoes = document.getElementById('aspect-color-shoes'); // Eliminado

    // --- ¡NUEVO! Caché de Hotbar ---
    $hotbar = document.getElementById('hotbar');

playerMeshInstance = callbacks.playerMesh;
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
    addPlayerAspectListeners(); // ¡NUEVO!
    initializeHotbar(); // <- ¡NUEVA LLAMADA!

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
    if (!$menuModal.classList.contains('hidden')) {
        // Opcional: Pausar el juego
    } else {
        // Opcional: Reanudar el juego
    }
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
    if (!$firebaseModal.classList.contains('hidden')) {
        toggleMenuModal(false); // Ocultar menú si abrimos este
    }
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
// ... (Sin cambios en addInventoryListeners) ...
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

// --- ¡MODIFICADO! ---
function toggleInventoryModal(forceShow) {
    if (!$inventoryModal) return;
    
    const isHidden = $inventoryModal.classList.contains('hidden');
    let shouldShow = forceShow;
    if (forceShow === undefined) shouldShow = isHidden;

    if (shouldShow) {
        $inventoryModal.classList.remove('hidden');
        $inventoryModal.classList.remove('opacity-0');
        renderInventory(); // Renderiza el inventario CADA VEZ que se abre
        renderHotbar();
    } else {
        $inventoryModal.classList.add('opacity-0');
        // El listener de 'transitionend' se encarga de añadir 'hidden'
        $inventoryModal.addEventListener('transitionend', () => {
            $inventoryModal.classList.add('hidden');
        }, { once: true });
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

// --- ¡NUEVAS FUNCIONES DE HOTBAR! ---

function initializeHotbar() {
    if (!$hotbar) return;

    // Crear 8 slots
    for (let i = 0; i < 8; i++) {
        const $slotDiv = document.createElement('div');
        $slotDiv.className = 'hotbar-slot';
        $slotDiv.dataset.slotIndex = i;

        $slotDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            setActiveHotbarSlot(i);
        });

        $hotbar.appendChild($slotDiv);
    }
    
    // Actualizar el estado visual
    renderHotbar();
    setActiveHotbarSlot(0); // Activar el primer slot por defecto
}

function setActiveHotbarSlot(index) {
    player.activeHotbarSlot = index;

    // --- ¡NUEVA LÓGICA DE EQUIPAMIENTO! ---
    if (playerMeshInstance) { // Asegurarse de que el mesh 3D exista
        const inventory = getInventory();
        const activeItem = inventory[index];
        const itemDef = activeItem ? ITEM_DEFINITIONS[activeItem.itemId] : null;

        // 1. Decidir si equipar o desequipar
        if (!itemDef || activeItem.itemId === 'HAND') {
            // Caso 1: Slot vacío o es "Mano" -> No mostrar nada
            unequipItem(playerMeshInstance, ATTACH_POINT_LEFT_HAND);
        } else {
            // Caso 2: Hay un item -> Intentar crear su mesh
            const itemMesh = createEquipmentMesh(itemDef);
            
            if (itemMesh) {
                // Si el factory creó un mesh (3D o 2D), equiparlo
                equipItem(playerMeshInstance, itemMesh, ATTACH_POINT_LEFT_HAND);
            } else {
                // Si el factory devolvió null (ej. item sin imageKey) -> No mostrar nada
                unequipItem(playerMeshInstance, ATTACH_POINT_LEFT_HAND);
            }
        }
    } else {
        console.warn("setActiveHotbarSlot: playerMeshInstance no está listo.");
    }
    // --- FIN DE NUEVA LÓGICA ---

    // Actualizar clase 'active' (Lógica existente)
    const slots = $hotbar.querySelectorAll('.hotbar-slot');
    slots.forEach(($slot, i) => {
        $slot.classList.toggle('hotbar-slot-active', i === index);
    });
}

// ¡NUEVO! Exportar renderHotbar para llamarla cuando se actualice el inventario
export function renderHotbar() {
    if (!$hotbar) return;

    const inventory = getInventory().slice(0, 8); // Tomar los primeros 8 items
    const slots = $hotbar.querySelectorAll('.hotbar-slot');

    slots.forEach(($slot, i) => {
        const item = inventory[i];
        if (item && item.itemId) {
            const itemDef = ITEM_DEFINITIONS[item.itemId];
            const img = IMAGES[itemDef.imageKey];
            $slot.innerHTML = `
                ${img ? `<img src="${img.src}" alt="${itemDef.name}">` : ''}
                ${item.quantity > 1 ? `<span class="hotbar-quantity">${item.quantity}</span>` : ''}
            `;
            $slot.title = itemDef.name;
        } else {
            $slot.innerHTML = '';
            $slot.title = 'Vacío';
        }
    });
}

// --- --- --- --- --- --- --- --- --- --- ---
// --- ¡NUEVAS FUNCIONES DE CRAFTEO! ---
// --- --- --- --- --- --- --- --- --- --- ---

/**
 * Añade listeners para el modal de crafting.
 */
function addCraftingListeners() {
    if (!$craftingModal) return;

    // Botón de cerrar
    $craftingCloseBtn.addEventListener('click', () => toggleCraftingModal(false));
    
    // Clic fuera del modal
    $craftingModal.addEventListener('click', (e) => {
        if (e.target === $craftingModal) toggleCraftingModal(false);
    });

    // --- ¡CLICS EN PESTAÑAS ELIMINADOS! ---
    // $craftingTabAvailable.addEventListener('click', () => switchCraftingTab('available'));
    // $craftingTabAll.addEventListener('click', () => switchCraftingTab('all'));

    // Listener delegado para botones de "Craftear"
    $craftingModal.addEventListener('click', (e) => {
        // --- ¡MODIFICADO! Simplificado, ya que solo hay una lista
        if (e.target.classList.contains('craft-button')) {
            const button = e.target;
            const recipeId = button.dataset.recipeId;
            const menuId = $craftingModal.dataset.menuId;
            
            if (recipeId && menuId) {
                handleCraftItem(menuId, recipeId);
            }
        }
    });
}

/**
 * Muestra/oculta el modal de crafting.
 * @param {boolean} [forceShow] - true para mostrar, false para ocultar.
 */
function toggleCraftingModal(forceShow) {
    if (!$craftingModal) return;
    
    const isHidden = $craftingModal.classList.contains('hidden');
    let shouldShow = forceShow;
    if (forceShow === undefined) shouldShow = isHidden;

    if (shouldShow) {
        $craftingModal.classList.remove('hidden');
        $craftingModal.classList.remove('opacity-0');
    } else {
        $craftingModal.classList.add('opacity-0');
        $craftingModal.addEventListener('transitionend', () => {
            $craftingModal.classList.add('hidden');
        }, { once: true });
    }
}

/**
 * ¡FUNCIÓN ELIMINADA!
 * Ya no es necesaria.
 */
// function switchCraftingTab(tabName) { ... }

/**
 * ¡FUNCIÓN EXPORTADA! Abre un menú basado en su ID.
 * Llamada desde logic.js (a través de main.js).
 * @param {string} menuId 
 */
export function openMenu(menuId) {
    // Buscar si es un menú de crafteo
    const recipes = CRAFTING_RECIPES[menuId];

    if (recipes) {
        // ¡Es un menú de crafteo!
        
        // 1. Poner título
        let title = "Mesa de Trabajo";
        if (menuId === 'CARPENTRY') title = "Mesa de Carpintero";
        if (menuId === 'COOKING') title = "Caldero";
        if (menuId === 'ALCHEMY') title = "Mesa de Alquimia";
        if (menuId === 'STUDY') title = "Mesa de Estudio";
        $craftingModalTitle.textContent = title;

        // 2. Guardar el ID del menú para los botones de crafteo
        $craftingModal.dataset.menuId = menuId;

        // 3. Poblar la lista (única) de recetas
        populateCraftingLists(menuId, recipes);

        // 4. Resetear a la pestaña "Disponibles"
        // ¡ELIMINADO! switchCraftingTab('available');

        // 5. Mostrar el modal
        toggleCraftingModal(true);

    } else {
        // Lógica de menú antigua (si la hubiera)
        showMessage(`Error: Menú desconocido '${menuId}'`);
        console.warn(`Se intentó abrir un menú desconocido: ${menuId}`);
    }
}

/**
 * ¡FUNCIÓN REFACTORIZADA Y SIMPLIFICADA!
 * Rellena la lista (única) de recetas disponibles.
 * @param {string} menuId - El ID de la mesa (ej: "CARPENTRY")
 * @param {Array<object>} allRecipes - El array de recetas para esta mesa.
 */
function populateCraftingLists(menuId, allRecipes) {
    // Limpiar lista
    $craftingAvailableList.innerHTML = '';
    // $craftingAllList.innerHTML = ''; // ELIMINADO

    let availableCount = 0;

    for (const recipe of allRecipes) {
        const canCraft = hasItems(recipe.requirements);
        
        // ¡LÓGICA SIMPLIFICADA!
        // Solo si se puede craftear, crear la tarjeta y añadirla
        if (canCraft) {
            const $recipeCard = createRecipeCard(menuId, recipe, canCraft);
            $craftingAvailableList.appendChild($recipeCard);
            availableCount++;
        }
    }

    // Poner mensajes de "vacío" si es necesario
    if (availableCount === 0) {
        $craftingAvailableList.innerHTML = `<p class="text-gray-400 text-center p-4">No tienes materiales para craftear nada.</p>`;
    }
    // ¡Bloque "All" ELIMINADO!
}

/**
 * ¡FUNCIÓN REFACTORIZADA!
 * Crea el elemento HTML para una sola tarjeta de receta (diseño adaptable).
 * @param {string} menuId
 * @param {object} recipe
 * @param {boolean} canCraft
 * @returns {HTMLElement}
 */
function createRecipeCard(menuId, recipe, canCraft) {
    const $card = document.createElement('div');
    $card.className = 'recipe-card';

    // 1. Info del Item (Imagen y Nombre)
    const itemDef = ITEM_DEFINITIONS[recipe.itemId];
    const img = IMAGES[itemDef.imageKey];
    const quantity = recipe.quantity || 1;

    // --- ¡MODIFICADO! Se ha añadido un div wrapper para la imagen ---
   const infoHtml = `
        <div class="flex items-center gap-3">
            <div class="recipe-card-img-wrapper"> 
                <img src="${img ? img.src : ''}" alt="${itemDef.name}" class="recipe-card-img">
            </div>
            <div>
                <h4 class="font-bold text-white">${itemDef.name} ${quantity > 1 ? `(x${quantity})` : ''}</h4>
                <span class="text-sm text-gray-400">${itemDef.description || ''}</span>
            </div>
        </div>
    `;
    // --- FIN DE LA MODIFICACIÓN ---

    // 2. Requisitos
    const requirementsString = recipe.requirements
        .map(req => {
            const reqDef = ITEM_DEFINITIONS[req.itemId];
            const name = reqDef ? reqDef.name : '???';
            return `${req.quantity}x ${name}`;
        })
        .join(', ');

    const reqColorClass = canCraft ? 'text-gray-300' : 'text-red-400';

    const reqHtml = `
        <div class="md:text-right">
            <p class="text-sm font-medium ${reqColorClass}">${requirementsString || 'Sin requisitos'}</p>
        </div>
    `;

    // 3. Botón de Craftear
    const buttonHtml = `
        <button 
            class="craft-button" 
            data-menu-id="${menuId}" 
            data-recipe-id="${recipe.itemId}"
            ${canCraft ? '' : 'disabled'}
        >
            Craftear
        </button>
    `;

    // Ensamblar tarjeta (NUEVA ESTRUCTURA ADAPTABLE)
    $card.innerHTML = `
        <div class="flex-grow ${reqColorClass}">
            ${infoHtml}
        </div>
        <div class="flex-grow mt-2 md:mt-0">
            ${reqHtml}
        </div>
        <div class="flex-shrink-0 mt-3 md:mt-0 md:ml-4">
            ${buttonHtml}
        </div>
    `;
    
    return $card;
}


/**
 * Lógica que se ejecuta al pulsar un botón de "Craftear".
 * @param {string} menuId 
 * @param {string} recipeId 
 */
function handleCraftItem(menuId, recipeId) {
    const recipe = CRAFTING_RECIPES[menuId]?.find(r => r.itemId === recipeId);
    if (!recipe) {
        console.error(`Receta ${recipeId} no encontrada en ${menuId}`);
        return;
    }

    // 1. Doble comprobación de materiales
    if (hasItems(recipe.requirements)) {
        // 2. Consumir materiales
        for (const req of recipe.requirements) {
            removeItem(req.itemId, req.quantity);
        }

        // 3. Añadir item resultado
        const quantity = recipe.quantity || 1;
        addItem(recipe.itemId, quantity);

        // 4. Feedback
        showMessage(`¡Has crafteado ${quantity}x ${recipe.name}!`);
        
        // 5. Actualizar UI
        renderHotbar();
        if (!$inventoryModal.classList.contains('hidden')) {
            renderInventory(); // Actualizar inventario si está abierto
        }
        
        // 6. Refrescar listas de crafteo (ahora solo refresca la lista de disponibles)
        populateCraftingLists(menuId, CRAFTING_RECIPES[menuId]);

    } else {
        // Esto puede pasar si craftean algo que consume materiales
        // para la siguiente receta
        showMessage("Ya no tienes los materiales necesarios.");
        populateCraftingLists(menuId, CRAFTING_RECIPES[menuId]);
    }
}


// --- --- --- --- --- --- --- --- --- --- --- ---
// --- ¡NUEVAS FUNCIONES PARA EL MODAL DE ASPECTO! ---
// --- --- --- --- --- --- --- --- --- --- --- ---

/**
 * Añade listeners para el modal de aspecto del jugador.
 */
function addPlayerAspectListeners() {
    if (!$playerAspectBtn) return;

    $playerAspectBtn.addEventListener('click', () => togglePlayerAspectModal(true));
    $playerAspectCloseBtn.addEventListener('click', () => togglePlayerAspectModal(false));
    $playerAspectModal.addEventListener('click', (e) => {
        if (e.target === $playerAspectModal) togglePlayerAspectModal(false);
    });
}

/**
 * Muestra u oculta el modal de aspecto.
 * @param {boolean} show - True para mostrar, false para ocultar.
 */
function togglePlayerAspectModal(show) {
    if (!$playerAspectModal) return;
    
    if (show) {
        if (!isAspectSceneInit) {
            initPlayerAspectScene();
        }
        $playerAspectModal.classList.remove('hidden');
        $playerAspectModal.classList.remove('opacity-0');
        startPlayerAspectAnimation();
        // Sincronizar los inputs de color con los materiales actuales (MODIFICADO)
        $aspectColorSkin.value = `#${skinMaterial.color.getHexString()}`;
        // $aspectColorShirt.value = `#${shirtMaterial.color.getHexString()}`; // Eliminado
        // $aspectColorPants.value = `#${pantsMaterial.color.getHexString()}`; // Eliminado
        // $aspectColorShoes.value = `#${shoesMaterial.color.getHexString()}`; // Eliminado
    } else {
        $playerAspectModal.classList.add('opacity-0');
        $playerAspectModal.addEventListener('transitionend', () => {
            $playerAspectModal.classList.add('hidden');
            stopPlayerAspectAnimation();
        }, { once: true });
    }
}

/**
 * Inicializa la escena 3D secundaria para el modal de aspecto.
 * Se llama solo una vez.
 */
function initPlayerAspectScene() {
    if (isAspectSceneInit || !$playerAspectCanvas || !$playerAspectPreview) return;

    const width = $playerAspectPreview.clientWidth;
    const height = $playerAspectPreview.clientHeight;

    // 1. Escena
    aspectScene = new THREE.Scene();
    aspectScene.background = null; // Transparente

    // 2. Cámara
    aspectCamera = new THREE.PerspectiveCamera(50, width / height, 1, 1000);
    
    // 3. Renderer
    aspectRenderer = new THREE.WebGLRenderer({
        canvas: $playerAspectCanvas,
        alpha: true, // Fondo transparente
        antialias: true
    });
    aspectRenderer.setPixelRatio(window.devicePixelRatio);
    aspectRenderer.setSize(width, height);
    
    // 4. Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); // Más brillante para el modal
    aspectScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(0, 10, 5);
    aspectScene.add(directionalLight);

    // 5. Malla del Jugador
    aspectPlayerMesh = createPlayerMesh();
    // Centrar y posicionar la cámara para ver al jugador
    const playerHeight = aspectPlayerMesh.userData.height || 80;
    aspectCamera.position.set(0, playerHeight / 2, 120); // Mirar al centro del cuerpo, un poco alejado
    aspectCamera.lookAt(0, playerHeight / 2, 0);
    aspectScene.add(aspectPlayerMesh);
    
    // 6. Listeners de controles (MODIFICADO)
    $aspectColorSkin.addEventListener('input', (e) => {
        const newColor = new THREE.Color(e.target.value); // <-- ¡LÍNEA MODIFICADA!
        skinMaterial.color.set(newColor); // <-- ¡LÍNEA MODIFICADA!
        skinMaterial.userData.baseColor.set(newColor); // <-- ¡LÍNEA AÑADIDA!
    });
    // $aspectColorShirt.addEventListener('input', (e) => shirtMaterial.color.set(e.target.value)); // Eliminado
    // $aspectColorPants.addEventListener('input', (e) => pantsMaterial.color.set(e.target.value)); // Eliminado
    // $aspectColorShoes.addEventListener('input', (e) => shoesMaterial.color.set(e.target.value)); // Eliminado

    // 7. Observador de Redimensionado
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const w = entry.contentRect.width;
            const h = entry.contentRect.height;
            if (w > 0 && h > 0) {
                aspectRenderer.setSize(w, h);
                aspectCamera.aspect = w / h;
                aspectCamera.updateProjectionMatrix();
            }
        }
    });
    resizeObserver.observe($playerAspectPreview);

    isAspectSceneInit = true;
}

/**
 * Inicia el bucle de animación para la escena del modal.
 */
function startPlayerAspectAnimation() {
    if (aspectAnimId) {
        cancelAnimationFrame(aspectAnimId);
    }
    
    function animate() {
        if (!aspectRenderer || !aspectScene || !aspectCamera || !aspectPlayerMesh) return;
        
        const deltaTime = aspectSceneClock.getDelta();
        
        // Aplicar animación de respiración
        updatePlayerModalAnimation(aspectPlayerMesh, deltaTime);

        // Rotar lentamente al jugador
        aspectPlayerMesh.rotation.y += 0.005; 

        // Renderizar
        aspectRenderer.render(aspectScene, aspectCamera);
        
        aspectAnimId = requestAnimationFrame(animate);
    }
    
    animate();
}

/**
 * Detiene el bucle de animación para la escena del modal.
 */
function stopPlayerAspectAnimation() {
    if (aspectAnimId) {
        cancelAnimationFrame(aspectAnimId);
        aspectAnimId = null;
    }
}