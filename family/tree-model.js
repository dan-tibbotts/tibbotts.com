const STORAGE_KEY = "tibbotts-family-tree-v1";

const sampleTree = {
  people: [
    { id: "margaret", name: "Margaret Tibbott", born: "1928", place: "Yorkshire", story: "Loved tending her garden and gathering everyone around the table for Sunday lunch." },
    { id: "arthur", name: "Arthur Tibbott", born: "1925", place: "Leeds", story: "A quiet storyteller with a lifelong love of fixing old radios." },
    { id: "elsie", name: "Elsie Harper", born: "1931", place: "Whitby", story: "Known for her seaside walks and excellent homemade jam." },
    { id: "robert", name: "Robert Harper", born: "1929", place: "Whitby", story: "A patient fisherman who knew every cove along the coast." },
    { id: "peter", name: "Peter Tibbott", born: "1952", place: "Yorkshire", story: "Grew up helping in the garden and still keeps a few family recipes." },
    { id: "susan", name: "Susan Harper", born: "1955", place: "Whitby", story: "Keeps family photographs and stories safe for the next generation." },
    { id: "james", name: "James Tibbott", born: "1979", place: "Yorkshire", story: "Always curious about the people and places that came before him." },
    { id: "claire", name: "Claire Tibbott", born: "1982", place: "Yorkshire", story: "Enjoys bringing the family together and making new memories." },
    { id: "emma", name: "Emma Morgan", born: "1980", place: "England", story: "Brings a love of books and family traditions to every gathering." },
    { id: "daniel", name: "Daniel Tibbott", born: "2004", place: "England", story: "The keeper of this little, growing family tree." }
  ],
  relationships: [
    { from: "arthur", to: "peter", type: "parent" },
    { from: "margaret", to: "peter", type: "parent" },
    { from: "elsie", to: "susan", type: "parent" },
    { from: "robert", to: "susan", type: "parent" },
    { from: "peter", to: "james", type: "parent" },
    { from: "susan", to: "james", type: "parent" },
    { from: "peter", to: "claire", type: "parent" },
    { from: "susan", to: "claire", type: "parent" },
    { from: "james", to: "daniel", type: "parent" },
    { from: "emma", to: "daniel", type: "parent" },
    { from: "arthur", to: "margaret", type: "partner" },
    { from: "elsie", to: "robert", type: "partner" },
    { from: "peter", to: "susan", type: "partner" },
    { from: "james", to: "emma", type: "partner" }
  ]
};

function isValidTree(value) {
  if (!value ||
      !Array.isArray(value.people) ||
      !Array.isArray(value.relationships) ||
      !value.people.every((person) =>
      person &&
      typeof person.id === "string" &&
      typeof person.name === "string" &&
      ["born", "place", "story"].every((key) => typeof person[key] === "string") &&
      (person.photo === undefined ||
        (typeof person.photo === "string" &&
          person.photo.length <= 200_000 &&
          (person.photo === "" || /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(person.photo))))
      )) {
    return false;
  }

  const peopleIds = new Set(value.people.map((person) => person.id));
  if (peopleIds.size !== value.people.length) return false;

  const validRelationships = value.relationships.every((relationship) =>
      relationship &&
      typeof relationship.from === "string" &&
      typeof relationship.to === "string" &&
      relationship.from !== relationship.to &&
      peopleIds.has(relationship.from) &&
      peopleIds.has(relationship.to) &&
      ["parent", "partner"].includes(relationship.type) &&
      (relationship.type !== "parent" ||
        !hasParentPath(value, relationship.to, relationship.from))
    );
  if (!validRelationships) return false;

  if (value.positions === undefined) return true;
  return value.positions &&
    typeof value.positions === "object" &&
    !Array.isArray(value.positions) &&
    ["standard", "circle"].every((view) =>
      value.positions[view] === undefined ||
      (value.positions[view] &&
        typeof value.positions[view] === "object" &&
        !Array.isArray(value.positions[view]) &&
        Object.entries(value.positions[view]).every(([personId, position]) =>
          position &&
          peopleIds.has(personId) &&
          Number.isFinite(position.x) &&
          Number.isFinite(position.y)
        ))
    );
}

export function loadTree() {
  try {
    const storedTree = localStorage.getItem(STORAGE_KEY);
    if (storedTree === null) {
      return { tree: structuredClone(sampleTree), warning: "" };
    }

    const parsedTree = JSON.parse(storedTree);
    if (!isValidTree(parsedTree)) {
      return {
        tree: structuredClone(sampleTree),
        warning: "Saved tree data was invalid, so the sample tree was restored."
      };
    }

    return { tree: parsedTree, warning: "" };
  } catch (error) {
    console.error("Could not load the saved family tree:", error);
    return {
      tree: structuredClone(sampleTree),
      warning: "Saved data could not be loaded. Changes may not be saved in this browser."
    };
  }
}

export function saveTree(tree) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
}

export function addPerson(tree, person) {
  const cleanName = person.name.trim();
  if (!cleanName) {
    throw new Error("Please enter a name.");
  }

  const newPerson = {
    id: crypto.randomUUID(),
    name: cleanName,
    born: person.born.trim(),
    place: person.place.trim(),
    story: person.story.trim(),
    photo: person.photo ?? ""
  };

  return {
    ...tree,
    people: [...tree.people, newPerson]
  };
}

export function updatePerson(tree, personId, changes) {
  const cleanName = changes.name.trim();
  if (!cleanName) {
    throw new Error("Please enter a name.");
  }
  if (!tree.people.some((person) => person.id === personId)) {
    throw new Error("This person is no longer in the tree.");
  }

  return {
    ...tree,
    people: tree.people.map((person) => person.id === personId
      ? {
          ...person,
          name: cleanName,
          born: changes.born.trim(),
          place: changes.place.trim(),
          story: changes.story.trim(),
          photo: changes.photo ?? person.photo ?? ""
        }
      : person)
  };
}

export function deletePerson(tree, personId) {
  const positions = tree.positions
    ? Object.fromEntries(Object.entries(tree.positions).map(([view, viewPositions]) => [
        view,
        Object.fromEntries(Object.entries(viewPositions).filter(([id]) => id !== personId))
      ]))
    : undefined;
  return {
    ...tree,
    people: tree.people.filter((person) => person.id !== personId),
    relationships: tree.relationships.filter((relationship) =>
      relationship.from !== personId && relationship.to !== personId
    ),
    ...(positions ? { positions } : {})
  };
}

export function movePerson(tree, personId, view, position) {
  if (!["standard", "circle"].includes(view) ||
      !tree.people.some((person) => person.id === personId) ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)) {
    throw new Error("Could not save this person's position.");
  }

  return {
    ...tree,
    positions: {
      ...tree.positions,
      [view]: {
        ...tree.positions?.[view],
        [personId]: { x: position.x, y: position.y }
      }
    }
  };
}

export function getPersonConnections(tree, personId) {
  const peopleById = new Map(tree.people.map((person) => [person.id, person]));
  const connections = [];
  for (const relationship of tree.relationships) {
    let relativeId;
    let label;
    if (relationship.type === "partner" &&
        (relationship.from === personId || relationship.to === personId)) {
      relativeId = relationship.from === personId ? relationship.to : relationship.from;
      label = "Partner";
    } else if (relationship.type === "parent" && relationship.from === personId) {
      relativeId = relationship.to;
      label = "Child";
    } else if (relationship.type === "parent" && relationship.to === personId) {
      relativeId = relationship.from;
      label = "Parent";
    } else {
      continue;
    }

    const person = peopleById.get(relativeId);
    if (person) connections.push({ person, label });
  }
  return connections;
}

function hasParentPath(tree, startId, targetId) {
  const pending = [startId];
  const visited = new Set();

  while (pending.length > 0) {
    const currentId = pending.pop();
    if (currentId === targetId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    for (const relationship of tree.relationships) {
      if (relationship.type === "parent" && relationship.from === currentId) {
        pending.push(relationship.to);
      }
    }
  }

  return false;
}

export function addRelationship(tree, firstId, secondId, type) {
  if (firstId === secondId) {
    throw new Error("Choose two different people for a connection.");
  }
  if (!tree.people.some((person) => person.id === firstId) ||
      !tree.people.some((person) => person.id === secondId)) {
    throw new Error("Choose two people from your tree.");
  }
  if (!["parent", "child", "partner"].includes(type)) {
    throw new Error("Choose a valid relationship.");
  }

  let relationship;
  if (type === "child") {
    relationship = { from: secondId, to: firstId, type: "parent" };
  } else if (type === "partner") {
    const alreadyConnected = tree.relationships.some((item) =>
      item.type === "partner" &&
      ((item.from === firstId && item.to === secondId) ||
        (item.from === secondId && item.to === firstId))
    );
    if (alreadyConnected) throw new Error("These people are already connected as partners.");
    relationship = { from: firstId, to: secondId, type: "partner" };
  } else {
    relationship = { from: firstId, to: secondId, type: "parent" };
  }

  if (relationship.type === "parent") {
    const alreadyConnected = tree.relationships.some((item) =>
      item.type === "parent" &&
      item.from === relationship.from &&
      item.to === relationship.to
    );
    if (alreadyConnected) throw new Error("That parent and child connection already exists.");
    if (hasParentPath(tree, relationship.to, relationship.from)) {
      throw new Error("That connection would create a family-tree cycle.");
    }
  }

  return {
    ...tree,
    relationships: [...tree.relationships, relationship]
  };
}
