import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, enableIndexedDbPersistence, serverTimestamp } 
from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🔴 HIER DEINE FIREBASE-DATEN EINTRAGEN 🔴
const firebaseConfig = {
  apiKey: "AIzaSyD4_6P8J_4H3EP1phrWIca8tMHl0rhox-0",
  authDomain: "einkaufliste-app.firebaseapp.com",
  projectId: "einkaufliste-app",
  storageBucket: "einkaufliste-app.firebasestorage.app",
  messagingSenderId: "863186045446",
  appId: "1:863186045446:web:b2b242b79c0b2ed5519187",
  measurementId: "G-MZ6FVT4B0W"
};

// Firebase initialisieren
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Offline-Modus aktivieren
enableIndexedDbPersistence(db).catch((err) => {
    console.log("Offline-Modus Fehler: ", err.code);
});

// UI Elemente
const itemForm = document.getElementById("item-form");
const itemNameInput = document.getElementById("item-name");
const itemCategoryInput = document.getElementById("item-category");
const shoppingList = document.getElementById("shopping-list");
const emptyState = document.getElementById("empty-state");
const itemCount = document.getElementById("item-count");
const remainingCount = document.getElementById("remaining-count");
const clearCompletedButton = document.getElementById("clear-completed");
const categoryFilter = document.getElementById("category-filter");
const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editItemNameInput = document.getElementById("edit-item-name");
const editItemCategoryInput = document.getElementById("edit-item-category");
const closeEditModalButton = document.getElementById("close-edit-modal");
const cancelEditButton = document.getElementById("cancel-edit");
const manageCategoriesButton = document.getElementById("manage-categories");
const categoryModal = document.getElementById("category-modal");
const closeCategoryModalButton = document.getElementById("close-category-modal");
const categorySearchInput = document.getElementById("category-search");
const categorySortInput = document.getElementById("category-sort");
const managerCategoryInput = document.getElementById("manager-category-input");
const managerAddCategoryButton = document.getElementById("manager-add-category");
const categoryManagerList = document.getElementById("category-manager-list");
const undoToast = document.getElementById("undo-toast");
const undoMessage = document.getElementById("undo-message");
const undoDeleteButton = document.getElementById("undo-delete");
const filterButtons = document.querySelectorAll(".filter-button");
const connectionStatus = document.getElementById("connection-status");
const shareLinkInput = document.getElementById("share-link");
const copyLinkButton = document.getElementById("copy-link");
const showQrCodeButton = document.getElementById("show-qr-code");
const qrModal = document.getElementById("qr-modal");
const closeQrModalButton = document.getElementById("close-qr-modal");
const cancelQrModalButton = document.getElementById("cancel-qr-modal");
const qrCopyLinkButton = document.getElementById("qr-copy-link");
const qrCodeContainer = document.getElementById("qr-code");
const qrLinkPreview = document.getElementById("qr-link-preview");
const listIdDisplay = document.getElementById("list-id-display");

let items = [];
let currentStatusFilter = "all";
let currentCategoryFilter = "all";
let editingItemId = null;
let categorySortMode = "name";
let deletedItemForUndo = null;
let undoTimerId = null;

const LIST_ID_PARAM = "list";
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const currentListId = resolveListId();
const DEFAULT_CATEGORIES = [
    "Lebensmittel",
    "Getränke",
    "Haushalt",
    "Obst & Gemüse",
    "Sonstiges"
];

const CUSTOM_CATEGORIES_STORAGE_KEY = `shopping-list-custom-categories-${currentListId}`;
let customCategories = loadCustomCategories();

// Start
initializeShareUi();
setupEventHandlers();
startApp();

// --- Hilfsfunktionen für die Liste ---

function resolveListId() {
    const url = new URL(window.location.href);
    const listId = (url.searchParams.get(LIST_ID_PARAM) || "").trim();

    if (isValidUuid(listId)) {
        return listId;
    }

    const newListId = generateListId();
    url.searchParams.set(LIST_ID_PARAM, newListId);
    window.history.replaceState({}, "", url.toString());
    return newListId;
}

function generateListId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
    });
}

function isValidUuid(value) {
    return UUID_V4_REGEX.test(value);
}

// --- Kategorien ---

function loadCustomCategories() {
    try {
        const savedCategories = window.localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
        if (!savedCategories) return [];
        const parsedCategories = JSON.parse(savedCategories);
        if (!Array.isArray(parsedCategories)) return [];
        return parsedCategories.map((category) => String(category).trim()).filter(Boolean);
    } catch (error) {
        return [];
    }
}

function saveCustomCategories() {
    window.localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(customCategories));
}

function getAvailableCategories() {
    const categories = new Set(DEFAULT_CATEGORIES);
    customCategories.forEach((category) => {
        if (category.trim() !== "") categories.add(category.trim());
    });
    items.forEach((item) => {
        if (item.category && item.category.trim() !== "") categories.add(item.category.trim());
    });
    const categoryList = Array.from(categories);

    if (categorySortMode === "usage") {
        return categoryList.sort((a, b) => {
            const usageA = getCategoryUsageCount(a);
            const usageB = getCategoryUsageCount(b);
            if (usageB !== usageA) return usageB - usageA;
            return a.localeCompare(b, "de");
        });
    }
    return categoryList.sort((a, b) => a.localeCompare(b, "de"));
}

function getCategoryUsageCount(category) {
    return items.filter((item) => item.category === category).length;
}

function refreshCategoryOptions() {
    const selectedItemCategory = itemCategoryInput.value;
    const selectedFilterCategory = categoryFilter.value;
    const categories = getAvailableCategories();

    itemCategoryInput.innerHTML = '<option value="">— Bitte wählen —</option>';
    categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        itemCategoryInput.appendChild(option);
    });
    itemCategoryInput.value = categories.includes(selectedItemCategory) ? selectedItemCategory : "";

    categoryFilter.innerHTML = '<option value="all">Alle Kategorien</option>';
    categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
    categoryFilter.value = (selectedFilterCategory === "all" || categories.includes(selectedFilterCategory)) ? selectedFilterCategory : "all";
}

// --- Firebase Live-Synchronisation ---

function startApp() {
    setStatus("Verbindung wird aufgebaut...", "loading");

    // Firebase Firestore Listener (Ersetzt fetchItems und subscribeToRealtime von Supabase)
    const itemsQuery = query(collection(db, "shopping_items"), where("list_id", "==", currentListId));
    
    onSnapshot(itemsQuery, (snapshot) => {
        const newItems = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            newItems.push({
                id: doc.id, // Firestore ID
                list_id: data.list_id,
                name: data.name,
                category: data.category || "",
                completed: data.completed || false,
                created_at: data.created_at
            });
        });

        // Sortieren (neueste zuerst)
        items = newItems.sort((a, b) => {
            const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
            const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
            return timeB - timeA;
        });

        renderItems();
        setStatus("Verbunden und live synchronisiert.", "connected");
    }, (error) => {
        setStatus(`Live-Sync Fehler: ${error.message}`, "error");
    });
}

// --- Event Handlers & Aktionen ---

function setupEventHandlers() {
    // Formular: Artikel hinzufügen
    itemForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const name = itemNameInput.value.trim();
        const category = itemCategoryInput.value;
        if (name === "") return;

        try {
            await addDoc(collection(db, "shopping_items"), {
                list_id: currentListId,
                name: name,
                category: category,
                completed: false,
                created_at: serverTimestamp()
            });
            itemForm.reset();
            itemNameInput.focus();
        } catch (error) {
            setStatus(`Speichern fehlgeschlagen: ${error.message}`, "error");
        }
    });

    // Liste Klicks (Abhaken, Löschen, Bearbeiten)
    shoppingList.addEventListener("click", async (event) => {
        const clickedButton = event.target.closest("button");
        if (!clickedButton) return;

        const action = clickedButton.dataset.action;
        const itemId = clickedButton.dataset.id;
        const item = items.find((currentItem) => currentItem.id === itemId);
        if (!item) return;

        if (action === "toggle") {
            const itemRef = doc(db, "shopping_items", itemId);
            await updateDoc(itemRef, { completed: !item.completed });
        }
        if (action === "edit") openEditModal(item);
        if (action === "delete") deleteItemImmediately(item);
    });

    // Erledigte löschen
    clearCompletedButton.addEventListener("click", async () => {
        const completedItems = items.filter((item) => item.completed);
        if (completedItems.length === 0) return window.alert("Es gibt keine erledigten Artikel.");
        if (!window.confirm("Möchtest du alle erledigten Artikel löschen?")) return;

        completedItems.forEach(async (item) => {
            await deleteDoc(doc(db, "shopping_items", item.id));
        });
    });

    // Filter
    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            filterButtons.forEach((btn) => btn.classList.remove("active"));
            button.classList.add("active");
            currentStatusFilter = button.dataset.filter;
            renderItems();
        });
    });
    categoryFilter.addEventListener("change", () => {
        currentCategoryFilter = categoryFilter.value;
        renderItems();
    });

    // Modal Events
    closeEditModalButton.addEventListener("click", closeEditModal);
    cancelEditButton.addEventListener("click", closeEditModal);
    editForm.addEventListener("submit", saveEditedItem);
    manageCategoriesButton.addEventListener("click", openCategoryModal);
    closeCategoryModalButton.addEventListener("click", closeCategoryModal);
    undoDeleteButton.addEventListener("click", undoLastDelete);
    
    // Teilen Events
    copyLinkButton.addEventListener("click", copyShareLink);
    showQrCodeButton.addEventListener("click", openQrModal);
    closeQrModalButton.addEventListener("click", closeQrModal);
    cancelQrModalButton.addEventListener("click", closeQrModal);
    qrCopyLinkButton.addEventListener("click", copyShareLink);
}

// --- UI Rendering ---

function renderItems() {
    refreshCategoryOptions();
    const visibleItems = items.filter((item) => {
        const matchesStatus = currentStatusFilter === "all" || (currentStatusFilter === "open" && !item.completed) || (currentStatusFilter === "done" && item.completed);
        const matchesCategory = currentCategoryFilter === "all" || item.category === currentCategoryFilter;
        return matchesStatus && matchesCategory;
    });

    shoppingList.innerHTML = "";
    emptyState.style.display = visibleItems.length === 0 ? "block" : "none";

    visibleItems.forEach((item) => {
        const listItem = document.createElement("li");
        listItem.className = `shopping-item ${item.completed ? "completed" : ""}`;

        const checkboxButton = document.createElement("button");
        checkboxButton.className = `checkbox ${item.completed ? "checked" : ""}`;
        checkboxButton.dataset.action = "toggle";
        checkboxButton.dataset.id = item.id;
        
        const content = document.createElement("div");
        content.className = "item-content";
        content.innerHTML = `<p class="item-name">${item.name}</p>`;
        if (item.category) content.innerHTML += `<span class="item-category">${item.category}</span>`;

        const actions = document.createElement("div");
        actions.className = "item-actions";
        actions.innerHTML = `
            <button class="icon-button" data-action="edit" data-id="${item.id}">✏️</button>
            <button class="icon-button delete" data-action="delete" data-id="${item.id}">🗑️</button>
        `;

        listItem.append(checkboxButton, content, actions);
        shoppingList.appendChild(listItem);
    });

    const openItems = items.filter((i) => !i.completed).length;
    itemCount.textContent = items.length === 1 ? "1 Artikel" : `${items.length} Artikel`;
    remainingCount.textContent = openItems === 1 ? "1 offener Artikel" : `${openItems} offene Artikel`;
}

function setStatus(message, mode) {
    connectionStatus.textContent = message;
    connectionStatus.className = `status-badge ${mode}`;
}

// --- Aktionen (Löschen, Bearbeiten, Undo) ---

async function deleteItemImmediately(item) {
    try {
        await deleteDoc(doc(db, "shopping_items", item.id));
        deletedItemForUndo = { ...item };
        showUndoToast(item.name);
    } catch (error) {
        setStatus(`Löschen fehlgeschlagen: ${error.message}`, "error");
    }
}

function showUndoToast(itemName) {
    if (undoTimerId) window.clearTimeout(undoTimerId);
    undoMessage.textContent = `"${itemName}" wurde gelöscht.`;
    undoToast.hidden = false;
    undoTimerId = window.setTimeout(() => {
        deletedItemForUndo = null;
        undoToast.hidden = true;
    }, 8000);
}

async function undoLastDelete() {
    if (!deletedItemForUndo) return;
    try {
        // Stellt das Dokument mit der exakt gleichen ID wieder her
        await setDoc(doc(db, "shopping_items", deletedItemForUndo.id), {
            list_id: deletedItemForUndo.list_id,
            name: deletedItemForUndo.name,
            category: deletedItemForUndo.category,
            completed: deletedItemForUndo.completed,
            created_at: deletedItemForUndo.created_at || serverTimestamp()
        });
        undoToast.hidden = true;
        deletedItemForUndo = null;
    } catch (error) {
        setStatus(`Wiederherstellen fehlgeschlagen: ${error.message}`, "error");
    }
}

function openEditModal(item) {
    editingItemId = item.id;
    editItemNameInput.value = item.name;
    
    // Kategorie Optionen laden
    editItemCategoryInput.innerHTML = '<option value="">— Bitte wählen —</option>';
    getAvailableCategories().forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        editItemCategoryInput.appendChild(option);
    });
    editItemCategoryInput.value = item.category || "";

    editModal.hidden = false;
}

function closeEditModal() {
    editModal.hidden = true;
    editingItemId = null;
}

async function saveEditedItem(event) {
    event.preventDefault();
    if (!editingItemId) return;
    const trimmedName = editItemNameInput.value.trim();
    const selectedCategory = editItemCategoryInput.value.trim();
    if (trimmedName === "") return;

    try {
        await updateDoc(doc(db, "shopping_items", editingItemId), {
            name: trimmedName,
            category: selectedCategory
        });
        closeEditModal();
    } catch (error) {
        setStatus(`Bearbeiten fehlgeschlagen: ${error.message}`, "error");
    }
}

// --- Teilen & QR Code (Unverändert) ---

function initializeShareUi() {
    shareLinkInput.value = window.location.href;
    listIdDisplay.textContent = `Listen-ID: ${currentListId}`;
}

async function copyShareLink() {
    try {
        await navigator.clipboard.writeText(shareLinkInput.value);
        copyLinkButton.textContent = "Kopiert!";
        window.setTimeout(() => {
            copyLinkButton.innerHTML = '<span aria-hidden="true">🔗</span> Link kopieren';
        }, 1500);
    } catch (error) {
        setStatus("Link konnte nicht kopiert werden.", "error");
    }
}

function openQrModal() {
    if (typeof QRCode === "undefined") return;
    qrCodeContainer.innerHTML = "";
    qrLinkPreview.textContent = shareLinkInput.value;
    new QRCode(qrCodeContainer, {
        text: shareLinkInput.value,
        width: 210,
        height: 210,
        colorDark: "#202332",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
    });
    qrModal.hidden = false;
}

function closeQrModal() {
    qrModal.hidden = true;
}

// --- Kategorien Manager (vereinfacht) ---
function openCategoryModal() { categoryModal.hidden = false; }
function closeCategoryModal() { categoryModal.hidden = true; }
