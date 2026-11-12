import {
  addPerson,
  addRelationship,
  deletePerson,
  getPersonConnections,
  loadTree,
  moveTimelinePerson,
  saveTree,
  updatePerson
} from "./tree-model.js?v=6";
import {
  getBirthMonth,
  inferBirthYears,
  MAX_PIXELS_PER_YEAR,
  movePersonNode,
  renderTree,
  updateTimeline,
  YEAR_WIDTH
} from "./tree-view.js?v=10";

const svg = document.querySelector("#family-tree");
const viewport = document.querySelector("#tree-viewport");
const status = document.querySelector("#tree-status");
const personDialog = document.querySelector("#person-dialog");
const addPersonDialog = document.querySelector("#add-person-dialog");
const connectionDialog = document.querySelector("#connection-dialog");
const personForm = document.querySelector("#person-form");
const connectionForm = document.querySelector("#connection-form");
const searchForm = document.querySelector("#person-search-form");
const searchInput = document.querySelector("#person-search");
const searchOptions = document.querySelector("#family-members");
const photoInput = document.querySelector("#person-photo");
const photoPreview = document.querySelector("#photo-preview");
const photoPreviewImage = document.querySelector("#photo-preview-image");
const photoPreviewPlaceholder = document.querySelector("#photo-preview-placeholder");
const loadResult = loadTree();

let tree = loadResult.tree;
let layoutSize = { x: 0, y: 0, width: 720, height: 380, positions: new Map(), mode: "standard" };
let viewBox = { x: 0, y: 0, width: 720, height: 380 };
let selectedPersonId = null;
let hasNavigated = false;
let previousViewportWidth = 0;
let pointerStart = null;
let pinchStart = null;
const activePointers = new Map();
let editingPersonId = null;
let connectNewPersonToId = null;
let viewMode = "standard";
let photoProcessing = Promise.resolve();
let photoSelection = 0;
let suppressPersonClick = null;

function showStatus(message) {
  status.textContent = message;
}

function saveChanges(nextTree) {
  tree = nextTree;
  render();
  try {
    saveTree(tree);
    showStatus("Your tree is saved in this browser.");
  } catch (error) {
    console.error("Could not save the family tree:", error);
    showStatus("Changes are visible, but could not be saved in this browser.");
  }
}

function setViewBox(nextViewBox) {
  viewBox = nextViewBox;
  const bounds = viewport.getBoundingClientRect();
  svg.setAttribute(
    "viewBox",
    `0 0 ${bounds.width} ${bounds.height}`
  );
  updateTimeline(svg, layoutSize, viewBox, bounds.width, bounds.height);
}

function getFitWidth(viewportWidth) {
  const horizontalPadding = 48;
  const yearRange = (layoutSize.maxYear - layoutSize.minYear + 1) * YEAR_WIDTH;
  const availableWidth = viewportWidth - layoutSize.nodeWidth - horizontalPadding;
  return availableWidth > 0
    ? Math.max(viewportWidth, yearRange * viewportWidth / availableWidth)
    : Math.max(viewportWidth, layoutSize.width);
}

function fitTree() {
  const bounds = viewport.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return;
  if (!tree.people.length) return;
  previousViewportWidth = bounds.width;
  const width = getFitWidth(bounds.width);
  layoutSize.fitWidth = width;
  const scale = bounds.width / width;
  setViewBox({
    x: layoutSize.startX - 32 / scale,
    y: 0,
    width,
    height: bounds.height
  });
  hasNavigated = false;
}

function render() {
  layoutSize = renderTree(svg, tree, viewMode);
  searchOptions.replaceChildren();
  const birthYears = inferBirthYears(tree);
  for (const person of tree.people) {
    const option = document.createElement("option");
    const birth = birthYears.get(person.id);
    const month = getBirthMonth(person);
    option.value = person.name;
    option.label = `${person.name} (${birth.estimated ? "~" : ""}${birth.year}, ${month ? new Date(2000, month - 1).toLocaleString("en", { month: "long" }) : "unknown month"})`;
    searchOptions.append(option);
  }
  fitTree();
}

function zoom(factor, clientX = null) {
  flushScheduledViewBox();
  const bounds = viewport.getBoundingClientRect();
  const minimumWidth = bounds.width * YEAR_WIDTH / MAX_PIXELS_PER_YEAR;
  const maximumWidth = layoutSize.fitWidth ?? Math.max(layoutSize.width, bounds.width);
  const nextWidth = Math.min(maximumWidth, Math.max(minimumWidth, viewBox.width * factor));
  const anchorScreenX = (clientX ?? (bounds.left + bounds.width / 2)) - bounds.left;
  const anchorX = viewBox.x + anchorScreenX * viewBox.width / bounds.width;
  setViewBox({
    x: anchorX - anchorScreenX * nextWidth / bounds.width,
    y: viewBox.y,
    width: nextWidth,
    height: bounds.height
  });
  hasNavigated = true;
}

let viewBoxFrame = 0;
let pendingViewBox = null;
function scheduleViewBox(nextViewBox) {
  pendingViewBox = nextViewBox;
  if (viewBoxFrame) return;
  viewBoxFrame = requestAnimationFrame(() => {
    viewBoxFrame = 0;
    setViewBox(pendingViewBox);
    pendingViewBox = null;
  });
}

function flushScheduledViewBox() {
  if (!viewBoxFrame) return;
  cancelAnimationFrame(viewBoxFrame);
  viewBoxFrame = 0;
  const nextViewBox = pendingViewBox;
  pendingViewBox = null;
  if (nextViewBox) setViewBox(nextViewBox);
}

function populatePersonOptions(select, selectedId) {
  select.replaceChildren();
  for (const person of tree.people) {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.name;
    select.append(option);
  }
  if (selectedId && tree.people.some((person) => person.id === selectedId)) {
    select.value = selectedId;
  }
}

function openPerson(personId) {
  const person = tree.people.find((item) => item.id === personId);
  if (!person) return;

  selectedPersonId = personId;
  document.querySelector("#person-name").textContent = person.name;
  document.querySelector("#person-born").textContent = person.born;
  document.querySelector("#person-place").textContent = person.place;
  document.querySelector("#person-story").textContent = person.story;
  const connections = document.querySelector("#person-connections");
  connections.replaceChildren();
  const connectionGroups = getPersonConnections(tree, personId);
  for (const [heading, relatives] of Object.entries(connectionGroups)) {
    if (relatives.length === 0) continue;

    const group = document.createElement("section");
    group.className = "connection-group";
    const title = document.createElement("h3");
    title.textContent = heading;
    group.append(title);
    const list = document.createElement("ul");
    list.className = "connection-list";
    for (const connection of relatives) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.className = "connection-link";
      button.type = "button";
      button.dataset.openPerson = connection.person.id;
      button.append(document.createTextNode(connection.person.name));
      if (connection.uncertain) {
        const note = document.createElement("span");
        note.textContent = "Possible";
        button.append(note);
      }
      item.append(button);
      list.append(item);
    }
    group.append(list);
    connections.append(group);
  }
  if (connections.childElementCount === 0) {
    const empty = document.createElement("p");
    empty.className = "no-connections";
    empty.textContent = "No connections yet";
    connections.append(empty);
  }
  personDialog.showModal();
}

function focusPerson(personId) {
  const position = layoutSize.positions.get(personId);
  if (!position) return;
  const centerX = position.x + layoutSize.nodeWidth / (2 * layoutSize.scale);
  const centerY = position.y + layoutSize.nodeHeight / 2;
  const bounds = viewport.getBoundingClientRect();
  setViewBox({
    x: centerX - viewBox.width / 2,
    y: centerY - viewBox.height / 2,
    width: viewBox.width,
    height: bounds.height
  });
  hasNavigated = true;
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = searchInput.value.trim().toLocaleLowerCase();
  if (!query) return;

  const matches = tree.people.filter((person) =>
    person.name.toLocaleLowerCase().includes(query)
  );
  const person = matches.find((item) => item.name.toLocaleLowerCase() === query) ??
    matches.find((item) => item.name.toLocaleLowerCase().startsWith(query));
  if (!person) {
    showStatus(`No family member found for “${searchInput.value.trim()}”.`);
    return;
  }

  focusPerson(person.id);
  showStatus(`Found ${person.name}.`);
  openPerson(person.id);
});

function openConnectionDialog(personId, relativeId) {
  if (tree.people.length < 2) {
    showStatus("Add another person before creating a connection.");
    return;
  }

  populatePersonOptions(connectionForm.elements.person, personId);
  populatePersonOptions(connectionForm.elements.relative);
  connectionForm.elements.relative.value = relativeId &&
    relativeId !== personId &&
    tree.people.some((person) => person.id === relativeId)
    ? relativeId
    : tree.people.find((person) => person.id !== personId)?.id ?? "";
  document.querySelector("#connection-error").textContent = "";
  connectionDialog.showModal();
}

function openAddPerson(connectToId = null) {
  photoSelection += 1;
  editingPersonId = null;
  connectNewPersonToId = connectToId;
  personForm.reset();
  personForm.dataset.photo = "";
  updatePhotoPreview("");
  document.querySelector("#add-person-title").textContent = "Add a person";
  document.querySelector("#person-submit").textContent = "Add to the tree";
  document.querySelector("#person-error").textContent = "";
  addPersonDialog.showModal();
}

function openEditPerson(personId) {
  const person = tree.people.find((item) => item.id === personId);
  if (!person) return;

  photoSelection += 1;
  editingPersonId = personId;
  connectNewPersonToId = null;
  personForm.elements.name.value = person.name;
  personForm.elements.born.value = person.born;
  personForm.elements.place.value = person.place;
  personForm.elements.story.value = person.story;
  personForm.elements.birthMonth.value = String(getBirthMonth(person) ?? "");
  personForm.dataset.photo = person.photo ?? "";
  photoInput.value = "";
  updatePhotoPreview(personForm.dataset.photo);
  document.querySelector("#add-person-title").textContent = "Edit details";
  document.querySelector("#person-submit").textContent = "Save changes";
  document.querySelector("#person-error").textContent = "";
  personDialog.close();
  addPersonDialog.showModal();
}

document.querySelector("#add-person").addEventListener("click", () => openAddPerson());

document.querySelector("#person-edit").addEventListener("click", () => {
  openEditPerson(selectedPersonId);
});

document.querySelector("#person-add-connection").addEventListener("click", () => {
  personDialog.close();
  openConnectionDialog(selectedPersonId);
});

function updatePhotoPreview(photo) {
  photoPreview.hidden = !photo;
  photoPreviewImage.hidden = !photo;
  photoPreviewPlaceholder.hidden = Boolean(photo);
  if (photo) photoPreviewImage.src = photo;
  else photoPreviewImage.removeAttribute("src");
}

async function encodePhoto(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file for the profile photo.");
  }
  if (file.size > 8_000_000) {
    throw new Error("Choose a photo smaller than 8 MB.");
  }

  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const scale = Math.max(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const context = canvas.getContext("2d");
  if (!context) {
    image.close();
    throw new Error("This browser could not process the photo.");
  }
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  const selection = ++photoSelection;
  photoProcessing = encodePhoto(file).then((photo) => {
    if (selection !== photoSelection) return;
    personForm.dataset.photo = photo;
    updatePhotoPreview(photo);
    document.querySelector("#person-error").textContent = "";
  }).catch((error) => {
    if (selection !== photoSelection) return;
    photoInput.value = "";
    document.querySelector("#person-error").textContent = error.message;
  });
});

document.querySelector("#remove-photo").addEventListener("click", () => {
  photoSelection += 1;
  photoInput.value = "";
  personForm.dataset.photo = "";
  updatePhotoPreview("");
});

personForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await photoProcessing;
  const values = new FormData(personForm);
  const details = {
    name: values.get("name"),
    born: values.get("born"),
    birthMonth: values.get("birthMonth"),
    place: values.get("place"),
    story: values.get("story"),
    photo: personForm.dataset.photo ?? ""
  };
  try {
    const nextTree = editingPersonId
      ? updatePerson(tree, editingPersonId, details)
      : addPerson(tree, details);
    const addedPersonId = editingPersonId ? null : nextTree.people.at(-1).id;
    const shouldConnect = connectNewPersonToId;
    saveChanges(nextTree);
    addPersonDialog.close();
    editingPersonId = null;
    connectNewPersonToId = null;
    if (addedPersonId && shouldConnect) {
      openConnectionDialog(addedPersonId, shouldConnect);
    } else if (addedPersonId) {
      showStatus("Person added. Select them to add details or connections.");
    } else {
      openPerson(selectedPersonId);
    }
  } catch (error) {
    document.querySelector("#person-error").textContent = error.message;
  }
});

connectionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const firstId = connectionForm.elements.person.value;
  const secondId = connectionForm.elements.relative.value;
  const type = connectionForm.elements.relationship.value;
  try {
    saveChanges(addRelationship(tree, firstId, secondId, type));
    connectionDialog.close();
  } catch (error) {
    document.querySelector("#connection-error").textContent = error.message;
  }
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelector("#person-connections").addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-person]");
  if (!button) return;
  openPerson(button.dataset.openPerson);
});

document.querySelector("#zoom-in").addEventListener("click", () => zoom(0.8));
document.querySelector("#zoom-out").addEventListener("click", () => zoom(1.25));
document.querySelector("#zoom-level").addEventListener("click", fitTree);
document.querySelector("#view-mode").addEventListener("change", (event) => {
  viewMode = event.currentTarget.value;
  render();
});

svg.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (action) {
    if (action.dataset.action === "create") {
      openAddPerson();
      return;
    }

    const personNode = action.closest(".person-node");
    if (!personNode) return;
    if (action.dataset.action === "add") {
      openAddPerson(personNode.dataset.personId);
    } else if (action.dataset.action === "delete") {
      const person = tree.people.find((item) => item.id === personNode.dataset.personId);
      if (person && window.confirm(`Delete ${person.name} and their connections?`)) {
        saveChanges(deletePerson(tree, person.id));
        showStatus(tree.people.length === 0
          ? "Your tree is empty. Select the dashed card to add someone."
          : `${person.name} and their connections were deleted.`);
      }
    }
    return;
  }

  const node = event.target.closest(".person-node");
  if (node) {
    if (suppressPersonClick === node.dataset.personId) {
      suppressPersonClick = null;
      return;
    }
    openPerson(node.dataset.personId);
  }
});

svg.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target.closest("[data-action], .person-node");
  if (!target) return;
  event.preventDefault();
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});

viewport.addEventListener("pointerdown", (event) => {
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (event.pointerType === "touch" && activePointers.size >= 2) {
    const [first, second] = Array.from(activePointers.values()).slice(-2);
    const midpoint = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2
    };
    const bounds = viewport.getBoundingClientRect();
    pinchStart = {
      distance: Math.hypot(second.x - first.x, second.y - first.y),
      midpoint,
      viewBox: { ...viewBox },
      anchor: {
        x: viewBox.x + (midpoint.x - bounds.left) * viewBox.width / bounds.width,
        y: viewBox.y + (midpoint.y - bounds.top) * viewBox.height / bounds.height
      }
    };
    pointerStart = null;
    viewport.classList.remove("is-dragging", "is-dragging-person");
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }

  const personNode = event.target.closest(".person-node");
  if (personNode) {
    if (event.target.closest("[data-action]")) return;
    const position = layoutSize.positions.get(personNode.dataset.personId);
    if (!position) return;
    pointerStart = {
      pointerId: event.pointerId,
      type: "person",
      personId: personNode.dataset.personId,
      moved: false,
      x: event.clientX,
      y: event.clientY,
      position: { ...position },
      captureTarget: personNode
    };
    personNode.setPointerCapture(event.pointerId);
    viewport.classList.add("is-dragging-person");
    event.preventDefault();
    return;
  }
  pointerStart = {
    pointerId: event.pointerId,
    type: "pan",
    captureTarget: viewport,
    x: event.clientX,
    y: event.clientY,
    viewX: viewBox.x,
    viewY: viewBox.y
  };
  viewport.setPointerCapture(event.pointerId);
  viewport.classList.add("is-dragging");
});

viewport.addEventListener("pointermove", (event) => {
  if (activePointers.has(event.pointerId)) {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }
  if (pinchStart && activePointers.size >= 2) {
    const [first, second] = Array.from(activePointers.values()).slice(-2);
    const midpoint = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2
    };
    const bounds = viewport.getBoundingClientRect();
    const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
    const minimumWidth = bounds.width * YEAR_WIDTH / MAX_PIXELS_PER_YEAR;
    const maximumWidth = layoutSize.fitWidth ?? Math.max(layoutSize.width, bounds.width);
    const width = Math.min(
      maximumWidth,
      Math.max(minimumWidth, pinchStart.viewBox.width * pinchStart.distance / distance)
    );
    scheduleViewBox({
      x: pinchStart.anchor.x - (midpoint.x - bounds.left) * width / bounds.width,
      y: pinchStart.anchor.y - (midpoint.y - bounds.top),
      width,
      height: bounds.height
    });
    hasNavigated = true;
    return;
  }
  if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
  const bounds = viewport.getBoundingClientRect();
  if (pointerStart.type === "person") {
    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 4) {
      pointerStart.moved = true;
    }
    const position = {
      x: pointerStart.position.x,
      y: pointerStart.position.y + (event.clientY - pointerStart.y)
    };
    movePersonNode(svg, tree, layoutSize, pointerStart.personId, position);
    hasNavigated = true;
    return;
  }

  scheduleViewBox({
    ...viewBox,
    x: pointerStart.viewX - (event.clientX - pointerStart.x) * (viewBox.width / bounds.width),
    y: pointerStart.viewY - (event.clientY - pointerStart.y) * (viewBox.height / bounds.height)
  });
  hasNavigated = true;
});

function stopPanning(event) {
  flushScheduledViewBox();
  activePointers.delete(event.pointerId);
  if (pinchStart) {
    pinchStart = null;
    if (activePointers.size === 1) {
      const [pointerId, point] = activePointers.entries().next().value;
      pointerStart = {
        pointerId,
        type: "pan",
        captureTarget: viewport,
        x: point.x,
        y: point.y,
        viewX: viewBox.x,
        viewY: viewBox.y
      };
      if (!viewport.hasPointerCapture(pointerId)) viewport.setPointerCapture(pointerId);
    }
    return;
  }
  if (pointerStart?.pointerId !== event.pointerId) return;
  const completedDrag = pointerStart;
  pointerStart = null;
  viewport.classList.remove("is-dragging");
  viewport.classList.remove("is-dragging-person");
  if (completedDrag.captureTarget.hasPointerCapture(event.pointerId)) {
    completedDrag.captureTarget.releasePointerCapture(event.pointerId);
  }
  if (completedDrag.type === "person") {
    if (completedDrag.moved) {
      suppressPersonClick = completedDrag.personId;
      window.setTimeout(() => {
        suppressPersonClick = null;
      }, 300);
    }
    tree = moveTimelinePerson(tree, completedDrag.personId, viewMode, layoutSize.positions.get(completedDrag.personId));
    try {
      saveTree(tree);
      showStatus("Person moved. Your tree is saved in this browser.");
    } catch (error) {
      console.error("Could not save the person's position:", error);
      showStatus("Person moved, but the position could not be saved in this browser.");
    }
  }
}

viewport.addEventListener("pointerup", stopPanning);
viewport.addEventListener("pointercancel", stopPanning);
viewport.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoom(Math.exp(event.deltaY * 0.001), event.clientX);
}, { passive: false });

if ("ResizeObserver" in window) {
  new ResizeObserver(() => {
    if (!hasNavigated) fitTree();
    else {
      const bounds = viewport.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        layoutSize.fitWidth = getFitWidth(bounds.width);
        const pixelsPerYear = previousViewportWidth * YEAR_WIDTH / viewBox.width;
        const minimumWidth = bounds.width * YEAR_WIDTH / MAX_PIXELS_PER_YEAR;
        const width = Math.min(
          layoutSize.fitWidth,
          Math.max(minimumWidth, bounds.width * YEAR_WIDTH / pixelsPerYear)
        );
        const centerX = viewBox.x + viewBox.width / 2;
        setViewBox({
          ...viewBox,
          x: centerX - width / 2,
          width,
          height: bounds.height
        });
        previousViewportWidth = bounds.width;
      }
    }
  }).observe(viewport);
}

if (loadResult.warning) {
  showStatus(loadResult.warning);
} else if (loadResult.tree.people.length > 0) {
  showStatus("Explore the family tree, or add your own family.");
}
render();
