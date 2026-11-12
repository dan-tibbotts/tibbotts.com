const SVG_NS = "http://www.w3.org/2000/svg";
const CARD_WIDTH = 218;
const CARD_HEIGHT = 112;
const HORIZONTAL_GAP = 38;
const VERTICAL_GAP = 104;
const PADDING = 52;
const VIEW_SIZES = {
  standard: { width: CARD_WIDTH, height: CARD_HEIGHT },
  circle: { width: 164, height: 148 }
};

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

function getGenerations(tree) {
  const levels = new Map(tree.people.map((person) => [person.id, 0]));
  for (let pass = 0; pass < tree.people.length; pass += 1) {
    for (const relationship of tree.relationships) {
      if (relationship.type !== "parent") continue;
      const parentLevel = levels.get(relationship.from);
      const childLevel = levels.get(relationship.to);
      if (parentLevel !== undefined && childLevel !== undefined) {
        levels.set(relationship.to, Math.max(childLevel, parentLevel + 1));
      }
    }
  }
  return levels;
}

function layoutPeople(tree, viewMode) {
  const { width: nodeWidth, height: nodeHeight } = VIEW_SIZES[viewMode];
  const generations = getGenerations(tree);
  const groups = new Map();
  for (const person of tree.people) {
    const level = generations.get(person.id) ?? 0;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(person);
  }

  for (const people of groups.values()) {
    people.sort((a, b) => a.name.localeCompare(b.name));
  }

  const maxCount = Math.max(1, ...Array.from(groups.values(), (people) => people.length));
  const maxLevel = Math.max(0, ...groups.keys());
  const width = Math.max(720, PADDING * 2 + maxCount * nodeWidth + (maxCount - 1) * HORIZONTAL_GAP);
  const height = PADDING * 2 + (maxLevel + 1) * nodeHeight + maxLevel * VERTICAL_GAP;
  const positions = new Map();

  for (const [level, people] of groups) {
    const rowWidth = people.length * nodeWidth + (people.length - 1) * HORIZONTAL_GAP;
    const startX = (width - rowWidth) / 2;
    people.forEach((person, index) => {
      const defaultPosition = {
        x: startX + index * (nodeWidth + HORIZONTAL_GAP),
        y: PADDING + level * (nodeHeight + VERTICAL_GAP)
      };
      positions.set(person.id, tree.positions?.[viewMode]?.[person.id] ?? defaultPosition);
    });
  }

  const minX = Math.min(PADDING, ...Array.from(positions.values(), (position) => position.x));
  const minY = Math.min(PADDING, ...Array.from(positions.values(), (position) => position.y));
  const maxX = Math.max(width - PADDING, ...Array.from(positions.values(), (position) => position.x + nodeWidth));
  const maxY = Math.max(height - PADDING, ...Array.from(positions.values(), (position) => position.y + nodeHeight));
  return {
    positions,
    x: minX - PADDING,
    y: minY - PADDING,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
    mode: viewMode
  };
}

function getConnectionAnchor(position, other, dimensions, mode) {
  const centerX = position.x + dimensions.width / 2;
  const centerY = position.y + dimensions.height / 2;
  const otherX = other.x + dimensions.width / 2;
  const otherY = other.y + dimensions.height / 2;
  const dx = otherX - centerX;
  const dy = otherY - centerY;

  if (mode === "circle") {
    const scale = 34 / Math.max(1, Math.hypot(dx, dy));
    return { x: centerX + dx * scale, y: centerY + dy * scale };
  }

  const scale = 1 / Math.max(
    Math.abs(dx) / (dimensions.width / 2),
    Math.abs(dy) / (dimensions.height / 2),
    0.001
  );
  return { x: centerX + dx * scale, y: centerY + dy * scale };
}

function addConnectors(svg, tree, layout) {
  const connectorGroup = createSvgElement("g", {
    class: "tree-connectors",
    "aria-hidden": "true"
  });
  const dimensions = VIEW_SIZES[layout.mode];

  for (const relationship of tree.relationships) {
    const first = layout.positions.get(relationship.from);
    const second = layout.positions.get(relationship.to);
    if (!first || !second) continue;

    const start = getConnectionAnchor(first, second, dimensions, layout.mode);
    const end = getConnectionAnchor(second, first, dimensions, layout.mode);
    const bend = Math.max(20, Math.abs(end.y - start.y) / 2);
    const direction = end.y >= start.y ? 1 : -1;
    const path = relationship.type === "parent"
      ? `M ${start.x} ${start.y} C ${start.x} ${start.y + bend * direction}, ${end.x} ${end.y - bend * direction}, ${end.x} ${end.y}`
      : `M ${start.x} ${start.y} C ${start.x + (end.x - start.x) / 3} ${start.y}, ${end.x - (end.x - start.x) / 3} ${end.y}, ${end.x} ${end.y}`;

    connectorGroup.append(createSvgElement("path", {
      d: path,
      class: `tree-connector ${relationship.type}`
    }));
  }

  svg.insertBefore(connectorGroup, svg.firstChild);
}

function addPersonNode(svg, person, position, mode) {
  const dimensions = VIEW_SIZES[mode];
  const node = createSvgElement("g", {
    class: "person-node",
    transform: `translate(${position.x} ${position.y})`,
    role: "group",
    tabindex: "0",
    "aria-label": `${person.name}${person.born ? `, born ${person.born}` : ""}`,
    "data-person-id": person.id
  });
  const title = createSvgElement("title");
  title.textContent = person.name;
  node.append(title);
  if (mode === "circle") {
    addCirclePersonContent(node, person);
  } else {
    addStandardPersonContent(node, person);
  }

  const addAction = createActionButton("add", "Add a connected person", dimensions.width - 39, 15, "+");
  const deleteAction = createActionButton("delete", `Delete ${person.name}`, dimensions.width - 15, 15, "×");
  node.append(addAction, deleteAction);
  svg.append(node);
}

function addStandardPersonContent(node, person) {
  node.append(createSvgElement("rect", {
    class: "person-card",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    rx: 13
  }));
  node.append(createSvgElement("circle", { class: "person-avatar", cx: 43, cy: 43, r: 25 }));
  const initial = createSvgElement("text", { class: "person-initial", x: 43, y: 50 });
  initial.textContent = person.name.trim().charAt(0).toUpperCase();
  node.append(initial);
  if (person.photo) {
    const clip = createSvgElement("clipPath", { id: `avatar-${person.id}` });
    clip.append(createSvgElement("circle", { cx: 43, cy: 43, r: 25 }));
    const definitions = createSvgElement("defs");
    definitions.append(clip);
    node.append(definitions);
    const photo = createSvgElement("image", {
      class: "person-avatar-image",
      x: 18,
      y: 18,
      width: 50,
      height: 50,
      preserveAspectRatio: "xMidYMid slice",
      href: person.photo,
      "clip-path": `url(#avatar-${person.id})`
    });
    node.append(photo);
  }

  const name = createSvgElement("text", { class: "person-name", x: 82, y: 44 });
  name.textContent = person.name.length > 19 ? `${person.name.slice(0, 18)}…` : person.name;
  node.append(name);
  const born = createSvgElement("text", { class: "person-born", x: 82, y: 64 });
  born.textContent = person.born ? `Born ${person.born}` : "Family member";
  node.append(born);
}

function addCirclePersonContent(node, person) {
  const centerX = VIEW_SIZES.circle.width / 2;
  const centerY = 45;
  node.append(createSvgElement("circle", {
    class: "person-circle-frame",
    cx: centerX,
    cy: centerY,
    r: 36
  }));
  if (person.photo) {
    const clipId = `avatar-${person.id}`;
    const clip = createSvgElement("clipPath", { id: clipId });
    clip.append(createSvgElement("circle", { cx: centerX, cy: centerY, r: 33 }));
    node.append(clip);
    node.append(createSvgElement("image", {
      class: "person-circle-photo",
      x: centerX - 33,
      y: centerY - 33,
      width: 66,
      height: 66,
      preserveAspectRatio: "xMidYMid slice",
      href: person.photo,
      "clip-path": `url(#${clipId})`
    }));
  } else {
    node.append(createSvgElement("circle", {
      class: "person-circle-placeholder",
      cx: centerX,
      cy: centerY,
      r: 33
    }));
    const initial = createSvgElement("text", {
      class: "person-circle-initial",
      x: centerX,
      y: centerY + 9
    });
    initial.textContent = person.name.trim().charAt(0).toUpperCase();
    node.append(initial);
  }
  const name = createSvgElement("text", {
    class: "person-circle-name",
    x: centerX,
    y: 105
  });
  name.textContent = person.name.length > 20 ? `${person.name.slice(0, 19)}…` : person.name;
  node.append(name);
  const born = createSvgElement("text", {
    class: "person-circle-born",
    x: centerX,
    y: 124
  });
  born.textContent = person.born ? `Born ${person.born}` : "Family member";
  node.append(born);
}

function createActionButton(action, label, x, y, icon) {
  const button = createSvgElement("g", {
    class: `person-action person-action-${action}`,
    "data-action": action,
    role: "button",
    tabindex: "0",
    "aria-label": label
  });
  button.append(createSvgElement("circle", { cx: x, cy: y, r: 10 }));
  const text = createSvgElement("text", { x, y: y + 4 });
  text.textContent = icon;
  button.append(text);
  return button;
}

function renderEmptyTree(svg) {
  const group = createSvgElement("g", {
    class: "empty-person",
    role: "button",
    tabindex: "0",
    "data-action": "create",
    "aria-label": "Add the first person to your family tree"
  });
  group.append(createSvgElement("rect", {
    class: "empty-person-card",
    x: 225,
    y: 120,
    width: 270,
    height: 140,
    rx: 15
  }));
  group.append(createSvgElement("circle", {
    class: "empty-person-plus",
    cx: 360,
    cy: 160,
    r: 18
  }));
  const plus = createSvgElement("text", { class: "empty-person-icon", x: 360, y: 166 });
  plus.textContent = "+";
  group.append(plus);
  const title = createSvgElement("text", { class: "empty-person-title", x: 360, y: 208 });
  title.textContent = "Add the first person";
  group.append(title);
  const subtitle = createSvgElement("text", { class: "empty-person-subtitle", x: 360, y: 232 });
  subtitle.textContent = "Start a new family branch";
  group.append(subtitle);
  svg.append(group);
}

export function renderTree(svg, tree, viewMode = "standard") {
  svg.replaceChildren();
  if (tree.people.length === 0) {
    svg.setAttribute("viewBox", "0 0 720 380");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    renderEmptyTree(svg);
    return { x: 0, y: 0, width: 720, height: 380, positions: new Map(), mode: viewMode };
  }

  const layout = layoutPeople(tree, viewMode);
  svg.setAttribute("viewBox", `${layout.x} ${layout.y} ${layout.width} ${layout.height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  addConnectors(svg, tree, layout);
  for (const person of tree.people) {
    addPersonNode(svg, person, layout.positions.get(person.id), viewMode);
  }
  return layout;
}

export function movePersonNode(svg, tree, layout, personId, position) {
  layout.positions.set(personId, position);
  const node = Array.from(svg.querySelectorAll(".person-node"))
    .find((personNode) => personNode.dataset.personId === personId);
  if (!node) return;
  node.setAttribute("transform", `translate(${position.x} ${position.y})`);
  svg.querySelector(".tree-connectors")?.remove();
  addConnectors(svg, tree, layout);
}
