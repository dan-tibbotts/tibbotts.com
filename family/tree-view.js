const SVG_NS = "http://www.w3.org/2000/svg";
const CARD_WIDTH = 218;
const CARD_HEIGHT = 112;
const HORIZONTAL_GAP = 38;
const VERTICAL_GAP = 104;
const PADDING = 52;

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

function layoutPeople(tree) {
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
  const width = Math.max(720, PADDING * 2 + maxCount * CARD_WIDTH + (maxCount - 1) * HORIZONTAL_GAP);
  const height = PADDING * 2 + (maxLevel + 1) * CARD_HEIGHT + maxLevel * VERTICAL_GAP;
  const positions = new Map();

  for (const [level, people] of groups) {
    const rowWidth = people.length * CARD_WIDTH + (people.length - 1) * HORIZONTAL_GAP;
    const startX = (width - rowWidth) / 2;
    people.forEach((person, index) => {
      positions.set(person.id, {
        x: startX + index * (CARD_WIDTH + HORIZONTAL_GAP),
        y: PADDING + level * (CARD_HEIGHT + VERTICAL_GAP)
      });
    });
  }

  return { positions, width, height };
}

function addConnectors(svg, tree, positions) {
  const connectorGroup = createSvgElement("g", { "aria-hidden": "true" });

  for (const relationship of tree.relationships) {
    const first = positions.get(relationship.from);
    const second = positions.get(relationship.to);
    if (!first || !second) continue;

    let path;
    if (relationship.type === "parent") {
      const startX = first.x + CARD_WIDTH / 2;
      const startY = first.y + CARD_HEIGHT;
      const endX = second.x + CARD_WIDTH / 2;
      const endY = second.y;
      const middleY = (startY + endY) / 2;
      path = `M ${startX} ${startY} C ${startX} ${middleY}, ${endX} ${middleY}, ${endX} ${endY}`;
    } else {
      const fromLeft = first.x < second.x;
      const startX = fromLeft ? first.x + CARD_WIDTH : first.x;
      const endX = fromLeft ? second.x : second.x + CARD_WIDTH;
      const startY = first.y + CARD_HEIGHT / 2;
      const endY = second.y + CARD_HEIGHT / 2;
      const bend = Math.max(24, Math.abs(endX - startX) / 3);
      path = `M ${startX} ${startY} C ${startX + (fromLeft ? bend : -bend)} ${startY}, ${endX - (fromLeft ? bend : -bend)} ${endY}, ${endX} ${endY}`;
    }

    connectorGroup.append(createSvgElement("path", {
      d: path,
      class: `tree-connector ${relationship.type}`
    }));
  }

  svg.append(connectorGroup);
}

function addPersonNode(svg, person, position) {
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
  node.append(createSvgElement("rect", {
    class: "person-card",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    rx: 13
  }));
  node.append(createSvgElement("circle", {
    class: "person-avatar",
    cx: 43,
    cy: 43,
    r: 25
  }));

  const initial = createSvgElement("text", {
    class: "person-initial",
    x: 43,
    y: 50
  });
  initial.textContent = person.name.trim().charAt(0).toUpperCase();
  node.append(initial);

  const name = createSvgElement("text", {
    class: "person-name",
    x: 82,
    y: 44
  });
  name.textContent = person.name.length > 19 ? `${person.name.slice(0, 18)}…` : person.name;
  node.append(name);

  const born = createSvgElement("text", {
    class: "person-born",
    x: 82,
    y: 64
  });
  born.textContent = person.born ? `Born ${person.born}` : "Family member";
  node.append(born);

  const addAction = createActionButton("add", "Add a connected person", 177, "+");
  const deleteAction = createActionButton("delete", `Delete ${person.name}`, 200, "×");
  node.append(addAction, deleteAction);
  svg.append(node);
}

function createActionButton(action, label, x, icon) {
  const button = createSvgElement("g", {
    class: `person-action person-action-${action}`,
    "data-action": action,
    role: "button",
    tabindex: "0",
    "aria-label": label
  });
  button.append(createSvgElement("circle", { cx: x, cy: 18, r: 10 }));
  const text = createSvgElement("text", { x, y: 22 });
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

export function renderTree(svg, tree) {
  svg.replaceChildren();
  if (tree.people.length === 0) {
    svg.setAttribute("viewBox", "0 0 720 380");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    renderEmptyTree(svg);
    return { width: 720, height: 380 };
  }

  const layout = layoutPeople(tree);
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  addConnectors(svg, tree, layout.positions);
  for (const person of tree.people) {
    addPersonNode(svg, person, layout.positions.get(person.id));
  }
  return { width: layout.width, height: layout.height };
}
