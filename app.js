const CONFIG = {
    SUPABASE_URL: "https://wzbzxibuwvxivisoubsw.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_EqBA_Ze1P8dNg5VQ309OSQ_cblNukt6"
};

const itemForm = document.getElementById("item-form");
const itemNameInput = document.getElementById("item-name");
const itemCategoryInput = document.getElementById("item-category");
const shoppingList = document.getElementById("shopping-list");
const emptyState = document.getElementById("empty-state");
const itemCount = document.getElementById("item-count");
const remainingCount = document.getElementById("remaining-count");
const clearCompletedButton = document.getElementById("clear-completed");
const categoryFilter = document.getElementById("category-filter");
const customCategoryInput = document.getElementById("custom-category");
const addCategoryButton = document.getElementById("add-category");
const filterButtons = document.querySelectorAll(".filter-button");
const connectionStatus = document.getElementById("connection-status");
const shareLinkInput = document.getElementById("share-link");
const copyLinkButton = document.getElementById("copy-link");
const listIdDisplay = document.getElementById("list-id-display");

let supabaseClient = null;
let realtimeChannel = null;
let items = [];
let currentStatusFilter = "all";
let currentCategoryFilter = "all";

const LIST_ID_PARAM = "list";
const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const currentListId = resolveListId();
const POLLING_INTERVAL_MS = 30_000;
const DEFAULT_CATEGORIES = [
    "Lebensmittel",
    "Getränke",
    "Haushalt",
    "Obst & Gemüse",
    "Sonstiges"
];

const CUSTOM_CATEGORIES_STORAGE_KEY =
    `shopping-list-custom-categories-${currentListId}`;

let customCategories = loadCustomCategories();

let isRefreshing = false;
let pollingTimerId = null;

function canSynchronizeInBackground() {
    return (
        supabaseClient &&
        navigator.onLine &&
        document.visibilityState === "visible"
    );
}

async function refreshShoppingList() {
    if (!canSynchronizeInBackground() || isRefreshing) {
        return;
    }

    isRefreshing = true;

    try {
        await fetchItems();
    } catch (error) {
        console.error("Automatische Synchronisierung fehlgeschlagen:", error);
    } finally {
        isRefreshing = false;
    }
}

function startPollingFallback() {
    if (pollingTimerId !== null) {
        window.clearInterval(pollingTimerId);
    }

    pollingTimerId = window.setInterval(() => {
        void refreshShoppingList();
    }, POLLING_INTERVAL_MS);
}

startPollingFallback();

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        void refreshShoppingList();
    }
});

window.addEventListener("online", () => {
    void refreshShoppingList();
});

initializeShareUi();
setupEventHandlers();
initializeApp();

function loadCustomCategories() {
    try {
        const savedCategories = window.localStorage.getItem(
            CUSTOM_CATEGORIES_STORAGE_KEY
        );

        if (!savedCategories) {
            return [];
        }

        const parsedCategories = JSON.parse(savedCategories);

        if (!Array.isArray(parsedCategories)) {
            return [];
        }

        return parsedCategories
            .map((category) => String(category).trim())
            .filter(Boolean);
    } catch (error) {
        console.warn("Eigene Kategorien konnten nicht geladen werden:", error);
        return [];
    }
}

function saveCustomCategories() {
    window.localStorage.setItem(
        CUSTOM_CATEGORIES_STORAGE_KEY,
        JSON.stringify(customCategories)
    );
}

function getAvailableCategories() {
    const categories = new Set(DEFAULT_CATEGORIES);

    customCategories.forEach((category) => {
        if (category.trim() !== "") {
            categories.add(category.trim());
        }
    });

    items.forEach((item) => {
        if (item.category && item.category.trim() !== "") {
            categories.add(item.category.trim());
        }
    });

    return Array.from(categories);
}

function refreshCategoryOptions() {
    const selectedItemCategory = itemCategoryInput.value;
    const selectedFilterCategory = categoryFilter.value;

    const categories = getAvailableCategories();

    itemCategoryInput.innerHTML = "";

    const emptyCategoryOption = document.createElement("option");
    emptyCategoryOption.value = "";
    emptyCategoryOption.textContent = "— Bitte wählen —";
    itemCategoryInput.appendChild(emptyCategoryOption);

    categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        itemCategoryInput.appendChild(option);
    });

    if (categories.includes(selectedItemCategory)) {
        itemCategoryInput.value = selectedItemCategory;
    } else {
        itemCategoryInput.value = "";
    }

    categoryFilter.innerHTML = "";

    const allCategoriesOption = document.createElement("option");
    allCategoriesOption.value = "all";
    allCategoriesOption.textContent = "Alle Kategorien";
    categoryFilter.appendChild(allCategoriesOption);

    categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });

    if (
        selectedFilterCategory === "all" ||
        categories.includes(selectedFilterCategory)
    ) {
        categoryFilter.value = selectedFilterCategory;
    } else {
        categoryFilter.value = "all";
        currentCategoryFilter = "all";
    }
}

function addCustomCategory() {
    const newCategory = customCategoryInput.value.trim();

    if (newCategory === "") {
        return;
    }

    const alreadyExists = getAvailableCategories().some(
        (category) => category.toLowerCase() === newCategory.toLowerCase()
    );

    if (!alreadyExists) {
        customCategories.push(newCategory);
        saveCustomCategories();
    }

    refreshCategoryOptions();
    itemCategoryInput.value = newCategory;
    customCategoryInput.value = "";
    itemCategoryInput.focus();
}
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

function initializeShareUi() {
    shareLinkInput.value = window.location.href;
    listIdDisplay.textContent = `Listen-ID: ${currentListId}`;
}

function setupEventHandlers() {
    addCategoryButton.addEventListener("click", addCustomCategory);

    customCategoryInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            addCustomCategory();
        }
    });

    copyLinkButton.addEventListener("click", async () => {
    copyLinkButton.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(shareLinkInput.value);
            copyLinkButton.textContent = "Kopiert!";
            window.setTimeout(() => {
                copyLinkButton.textContent = "Link kopieren";
            }, 1500);
        } catch (error) {
            setStatus("Link konnte nicht kopiert werden.", "error");
        }
    });

    itemForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!supabaseClient) {
            return;
        }

        const name = itemNameInput.value.trim();
        const category = itemCategoryInput.value;

        if (name === "") {
            return;
        }

        const { data, error } = await supabaseClient
            .from("shopping_items")
            .insert({
                list_id: currentListId,
                name: name,
                category: category,
                completed: false
            })
            .select()
            .single();

        if (error) {
            setStatus(`Speichern fehlgeschlagen: ${error.message}`, "error");
            return;
        }

        upsertItem(data);
        renderItems();

        itemForm.reset();
        itemNameInput.focus();
    });

    shoppingList.addEventListener("click", async (event) => {
        if (!supabaseClient) {
            return;
        }

        const clickedButton = event.target.closest("button");

        if (!clickedButton) {
            return;
        }

        const action = clickedButton.dataset.action;
        const itemId = clickedButton.dataset.id;
        const item = items.find((currentItem) => currentItem.id === itemId);

        if (!item) {
            return;
        }

        if (action === "toggle") {
            const { data, error } = await supabaseClient
                .from("shopping_items")
                .update({ completed: !item.completed })
                .eq("id", itemId)
                .eq("list_id", currentListId)
                .select()
                .single();

            if (error) {
                setStatus(`Aktualisieren fehlgeschlagen: ${error.message}`, "error");
                return;
            }

            upsertItem(data);
            renderItems();
        }

        if (action === "edit") {
            const newName = window.prompt("Artikel bearbeiten:", item.name);

            if (newName === null) {
                return;
            }

            const trimmedName = newName.trim();

            if (trimmedName === "") {
                return;
            }

            const { data, error } = await supabaseClient
                .from("shopping_items")
                .update({ name: trimmedName })
                .eq("id", itemId)
                .eq("list_id", currentListId)
                .select()
                .single();

            if (error) {
                setStatus(`Bearbeiten fehlgeschlagen: ${error.message}`, "error");
                return;
            }

            upsertItem(data);
            renderItems();
        }

        if (action === "delete") {
            const confirmed = window.confirm(
                `Möchtest du "${item.name}" wirklich löschen?`
            );

            if (!confirmed) {
                return;
            }

            const { error } = await supabaseClient
                .from("shopping_items")
                .delete()
                .eq("id", itemId)
                .eq("list_id", currentListId);

            if (error) {
                setStatus(`Löschen fehlgeschlagen: ${error.message}`, "error");
                return;
            }

            removeItem(itemId);
            renderItems();
        }
    });

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            filterButtons.forEach((filterButton) => {
                filterButton.classList.remove("active");
            });

            button.classList.add("active");
            currentStatusFilter = button.dataset.filter;
            renderItems();
        });
    });

    categoryFilter.addEventListener("change", () => {
        currentCategoryFilter = categoryFilter.value;
        renderItems();
    });

    clearCompletedButton.addEventListener("click", async () => {
        if (!supabaseClient) {
            return;
        }

        const completedItems = items.filter((item) => item.completed);

        if (completedItems.length === 0) {
            window.alert("Es gibt keine erledigten Artikel.");
            return;
        }

        const confirmed = window.confirm(
            "Möchtest du alle erledigten Artikel löschen?"
        );

        if (!confirmed) {
            return;
        }

        const { error } = await supabaseClient
            .from("shopping_items")
            .delete()
            .eq("list_id", currentListId)
            .eq("completed", true);

        if (error) {
            setStatus(`Löschen fehlgeschlagen: ${error.message}`, "error");
            return;
        }

        items = items.filter((item) => !item.completed);
        renderItems();
    });

    window.addEventListener("offline", () => {
        setStatus("Offline: Verbindung unterbrochen.", "error");
    });

    window.addEventListener("online", async () => {
        setStatus("Verbindung wird wiederhergestellt...", "loading");

        if (supabaseClient) {
            await fetchItems();
        }
    });
}

async function initializeApp() {
    renderItems();
    setStatus("Verbindung wird aufgebaut...", "loading");

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        setStatus(
            "Supabase-Bibliothek nicht geladen. Bitte Seite neu laden.",
            "error"
        );
        return;
    }

    if (!isConfigValid()) {
        setStatus(
            "Bitte SUPABASE_URL und SUPABASE_ANON_KEY oben in app.js eintragen.",
            "error"
        );
        emptyState.querySelector("p").textContent =
            "Konfiguration fehlt: Öffne app.js und trage deine Supabase-Daten ein.";
        return;
    }

    supabaseClient = window.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_ANON_KEY,
        {
            global: {
                headers: {
                    "x-list-id": currentListId
                }
            }
        }
    );

    subscribeToRealtime();
    await fetchItems();
}

function isConfigValid() {
    const hasValues =
        CONFIG.SUPABASE_URL &&
        CONFIG.SUPABASE_ANON_KEY &&
        CONFIG.SUPABASE_URL.trim() !== "" &&
        CONFIG.SUPABASE_ANON_KEY.trim() !== "";

    if (!hasValues) {
        return false;
    }

    const containsPlaceholder =
        CONFIG.SUPABASE_URL.includes("DEINE_SUPABASE_URL") ||
        CONFIG.SUPABASE_ANON_KEY.includes("DEIN_SUPABASE_ANON_KEY");

    return !containsPlaceholder;
}

function subscribeToRealtime() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient
        .channel(`shopping_items:${currentListId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "shopping_items",
                filter: `list_id=eq.${currentListId}`
            },
            (payload) => {
                upsertItem(payload.new);
                renderItems();
            }
        )
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "shopping_items",
                filter: `list_id=eq.${currentListId}`
            },
            (payload) => {
                upsertItem(payload.new);
                renderItems();
            }
        )
        .on(
            "postgres_changes",
            {
                event: "DELETE",
                schema: "public",
                table: "shopping_items",
                filter: `list_id=eq.${currentListId}`
            },
            (payload) => {
                removeItem(payload.old.id);
                renderItems();
            }
        )
        .subscribe((status) => {
            if (status === "SUBSCRIBED") {
                setStatus("Verbunden und live synchronisiert.", "connected");
                return;
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                setStatus("Live-Synchronisierung gestört. Bitte neu laden.", "error");
                return;
            }

            if (status === "CLOSED") {
                setStatus("Verbindung geschlossen.", "error");
            }
        });
}

async function fetchItems() {
    if (!supabaseClient) {
        return;
    }

    const { data, error } = await supabaseClient
        .from("shopping_items")
        .select("id, list_id, name, category, completed, created_at, updated_at")
        .eq("list_id", currentListId)
        .order("created_at", { ascending: false });

    if (error) {
        setStatus(`Laden fehlgeschlagen: ${error.message}`, "error");
        return;
    }

    items = Array.isArray(data) ? data.map(normalizeItem) : [];
    renderItems();
    setStatus("Liste geladen.", "connected");
}

function normalizeItem(rawItem) {
    return {
        id: rawItem.id,
        list_id: rawItem.list_id,
        name: String(rawItem.name ?? ""),
        category: String(rawItem.category ?? "Sonstiges"),
        completed: Boolean(rawItem.completed),
        created_at: rawItem.created_at,
        updated_at: rawItem.updated_at
    };
}

function upsertItem(rawItem) {
    const item = normalizeItem(rawItem);
    const existingIndex = items.findIndex((entry) => entry.id === item.id);

    if (existingIndex >= 0) {
        items[existingIndex] = item;
        return;
    }

    items.unshift(item);
}

function removeItem(itemId) {
    items = items.filter((item) => item.id !== itemId);
}

function getVisibleItems() {
    return items.filter((item) => {
        const matchesStatus =
            currentStatusFilter === "all" ||
            (currentStatusFilter === "open" && !item.completed) ||
            (currentStatusFilter === "done" && item.completed);

        const matchesCategory =
            currentCategoryFilter === "all" ||
            item.category === currentCategoryFilter;

        return matchesStatus && matchesCategory;
    });
}

function renderItems() {
    const visibleItems = getVisibleItems();
    shoppingList.innerHTML = "";

    if (visibleItems.length === 0) {
        emptyState.style.display = "block";
    } else {
        emptyState.style.display = "none";
    }

    visibleItems.forEach((item) => {
        const listItem = document.createElement("li");
        listItem.className = "shopping-item";

        if (item.completed) {
            listItem.classList.add("completed");
        }

        const checkboxButton = document.createElement("button");
        checkboxButton.className = "checkbox";
        if (item.completed) {
            checkboxButton.classList.add("checked");
        }
        checkboxButton.dataset.action = "toggle";
        checkboxButton.dataset.id = item.id;
        checkboxButton.setAttribute("aria-label", "Artikel erledigen");

        const content = document.createElement("div");
        content.className = "item-content";

        const name = document.createElement("p");
        name.className = "item-name";
        name.textContent = item.name;

        const category = document.createElement("span");
        category.className = "item-category";
        category.textContent = item.category;

        content.appendChild(name);
        content.appendChild(category);

        const actions = document.createElement("div");
        actions.className = "item-actions";

        const editButton = document.createElement("button");
        editButton.className = "icon-button";
        editButton.dataset.action = "edit";
        editButton.dataset.id = item.id;
        editButton.setAttribute("title", "Artikel bearbeiten");
        editButton.setAttribute("aria-label", "Artikel bearbeiten");
        editButton.textContent = "✏️";

        const deleteButton = document.createElement("button");
        deleteButton.className = "icon-button delete";
        deleteButton.dataset.action = "delete";
        deleteButton.dataset.id = item.id;
        deleteButton.setAttribute("title", "Artikel löschen");
        deleteButton.setAttribute("aria-label", "Artikel löschen");
        deleteButton.textContent = "🗑️";

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);

        listItem.appendChild(checkboxButton);
        listItem.appendChild(content);
        listItem.appendChild(actions);

        shoppingList.appendChild(listItem);
    });

    updateCounters();
}

function updateCounters() {
    const openItems = items.filter((item) => !item.completed).length;
    const totalItems = items.length;

    itemCount.textContent =
        totalItems === 1 ? "1 Artikel" : `${totalItems} Artikel`;

    remainingCount.textContent =
        openItems === 1 ? "1 offener Artikel" : `${openItems} offene Artikel`;
}

function setStatus(message, mode) {
    connectionStatus.textContent = message;
    connectionStatus.classList.remove("loading", "connected", "error");
    connectionStatus.classList.add(mode);
}
