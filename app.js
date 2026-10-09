const itemForm = document.getElementById("item-form");
const itemNameInput = document.getElementById("item-name");
const itemCategoryInput = document.getElementById("item-category");
const shoppingList = document.getElementById("shopping-list");
const emptyState = document.getElementById("empty-state");
const itemCount = document.getElementById("item-count");
const remainingCount = document.getElementById("remaining-count");
const clearCompletedButton = document.getElementById("clear-completed");
const categoryFilter = document.getElementById("category-filter");
const filterButtons = document.querySelectorAll(".filter-button");

let items = JSON.parse(localStorage.getItem("shopping-items")) || [];

let currentStatusFilter = "all";
let currentCategoryFilter = "all";

function saveItems() {
    localStorage.setItem("shopping-items", JSON.stringify(items));
}

function createItem(name, category) {
    return {
        id: Date.now(),
        name: name,
        category: category,
        completed: false
    };
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

        listItem.innerHTML = `
            <button
                class="checkbox ${item.completed ? "checked" : ""}"
                data-action="toggle"
                data-id="${item.id}"
                aria-label="Artikel erledigen"
            ></button>

            <div class="item-content">
                <p class="item-name">${escapeHtml(item.name)}</p>
                <span class="item-category">
                    ${escapeHtml(item.category)}
                </span>
            </div>

            <div class="item-actions">
                <button
                    class="icon-button"
                    data-action="edit"
                    data-id="${item.id}"
                    title="Artikel bearbeiten"
                    aria-label="Artikel bearbeiten"
                >
                    ✏️
                </button>

                <button
                    class="icon-button delete"
                    data-action="delete"
                    data-id="${item.id}"
                    title="Artikel löschen"
                    aria-label="Artikel löschen"
                >
                    🗑️
                </button>
            </div>
        `;

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
        openItems === 1
            ? "1 offener Artikel"
            : `${openItems} offene Artikel`;
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
}

itemForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = itemNameInput.value.trim();
    const category = itemCategoryInput.value;

    if (name === "") {
        return;
    }

    const newItem = createItem(name, category);

    items.unshift(newItem);

    saveItems();
    renderItems();

    itemForm.reset();
    itemNameInput.focus();
});

shoppingList.addEventListener("click", (event) => {
    const clickedButton = event.target.closest("button");

    if (!clickedButton) {
        return;
    }

    const action = clickedButton.dataset.action;
    const itemId = Number(clickedButton.dataset.id);

    const item = items.find((currentItem) => currentItem.id === itemId);

    if (!item) {
        return;
    }

    if (action === "toggle") {
        item.completed = !item.completed;
    }

    if (action === "edit") {
        const newName = prompt("Artikel bearbeiten:", item.name);

        if (newName !== null && newName.trim() !== "") {
            item.name = newName.trim();
        }
    }

    if (action === "delete") {
        const confirmed = confirm(
            `Möchtest du "${item.name}" wirklich löschen?`
        );

        if (confirmed) {
            items = items.filter(
                (currentItem) => currentItem.id !== itemId
            );
        }
    }

    saveItems();
    renderItems();
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

clearCompletedButton.addEventListener("click", () => {
    const completedItems = items.filter((item) => item.completed);

    if (completedItems.length === 0) {
        alert("Es gibt keine erledigten Artikel.");
        return;
    }

    const confirmed = confirm(
        "Möchtest du alle erledigten Artikel löschen?"
    );

    if (confirmed) {
        items = items.filter((item) => !item.completed);

        saveItems();
        renderItems();
    }
});

renderItems();