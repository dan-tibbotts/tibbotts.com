import { addPerson, addRelationship, loadTree, saveTree } from "./tree-model.js";
import { renderTree } from "./tree-view.js";

const svg = document.querySelector("#family-tree");
const viewport = document.querySelector("#tree-viewport");
const status = document.querySelector("#tree-status");
const emptyState = document.querySelector("#empty-state");
const personDialog = document.querySelector("#person-dialog");
const addPersonDialog = document.querySelector("#add-person-dialog");
const connectionDialog = document.querySelector("#connection-dialog");
const personForm = document.querySelector("#person-form");
const connectionForm = document.querySelector("#connection-form");
const loadResult = loadTree();

let tree = loadResult.tree;
let layoutSize = { width: 720, height: 380 };
let viewBox = { x: 0, y: 0, width: 720, height: 380 };
let selectedPersonId = null;
let hasNavigated = false;
let pointerStart = null;

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
    x: (layoutSize.width - width) / 2,
    y: (layoutSize.height - height) / 2,
    width,
    height
  });
  hasNavigated = false;
}

function render() {
  emptyState.hidden = tree.people.length > 0;
  layoutSize = renderTree(svg, tree);
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

  const familyNames = new Set();
  for (const relationship of tree.relationships) {
    if (relationship.type === "partner" &&
        (relationship.from === personId || relationship.to === personId)) {
      const relativeId = relationship.from === personId ? relationship.to : relationship.from;
      const relative = tree.people.find((item) => item.id === relativeId);
      if (relative) familyNames.add(`${relative.name} · partner`);
    } else if (relationship.type === "parent" &&
        (relationship.from === personId || relationship.to === personId)) {
      const relativeId = relationship.from === personId ? relationship.to : relationship.from;
      const relative = tree.people.find((item) => item.id === relativeId);
      if (relative) {
        familyNames.add(`${relative.name} · ${relationship.from === personId ? "child" : "parent"}`);
      }
    }
  }
  document.querySelector("#person-family").textContent =
    Array.from(familyNames).join(", ");
  personDialog.showModal();
}

function openConnectionDialog(personId) {
  if (tree.people.length < 2) {
    showStatus("Add another person before creating a connection.");
    return;
  }

  populatePersonOptions(connectionForm.elements.person, personId);
  populatePersonOptions(connectionForm.elements.relative);
  if (tree.people.length > 1) {
    connectionForm.elements.relative.value =
      tree.people.find((person) => person.id !== personId)?.id ?? "";
  }
  document.querySelector("#connection-error").textContent = "";
  connectionDialog.showModal();
}

document.querySelector("#add-person").addEventListener("click", () => {
  personForm.reset();
  document.querySelector("#person-error").textContent = "";
  addPersonDialog.showModal();
});

document.querySelector("#person-add-connection").addEventListener("click", () => {
  personDialog.close();
  openConnectionDialog(selectedPersonId);
});

personForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = new FormData(personForm);
  try {
    const nextTree = addPerson(tree, {
      name: values.get("name"),
      born: values.get("born"),
      place: values.get("place"),
      story: values.get("story")
    });
    saveChanges(nextTree);
    addPersonDialog.close();
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

document.querySelector("#zoom-in").addEventListener("click", () => zoom(0.8));
document.querySelector("#zoom-out").addEventListener("click", () => zoom(1.25));
document.querySelector("#zoom-level").addEventListener("click", fitTree);

svg.addEventListener("click", (event) => {
  const node = event.target.closest(".person-node");
  if (node) openPerson(node.dataset.personId);
});

svg.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") &&
      event.target.classList.contains("person-node")) {
    event.preventDefault();
    openPerson(event.target.dataset.personId);
  }
});

viewport.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".person-node")) return;
  pointerStart = {
    pointerId: event.pointerId,
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
  setViewBox({
    ...viewBox,
    x: pointerStart.viewX - (event.clientX - pointerStart.x) * (viewBox.width / bounds.width),
    y: pointerStart.viewY - (event.clientY - pointerStart.y) * (viewBox.height / bounds.height)
  });
  hasNavigated = true;
});

function stopPanning(event) {
  if (pointerStart?.pointerId !== event.pointerId) return;
  pointerStart = null;
  viewport.classList.remove("is-dragging");
  if (viewport.hasPointerCapture(event.pointerId)) {
    viewport.releasePointerCapture(event.pointerId);
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
