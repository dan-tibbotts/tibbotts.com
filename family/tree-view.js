const SVG_NS = "http://www.w3.org/2000/svg";
const CARD_WIDTH = 218;
const CARD_HEIGHT = 112;
const HORIZONTAL_GAP = 38;
const PADDING = 52;
const AXIS_WIDTH = 70;
const TOP_PADDING = 42;
const YEAR_SPACING = 6;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
  "Unknown"
];
const MONTH_GAP = 18;
const BOTTOM_TIMELINE_HEIGHT = 54;
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

function readBirthYear(person) {
  const match = person.born.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return match ? Number(match[1]) : null;
}

export function getBirthMonth(person) {
  const savedMonth = Number(person.birthMonth);
  if (Number.isInteger(savedMonth) && savedMonth >= 1 && savedMonth <= 12) {
    return savedMonth;
  }
  if (/\bbapti[sz]ed\b/i.test(person.born)) return null;

  const isoDate = person.born.match(/\b(?:1[0-9]{3}|20[0-9]{2})-(0?[1-9]|1[0-2])-\d{1,2}\b/);
  if (isoDate) return Number(isoDate[1]);

  const match = person.born.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
  if (!match) return null;
  return MONTHS.findIndex((month) =>
    month.toLowerCase().startsWith(match[1].slice(0, 3).toLowerCase())
  ) + 1;
}

export function inferBirthYears(tree) {
  const years = new Map();
  for (const person of tree.people) {
    const year = readBirthYear(person);
    if (year !== null) years.set(person.id, { year, estimated: false });
  }

  const parentsByChild = new Map(tree.people.map((person) => [person.id, []]));
  const childrenByParent = new Map(tree.people.map((person) => [person.id, []]));
  const partnersByPerson = new Map(tree.people.map((person) => [person.id, []]));
  for (const relationship of tree.relationships) {
    if (relationship.type === "parent") {
      parentsByChild.get(relationship.to)?.push(relationship.from);
      childrenByParent.get(relationship.from)?.push(relationship.to);
    } else if (relationship.type === "partner") {
      partnersByPerson.get(relationship.from)?.push(relationship.to);
      partnersByPerson.get(relationship.to)?.push(relationship.from);
    }
  }

  for (let pass = 0; pass < tree.people.length; pass += 1) {
    let changed = false;
    for (const person of tree.people) {
      if (years.has(person.id)) continue;

      const parentYears = parentsByChild.get(person.id)
        .map((parentId) => years.get(parentId)?.year)
        .filter(Number.isFinite);
      const childYears = childrenByParent.get(person.id)
        .map((childId) => years.get(childId)?.year)
        .filter(Number.isFinite);
      const partnerYears = partnersByPerson.get(person.id)
        .map((partnerId) => years.get(partnerId)?.year)
        .filter(Number.isFinite);

      let year;
      if (parentYears.length > 0) {
        year = Math.max(...parentYears) + 18;
      } else if (childYears.length > 0) {
        year = Math.min(...childYears) - 18;
      } else if (partnerYears.length > 0) {
        year = partnerYears[0];
      }

      if (year !== undefined) {
        years.set(person.id, { year, estimated: true });
        changed = true;
      }
    }
    if (!changed) break;
  }

  const knownYears = Array.from(years.values(), ({ year }) => year);
  const fallbackYear = knownYears.length
    ? Math.round(knownYears.reduce((sum, year) => sum + year, 0) / knownYears.length)
    : 1900;
  for (const person of tree.people) {
    if (!years.has(person.id)) years.set(person.id, { year: fallbackYear, estimated: true });
  }
  return years;
}

function layoutPeople(tree, viewMode) {
  const { width: nodeWidth, height: nodeHeight } = VIEW_SIZES[viewMode];
  const birthYears = inferBirthYears(tree);
  const minYear = Math.min(...Array.from(birthYears.values(), ({ year }) => year));
  const maxYear = Math.max(...Array.from(birthYears.values(), ({ year }) => year));
  const entries = tree.people.map((person) => {
    const birth = birthYears.get(person.id);
    const birthMonth = getBirthMonth(person);
    return {
      person,
      year: birth.year,
      month: birthMonth ?? 13,
      y: TOP_PADDING + (birth.year - minYear) * YEAR_SPACING - nodeHeight / 2
    };
  }).sort((first, second) =>
    first.month - second.month ||
    first.year - second.year ||
    first.person.name.localeCompare(second.person.name)
  );
  const entriesByMonth = new Map(MONTHS.map((_, index) => [index + 1, []]));
  for (const entry of entries) entriesByMonth.get(entry.month).push(entry);

  const monthColumns = new Map();
  for (const [month, monthEntries] of entriesByMonth) {
    const laneBottoms = [];
    for (const entry of monthEntries) {
      let lane = laneBottoms.findIndex((bottom) => bottom + 12 <= entry.y);
      if (lane === -1) lane = laneBottoms.length;
      laneBottoms[lane] = entry.y + nodeHeight;
      entry.lane = lane;
    }
    const lanes = Math.max(1, laneBottoms.length);
    const columnWidth = lanes * nodeWidth + (lanes - 1) * HORIZONTAL_GAP + MONTH_GAP * 2;
    monthColumns.set(month, { width: columnWidth, lanes });
  }

  let nextColumnX = AXIS_WIDTH;
  for (const month of entriesByMonth.keys()) {
    const column = monthColumns.get(month);
    column.left = nextColumnX;
    column.right = nextColumnX + column.width;
    column.label = MONTHS[month - 1];
    nextColumnX += column.width;
  }

  const positions = new Map();
  const columnBounds = new Map();

  for (const entry of entries) {
    const column = monthColumns.get(entry.month);
    const left = column.left + MONTH_GAP;
    const right = column.right - MONTH_GAP;
    const defaultX = left + entry.lane * (nodeWidth + HORIZONTAL_GAP);
    const savedX = tree.positions?.[viewMode]?.[entry.person.id]?.x;
    positions.set(entry.person.id, {
      x: Number.isFinite(savedX)
        ? Math.min(right - nodeWidth, Math.max(left, savedX))
        : defaultX,
      y: entry.y
    });
    columnBounds.set(entry.person.id, { left, right });
  }

  const width = Math.max(720, nextColumnX + PADDING);
  const height = Math.max(
    380,
    TOP_PADDING + (maxYear - minYear) * YEAR_SPACING + nodeHeight +
      BOTTOM_TIMELINE_HEIGHT + PADDING
  );
  const minX = Math.min(0, ...Array.from(positions.values(), (position) => position.x - PADDING));
  const maxX = Math.max(width, ...Array.from(positions.values(), (position) => position.x + nodeWidth + PADDING));
  const minY = Math.min(0, ...Array.from(positions.values(), (position) => position.y - PADDING));
  const maxY = Math.max(height, ...Array.from(positions.values(), (position) => position.y + nodeHeight + PADDING));
  return {
    positions,
    columnBounds,
    monthColumns,
    birthYears,
    minYear,
    maxYear,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    mode: viewMode,
    nodeWidth,
    nodeHeight,
    axisWidth: AXIS_WIDTH,
    timelineBottom: height - PADDING
  };
}

function addTimeline(svg, layout) {
  const timeline = createSvgElement("g", {
    class: "timeline",
    "aria-hidden": "true"
  });
  const firstY = TOP_PADDING;
  const lastY = TOP_PADDING + (layout.maxYear - layout.minYear) * YEAR_SPACING;
  const bottomY = layout.timelineBottom;
  timeline.append(createSvgElement("line", {
    class: "timeline-axis",
    x1: AXIS_WIDTH - 12,
    y1: firstY,
    x2: AXIS_WIDTH - 12,
    y2: bottomY
  }));

  for (let year = layout.minYear; year <= layout.maxYear; year += 1) {
    const y = TOP_PADDING + (year - layout.minYear) * YEAR_SPACING;
    const major = year % 5 === 0;
    timeline.append(createSvgElement("line", {
      class: `timeline-year-line${major ? " major" : ""}`,
      x1: AXIS_WIDTH - 12,
      y1: y,
      x2: layout.width - PADDING,
      y2: y
    }));
    if (major) {
      const label = createSvgElement("text", {
        class: "timeline-year-label",
        x: AXIS_WIDTH - 22,
        y: y + 4
      });
      label.textContent = String(year);
      timeline.append(label);
    }
  }

  for (const [month, column] of layout.monthColumns) {
    const centerX = (column.left + column.right) / 2;
    timeline.append(createSvgElement("line", {
      class: "timeline-month-line",
      x1: column.left,
      y1: TOP_PADDING,
      x2: column.left,
      y2: bottomY
    }));
    const label = createSvgElement("text", {
      class: "timeline-month-label",
      x: centerX,
      y: bottomY + 27
    });
    label.textContent = column.label;
    timeline.append(label);
    if (month === 13) {
      timeline.append(createSvgElement("line", {
        class: "timeline-month-line",
        x1: column.right,
        y1: TOP_PADDING,
        x2: column.right,
        y2: bottomY
      }));
    }
  }
  timeline.append(createSvgElement("line", {
    class: "timeline-bottom-axis",
    x1: AXIS_WIDTH - 12,
    y1: bottomY,
    x2: layout.width - PADDING,
    y2: bottomY
  }));
  const axisTitle = createSvgElement("text", {
    class: "timeline-axis-title",
    x: 8,
    y: bottomY + 27
  });
  axisTitle.textContent = "Birth month";
  timeline.append(axisTitle);

  svg.append(timeline);
  svg.insertBefore(timeline, svg.firstChild);
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
      class: `tree-connector ${relationship.type}${relationship.uncertain ? " uncertain" : ""}`
    }));
  }

  const timeline = svg.querySelector(".timeline");
  svg.insertBefore(connectorGroup, timeline ? timeline.nextSibling : svg.firstChild);
}

function addPersonNode(svg, person, position, mode, birthYear) {
  const dimensions = VIEW_SIZES[mode];
  const node = createSvgElement("g", {
    class: "person-node",
    transform: `translate(${position.x} ${position.y})`,
    role: "group",
    tabindex: "0",
    "aria-label": `${person.name}, ${birthYear.estimated ? "estimated born" : "born"} ${birthYear.year}`,
    "data-birth-year": birthYear.year,
    "data-person-id": person.id
  });
  const title = createSvgElement("title");
  title.textContent = person.name;
  node.append(title);
  if (mode === "circle") {
    addCirclePersonContent(node, person, birthYear);
  } else {
    addStandardPersonContent(node, person, birthYear);
  }

  const addAction = createActionButton("add", "Add a connected person", dimensions.width - 39, 15, "+");
  const deleteAction = createActionButton("delete", `Delete ${person.name}`, dimensions.width - 15, 15, "×");
  node.append(addAction, deleteAction);
  svg.append(node);
}

function addStandardPersonContent(node, person, birthYear) {
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
  born.textContent = birthYear.estimated ? `Est. ${birthYear.year}` : `Born ${birthYear.year}`;
  node.append(born);
}

function addCirclePersonContent(node, person, birthYear) {
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
  born.textContent = birthYear.estimated ? `Est. ${birthYear.year}` : `Born ${birthYear.year}`;
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
  addTimeline(svg, layout);
  addConnectors(svg, tree, layout);
  for (const person of tree.people) {
    addPersonNode(
      svg,
      person,
      layout.positions.get(person.id),
      viewMode,
      layout.birthYears.get(person.id)
    );
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
