const SVG_NS = "http://www.w3.org/2000/svg";
const CARD_WIDTH = 218;
const CARD_HEIGHT = 112;
export const YEAR_WIDTH = 100;
const AXIS_PADDING = 80;
const TOP_PADDING = 32;
const VERTICAL_GAP = 14;
const TIMELINE_HEIGHT = 56;
export const MAX_PIXELS_PER_YEAR = 2400;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
  "Unknown"
];
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

function getBirthDateValue(person, year) {
  const month = getBirthMonth(person);
  if (month === null) return year + 0.5;

  const isoDate = person.born.match(/\b(?:1[0-9]{3}|20[0-9]{2})-(0?[1-9]|1[0-2])-([1-3]?\d)\b/);
  const namedDate = person.born.match(
    /\b([1-3]?\d)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
  );
  const day = isoDate
    ? Number(isoDate[2])
    : namedDate
      ? Number(namedDate[1])
      : null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = (Date.UTC(year, month - 1, 1) - Date.UTC(year, 0, 1)) / 86_400_000;
  const dayOffset = day === null || day < 1 || day > daysInMonth
    ? daysInMonth / 2
    : day - 1;
  const daysInYear = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;
  return year + (monthStart + dayOffset) / daysInYear;
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
    const date = getBirthDateValue(person, birth.year);
    return {
      person,
      year: birth.year,
      date,
      x: AXIS_PADDING + (date - minYear) * YEAR_WIDTH,
      legacyX: tree.positions?.[viewMode]?.[person.id]?.x
    };
  }).sort((first, second) =>
    first.date - second.date ||
    (Number.isFinite(first.legacyX) ? first.legacyX : 0) -
      (Number.isFinite(second.legacyX) ? second.legacyX : 0) ||
    first.person.name.localeCompare(second.person.name)
  );
  const width = Math.max(720, (maxYear - minYear) * YEAR_WIDTH + AXIS_PADDING * 2);
  return {
    positions: new Map(),
    entries,
    birthYears,
    minYear,
    maxYear,
    x: 0,
    y: 0,
    startX: AXIS_PADDING,
    width,
    height: Math.max(380, entries.length * (nodeHeight + VERTICAL_GAP)),
    mode: viewMode,
    nodeWidth,
    nodeHeight,
    scale: 1,
    manualPositions: tree.timelinePositions?.[viewMode] ?? {}
  };
}

const GRID_INTERVALS = [1 / 12, 1 / 4, 1 / 2, 1, 2, 5, 10, 25, 50, 100, 200, 500];

export function chooseGridIntervals(pixelsPerYear, previousMajor = null, visibleYears = Infinity) {
  const intervals = GRID_INTERVALS.filter((interval) => interval <= visibleYears);
  const availableIntervals = intervals.length ? intervals : [GRID_INTERVALS[0]];
  const targetSpacing = 140;
  let majorIndex = availableIntervals.reduce((bestIndex, interval, index) =>
    Math.abs(Math.log(pixelsPerYear * interval / targetSpacing)) <
      Math.abs(Math.log(pixelsPerYear * availableIntervals[bestIndex] / targetSpacing))
      ? index
      : bestIndex,
  0);
  const previousIndex = availableIntervals.indexOf(previousMajor);
  if (previousIndex !== -1) {
    const previousSpacing = pixelsPerYear * previousMajor;
    if (previousSpacing >= 100 && previousSpacing <= 180) majorIndex = previousIndex;
  }
  const major = availableIntervals[majorIndex];
  const minor = availableIntervals.filter((interval) =>
    interval < major &&
    Number.isInteger(major / interval) &&
    pixelsPerYear * interval >= 30
  ).at(-1) ?? null;
  return { major, minor };
}

function getGridDates(start, end, interval) {
  if (interval < 1) {
    const monthsPerInterval = Math.round(interval * 12);
    const firstMonth = Math.ceil((Math.floor(start) - 1) * 12 / monthsPerInterval) * monthsPerInterval;
    const lastMonth = (Math.floor(end) + 2) * 12;
    const dates = [];
    for (let monthIndex = firstMonth; monthIndex <= lastMonth; monthIndex += monthsPerInterval) {
      const year = Math.floor(monthIndex / 12);
      const month = ((monthIndex % 12) + 12) % 12;
      const dayOfYear = (Date.UTC(year, month, 1) - Date.UTC(year, 0, 1)) / 86_400_000;
      const daysInYear = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;
      const value = year + dayOfYear / daysInYear;
      if (value >= start && value <= end) dates.push({ value, month, year });
    }
    return dates;
  }

  const firstYear = Math.ceil(start / interval) * interval;
  const lastYear = Math.floor(end / interval) * interval;
  const dates = [];
  for (let year = firstYear; year <= lastYear; year += interval) {
    dates.push({ value: year, year });
  }
  return dates;
}

function updatePersonTransforms(svg, layout) {
  for (const node of svg.querySelectorAll(".person-node")) {
    const position = layout.positions.get(node.dataset.personId);
    if (position) {
      const screenX = (position.x - layout.camera.x) * layout.scale;
      const screenY = position.y - layout.camera.y;
      node.setAttribute("transform", `translate(${screenX} ${screenY})`);
    }
  }
}

function reflowPeople(svg, tree, layout, viewBox, viewportWidth, viewportHeight) {
  const scale = viewportWidth / viewBox.width;
  layout.camera = viewBox;
  layout.scale = scale;
  const laneRightEdges = [];
  layout.positions.clear();

  for (const entry of layout.entries) {
    const saved = layout.manualPositions[entry.person.id];
    const screenX = (entry.x - viewBox.x) * scale;
    let lane = laneRightEdges.findIndex((right) => right + VERTICAL_GAP <= screenX);
    if (lane === -1) lane = laneRightEdges.length;
    laneRightEdges[lane] = screenX + layout.nodeWidth;
    layout.positions.set(entry.person.id, {
      x: entry.x,
      y: Number.isFinite(saved?.y)
        ? saved.y
        : TOP_PADDING + lane * (layout.nodeHeight + VERTICAL_GAP)
    });
  }

  layout.height = Math.max(
    viewportHeight,
    ...Array.from(layout.positions.values(), ({ y }) => y + layout.nodeHeight + VERTICAL_GAP)
  );
  updatePersonTransforms(svg, layout);
  updateConnectors(svg, tree, layout);
}

export function updateTimeline(svg, layout, viewBox, viewportWidth, viewportHeight) {
  svg.querySelector(".timeline-year-axis")?.remove();
  if (!layout.birthYears || viewportWidth <= 0 || viewportHeight <= 0) return;
  const scale = viewportWidth / viewBox.width;
  reflowPeople(svg, layout.tree, layout, viewBox, viewportWidth, viewportHeight);

  const timeline = createSvgElement("g", {
    class: "timeline-year-axis",
    "aria-hidden": "true"
  });
  const barTop = viewportHeight - TIMELINE_HEIGHT;
  const pixelsPerYear = scale * YEAR_WIDTH;
  const start = Math.max(0, (viewBox.x - AXIS_PADDING) / YEAR_WIDTH + layout.minYear);
  const end = (viewBox.x + viewBox.width - AXIS_PADDING) / YEAR_WIDTH + layout.minYear;
  const { major, minor } = chooseGridIntervals(
    pixelsPerYear,
    layout.majorInterval,
    end - start
  );
  layout.majorInterval = major;

  timeline.append(createSvgElement("rect", {
    class: "timeline-year-bar",
    x: 0,
    y: barTop,
    width: viewportWidth,
    height: TIMELINE_HEIGHT
  }));
  const gridLines = new Map();
  for (const date of (minor ? getGridDates(start, end, minor) : [])) {
    gridLines.set(date.value, { ...date, major: false });
  }
  for (const date of getGridDates(start, end, major)) {
    gridLines.set(date.value, { ...date, major: true });
  }
  let lastLabelRight = -Infinity;
  for (const date of gridLines.values()) {
    const worldX = AXIS_PADDING + (date.value - layout.minYear) * YEAR_WIDTH;
    const x = (worldX - viewBox.x) * scale;
    const line = createSvgElement("line", {
      class: `timeline-year-line${date.major ? " major" : ""}`,
      x1: x,
      y1: 0,
      x2: x,
      y2: barTop
    });
    timeline.append(line);
    if (!date.major) continue;

    const labelText = date.month === undefined
      ? String(date.year)
      : `${MONTHS[date.month].slice(0, 3)} ${date.year}`;
    const screenX = x;
    const labelWidth = labelText.length * 8;
    const labelLeft = screenX - labelWidth / 2;
    const labelRight = screenX + labelWidth / 2;
    if (labelLeft < 0 || labelRight > viewportWidth || labelLeft < lastLabelRight + 8) continue;

    const label = createSvgElement("text", {
      class: "timeline-year-label",
      x,
      y: barTop + 22,
      "text-anchor": "middle"
    });
    label.textContent = labelText;
    timeline.append(label);
    lastLabelRight = labelRight;
  }
  timeline.append(createSvgElement("line", {
    class: "timeline-bottom-axis",
    x1: 0,
    y1: barTop,
    x2: viewportWidth,
    y2: barTop
  }));
  svg.append(timeline);
}

function getConnectionAnchor(position, other, dimensions, mode) {
  const centerX = position.x + dimensions.width / 2;
  const centerY = position.y + dimensions.height / 2;
  const otherX = other.x + dimensions.width / 2;
  const otherY = other.y + dimensions.height / 2;
  const dx = otherX - centerX;
  const dy = otherY - centerY;

  if (mode === "circle") {
    const scale = 1 / Math.sqrt(
      (dx / (dimensions.width / 2)) ** 2 +
      (dy / (dimensions.height / 2)) ** 2
    );
    return { x: centerX + dx * scale, y: centerY + dy * scale };
  }

  const scale = 1 / Math.max(
    Math.abs(dx) / (dimensions.width / 2),
    Math.abs(dy) / (dimensions.height / 2),
    0.001
  );
  return { x: centerX + dx * scale, y: centerY + dy * scale };
}

function updateConnectors(svg, tree, layout) {
  let connectorGroup = svg.querySelector(".tree-connectors");
  if (!connectorGroup) {
    connectorGroup = createSvgElement("g", {
      class: "tree-connectors",
      "aria-hidden": "true"
    });
  }
  const dimensions = VIEW_SIZES[layout.mode];
  let pathIndex = 0;

  for (const relationship of tree.relationships) {
    const firstPosition = layout.positions.get(relationship.from);
    const secondPosition = layout.positions.get(relationship.to);
    if (!firstPosition || !secondPosition) continue;
    const first = {
      x: (firstPosition.x - layout.camera.x) * layout.scale,
      y: firstPosition.y - layout.camera.y
    };
    const second = {
      x: (secondPosition.x - layout.camera.x) * layout.scale,
      y: secondPosition.y - layout.camera.y
    };

    const start = getConnectionAnchor(first, second, dimensions, layout.mode);
    const end = getConnectionAnchor(second, first, dimensions, layout.mode);
    const bend = Math.max(20, Math.abs(end.y - start.y) / 2);
    const direction = end.y >= start.y ? 1 : -1;
    const path = relationship.type === "parent"
      ? `M ${start.x} ${start.y} C ${start.x} ${start.y + bend * direction}, ${end.x} ${end.y - bend * direction}, ${end.x} ${end.y}`
      : `M ${start.x} ${start.y} C ${start.x + (end.x - start.x) / 3} ${start.y}, ${end.x - (end.x - start.x) / 3} ${end.y}, ${end.x} ${end.y}`;

    let connector = connectorGroup.children[pathIndex];
    if (!connector) {
      connector = createSvgElement("path");
      connectorGroup.append(connector);
    }
    connector.setAttribute("d", path);
    connector.setAttribute(
      "class",
      `tree-connector ${relationship.type}${relationship.uncertain ? " uncertain" : ""}`
    );
    pathIndex += 1;
  }

  for (const connector of Array.from(connectorGroup.children).slice(pathIndex)) {
    connector.remove();
  }
  if (!connectorGroup.parentNode) {
    const firstNode = svg.querySelector(".person-node");
    svg.insertBefore(connectorGroup, firstNode ?? svg.firstChild);
  }
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
  layout.tree = tree;
  layout.camera = { x: 0, y: 0, width: layout.width, height: layout.height };
  reflowPeople(svg, tree, layout, layout.camera, layout.width, layout.height);
  svg.setAttribute("viewBox", `${layout.x} ${layout.y} ${layout.width} ${layout.height}`);
  svg.setAttribute("preserveAspectRatio", "none");
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
  layout.manualPositions[personId] = { ...position };
  const node = Array.from(svg.querySelectorAll(".person-node"))
    .find((personNode) => personNode.dataset.personId === personId);
  if (!node) return;
  node.setAttribute(
    "transform",
    `translate(${(position.x - layout.camera.x) * layout.scale} ${position.y - layout.camera.y})`
  );
  updateConnectors(svg, tree, layout);
}
