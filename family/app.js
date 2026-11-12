import {
  addPerson,
  addRelationship,
  deletePerson,
  getPersonConnections,
  loadTree,
  movePerson,
  saveTree,
  updatePerson
} from "./tree-model.js?v=3";
import { movePersonNode, renderTree } from "./tree-view.js?v=3";

const svg = document.querySelector("#family-tree");
const viewport = document.querySelector("#tree-viewport");
const status = document.querySelector("#tree-status");
const personDialog = document.querySelector("#person-dialog");
const addPersonDialog = document.querySelector("#add-person-dialog");
const connectionDialog = document.querySelector("#connection-dialog");
const personForm = document.querySelector("#person-form");
const connectionForm = document.querySelector("#connection-form");
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
let pointerStart = null;
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
  svg.setAttribute(
    "viewBox",
    `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
  );
}

function fitTree() {
  const bounds = viewport.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return;

  const aspectRatio = bounds.width / bounds.height;
  const width = Math.max(layoutSize.width, layoutSize.height * aspectRatio);
  const height = Math.max(layoutSize.height, layoutSize.width / aspectRatio);
  setViewBox({
    x: layoutSize.x - (width - layoutSize.width) / 2,
    y: layoutSize.y - (height - layoutSize.height) / 2,
    width,
    height
  });
  hasNavigated = false;
}

function render() {
  layoutSize = renderTree(svg, tree, viewMode);
  fitTree();
}

function zoom(factor) {
  const nextWidth = Math.min(layoutSize.width * 2.5, Math.max(layoutSize.width * 0.3, viewBox.width * factor));
  const nextHeight = viewBox.height * (nextWidth / viewBox.width);
  const centerX = viewBox.x + viewBox.width / 2;
  const centerY = viewBox.y + viewBox.height / 2;
  setViewBox({
    x: centerX - nextWidth / 2,
    y: centerY - nextHeight / 2,
    width: nextWidth,
    height: nextHeight
  });
  hasNavigated = true;
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
  for (const connection of getPersonConnections(tree, personId)) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.className = "connection-link";
    button.type = "button";
    button.dataset.openPerson = connection.person.id;
    button.append(document.createTextNode(connection.person.name));
    const relation = document.createElement("span");
    relation.textContent = connection.label;
    button.append(relation);
    item.append(button);
    connections.append(item);
  }
  if (connections.childElementCount === 0) {
    const item = document.createElement("li");
    item.className = "no-connections";
    item.textContent = "No connections yet";
    connections.append(item);
  }
  personDialog.showModal();
}

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
  if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
  const bounds = viewport.getBoundingClientRect();
  if (pointerStart.type === "person") {
    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 4) {
      pointerStart.moved = true;
    }
    const dimensions = viewMode === "circle"
      ? { width: 164, height: 148 }
      : { width: 218, height: 112 };
    const position = {
      x: Math.min(
        layoutSize.x + layoutSize.width - dimensions.width - 12,
        Math.max(layoutSize.x + 12, pointerStart.position.x + (event.clientX - pointerStart.x) * (viewBox.width / bounds.width))
      ),
      y: Math.min(
        layoutSize.y + layoutSize.height - dimensions.height - 12,
        Math.max(layoutSize.y + 12, pointerStart.position.y + (event.clientY - pointerStart.y) * (viewBox.height / bounds.height))
      )
    };
    movePersonNode(svg, tree, layoutSize, pointerStart.personId, position);
    hasNavigated = true;
    return;
  }

  setViewBox({
    ...viewBox,
    x: pointerStart.viewX - (event.clientX - pointerStart.x) * (viewBox.width / bounds.width),
    y: pointerStart.viewY - (event.clientY - pointerStart.y) * (viewBox.height / bounds.height)
  });
  hasNavigated = true;
});

function stopPanning(event) {
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
    tree = movePerson(tree, completedDrag.personId, viewMode, layoutSize.positions.get(completedDrag.personId));
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
  zoom(event.deltaY < 0 ? 0.9 : 1.1);
}, { passive: false });

if ("ResizeObserver" in window) {
  new ResizeObserver(() => {
    if (!hasNavigated) fitTree();
  }).observe(viewport);
}

if (loadResult.warning) {
  showStatus(loadResult.warning);
} else if (loadResult.tree.people.length > 0) {
  showStatus("Explore the sample tree, or add your own family.");
}
render();
