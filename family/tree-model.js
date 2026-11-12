const STORAGE_KEY = "tibbotts-family-tree-v1";

const sampleTree = {
  people: [
    { id: "joseph-tibbotts-1696", name: "Joseph Tibbotts", born: "c. 1696", place: "West Pennard, Somerset", story: "Married Ann around 1717." },
    { id: "ann-joseph-wife", name: "Ann", born: "", place: "", story: "Married Joseph around 1717; died 12 February 1725." },
    { id: "richard-tibbott-1718", name: "Richard Tibbott(s)", born: "c. 1718", place: "West Pennard", story: "The surname appears as both Tibbott and Tibbotts. Married Katherin/Catherine around 1741." },
    { id: "catherine-richard-wife", name: "Katherin / Catherine", born: "c. 1720", place: "Limington", story: "Her first name has variant spellings in the source." },
    { id: "john-tibbotts-1747", name: "John Tibbotts", born: "c. 1747", place: "West Pennard", story: "Married Dianah around 1772." },
    { id: "mary-richard-child", name: "Mary", born: "", place: "", story: "Listed among the children of Richard and Catherine." },
    { id: "ann-richard-child", name: "Ann", born: "", place: "", story: "Listed among the children of Richard and Catherine." },
    { id: "richard-richard-child", name: "Richard", born: "", place: "", story: "Listed among the children of Richard and Catherine." },
    { id: "christian-richard-child", name: "Christian", born: "", place: "", story: "Listed among the children of Richard and Catherine." },
    { id: "esther-richard-child", name: "Esther", born: "", place: "", story: "Listed among the children of Richard and Catherine." },
    { id: "dianah-john-wife", name: "Dianah", born: "", place: "West Pennard", story: "Married John around 1772." },
    { id: "ann-john-child-1", name: "Ann", born: "", place: "", story: "One of the children listed for John and Dianah." },
    { id: "william-john-child", name: "William", born: "", place: "", story: "Listed among the children of John and Dianah." },
    { id: "mary-john-child", name: "Mary", born: "", place: "", story: "Listed among the children of John and Dianah." },
    { id: "elizabeth-john-child", name: "Elizabeth", born: "", place: "", story: "Listed among the children of John and Dianah." },
    { id: "james-tibbotts-1778", name: "James Tibbotts", born: "Baptised 15 Mar 1778", place: "St Nicholas, West Pennard", story: "Married Ann Hacy on 24 April 1802." },
    { id: "george-john-child-1", name: "George", born: "", place: "", story: "One of two children named George in the list of John and Dianah's children." },
    { id: "george-john-child-2", name: "George", born: "", place: "", story: "One of two children named George in the list of John and Dianah's children." },
    { id: "ann-john-child-2", name: "Ann", born: "", place: "", story: "A second child named Ann is listed for John and Dianah." },
    { id: "ann-hacy-james-wife", name: "Ann Hacy", born: "", place: "", story: "Married James on 24 April 1802." },
    { id: "mary-ann-james-child", name: "Mary Ann", born: "", place: "", story: "Listed among the children of James and Ann Hacy." },
    { id: "george-tibbotts-1807", name: "George Tibbotts", born: "Baptised 4 Aug 1807", place: "Somerset", story: "Married Hannah Coombes on 20 February 1844 in Wedmore." },
    { id: "hannah-coombes-george-wife", name: "Hannah Coombes", born: "", place: "Wedmore, Somerset", story: "Married George on 20 February 1844." },
    { id: "john-chislett-child", name: "John Chislett", born: "", place: "", story: "Listed among the children of George and Hannah." },
    { id: "joseph-tibbotts-1846", name: "Joseph Tibbotts", born: "Baptised 16 Feb 1846", place: "", story: "Married Emily Jane Croom in 1884." },
    { id: "mary-ann-george-child", name: "Mary Ann", born: "", place: "", story: "Listed among the children of George and Hannah." },
    { id: "george-george-child", name: "George", born: "", place: "", story: "Listed among the children of George and Hannah." },
    { id: "luke-coombes-tibbotts", name: "Luke Coombes Tibbotts", born: "Baptised 5 Mar 1851", place: "", story: "A son of George and Hannah; part of the UK cousin branch." },
    { id: "emily-jane-croom", name: "Emily Jane Croom", born: "c. 1857", place: "", story: "Married Joseph Tibbotts in 1884." },
    { id: "hubert-herbert-john-tibbotts", name: "Hubert / Herbert John Tibbotts", born: "1887", place: "", story: "Died 2 June 1941. Records vary between Hubert and Herbert. Married Annie Elizabeth Heath in 1916. Typed history lists five children; Wilfred is a handwritten addition, and Bernard/Bernie is also mentioned in notes but needs verification." },
    { id: "edward-hugh-child", name: "Edward Hugh", born: "", place: "", story: "Listed among the children of Joseph and Emily Jane." },
    { id: "edith-mary-child", name: "Edith Mary", born: "", place: "", story: "Listed among the children of Joseph and Emily Jane." },
    { id: "alice-maud-child", name: "Alice Maud", born: "", place: "", story: "Listed among the children of Joseph and Emily Jane." },
    { id: "arthur-george-child", name: "Arthur George", born: "", place: "", story: "Listed among the children of Joseph and Emily Jane." },
    { id: "george-heath", name: "George Heath", born: "", place: "", story: "Named as the father of John Heath." },
    { id: "john-heath", name: "John Heath", born: "c. 1819", place: "Chesterton, Staffordshire", story: "Married Louisa, possibly Louisa Graham, around 1850." },
    { id: "louisa-heath-wife", name: "Louisa / Louisa Graham (?)", born: "", place: "", story: "Name and surname are uncertain in the source." },
    { id: "thomas-heath", name: "Thomas Heath", born: "c. 1852", place: "Burslem", story: "Married Harriet Locker in 1871. The family arrived in New Zealand around June 1910. Thomas died in Christchurch on 18 October 1911." },
    { id: "harriet-locker", name: "Harriet Locker", born: "c. 1852", place: "", story: "Married Thomas Heath in 1871; died in 1895." },
    { id: "louisa-eleanor-heath", name: "Louisa Eleanor Heath", born: "1872", place: "", story: "Listed among the children of Thomas and Harriet." },
    { id: "george-t-heath", name: "George T Heath", born: "1876", place: "", story: "Listed among the children of Thomas and Harriet." },
    { id: "john-mayer-heath", name: "John Mayer Heath", born: "1880", place: "", story: "Listed among the children of Thomas and Harriet." },
    { id: "annie-elizabeth-heath", name: "Annie Elizabeth Heath", born: "1887", place: "", story: "Died 4 October 1943. Daughter of Thomas and Harriet; married Hubert/Herbert John Tibbotts in 1916." },
    { id: "stanley-hubert-tibbotts", name: "Stanley Hubert", born: "c. 1917", place: "", story: "Listed as a child of Hubert/Herbert John and Annie." },
    { id: "reginald-george-tibbotts", name: "Reginald George", born: "23 Dec 1918", place: "", story: "Listed as a child of Hubert/Herbert John and Annie. His spouse and this branch need verification." },
    { id: "leonard-william-tibbotts", name: "Leonard William “Len”", born: "17 Feb 1921", place: "", story: "Listed as a child of Hubert/Herbert John and Annie." },
    { id: "clifford-joseph-tibbotts", name: "Clifford Joseph", born: "15 Oct 1922", place: "", story: "Listed as a child of Hubert/Herbert John and Annie." },
    { id: "ronald-ethelbert-tibbotts", name: "Ronald Ethelbert", born: "7 Oct 1924", place: "", story: "Listed as a child of Hubert/Herbert John and Annie. The Valmai Clara Shinn marriage date conflicts: one source says 1945 and a heading says 1952." },
    { id: "wilfred-murray-tibbotts", name: "Wilfred Murray", born: "8 Aug 1927", place: "", story: "Handwritten addition to the list of Hubert/Herbert John and Annie's children; verify against other records." },
    { id: "bernard-bernie-tibbotts", name: "Bernard / “Bernie” (?)", born: "", place: "", story: "Mentioned in Judy/Len notes. Spelling and relationship to Hubert/Annie need confirmation." },
    { id: "rachael-mcmurtrie", name: "Rachael McMurtrie (?)", born: "", place: "", story: "Possible spouse of Reginald George; name and surname are difficult to read in the source." },
    { id: "simon-reginald-child", name: "Simon (?)", born: "", place: "", story: "Possible child in the uncertain Reginald branch; verify name and relationship." },
    { id: "amanda-reginald-child", name: "Amanda", born: "", place: "", story: "Listed in the uncertain Reginald branch." },
    { id: "melanie-reginald-child", name: "Melanie", born: "", place: "", story: "Listed in the uncertain Reginald branch." },
    { id: "daniel-reginald-child", name: "Daniel", born: "", place: "", story: "Listed in the uncertain Reginald branch." },
    { id: "valmai-clara-shinn", name: "Valmai Clara Shinn", born: "", place: "", story: "Wife of Ronald Ethelbert. The marriage year is disputed in the source." },
    { id: "raymond-john-child", name: "Raymond John (?)", born: "", place: "", story: "Possible child of Ronald and Valmai; name and relationship need verification." },
    { id: "alan-joseph-child", name: "Alan Joseph (?)", born: "", place: "", story: "Possible child of Ronald and Valmai; name and relationship need verification." },
    { id: "george-uk-cousin", name: "George Tibbotts", born: "", place: "Marksbury", story: "Judy's father; farmed at Marksbury with his brother Reginald." },
    { id: "reginald-uk-cousin", name: "Reginald Tibbotts", born: "", place: "", story: "George's brother; described as unmarried." },
    { id: "ann-luke-daughter", name: "Ann Tibbotts", born: "", place: "Cannington", story: "Luke's daughter; married a farmer and had a son, Jonathan." },
    { id: "jonathan-ann-son", name: "Jonathan", born: "", place: "", story: "Son of Ann Tibbotts." },
    { id: "miriam-uk-cousin", name: "Miriam", born: "", place: "Bath", story: "Judy's sister; married and lived in Bath." },
    { id: "audrey-uk-cousin", name: "Audrey", born: "", place: "", story: "Listed as Judy's sister." },
    { id: "judy-uk-cousin", name: "Judy", born: "", place: "", story: "Her letters and family tree provide details about the UK cousin branch." }
  ],
  relationships: [
    { from: "joseph-tibbotts-1696", to: "richard-tibbott-1718", type: "parent" },
    { from: "ann-joseph-wife", to: "richard-tibbott-1718", type: "parent" },
    { from: "richard-tibbott-1718", to: "john-tibbotts-1747", type: "parent" },
    { from: "catherine-richard-wife", to: "john-tibbotts-1747", type: "parent" },
    { from: "richard-tibbott-1718", to: "mary-richard-child", type: "parent" },
    { from: "catherine-richard-wife", to: "mary-richard-child", type: "parent" },
    { from: "richard-tibbott-1718", to: "ann-richard-child", type: "parent" },
    { from: "catherine-richard-wife", to: "ann-richard-child", type: "parent" },
    { from: "richard-tibbott-1718", to: "richard-richard-child", type: "parent" },
    { from: "catherine-richard-wife", to: "richard-richard-child", type: "parent" },
    { from: "richard-tibbott-1718", to: "christian-richard-child", type: "parent" },
    { from: "catherine-richard-wife", to: "christian-richard-child", type: "parent" },
    { from: "richard-tibbott-1718", to: "esther-richard-child", type: "parent" },
    { from: "catherine-richard-wife", to: "esther-richard-child", type: "parent" },
    { from: "john-tibbotts-1747", to: "ann-john-child-1", type: "parent" },
    { from: "dianah-john-wife", to: "ann-john-child-1", type: "parent" },
    { from: "john-tibbotts-1747", to: "william-john-child", type: "parent" },
    { from: "dianah-john-wife", to: "william-john-child", type: "parent" },
    { from: "john-tibbotts-1747", to: "mary-john-child", type: "parent" },
    { from: "dianah-john-wife", to: "mary-john-child", type: "parent" },
    { from: "john-tibbotts-1747", to: "elizabeth-john-child", type: "parent" },
    { from: "dianah-john-wife", to: "elizabeth-john-child", type: "parent" },
    { from: "john-tibbotts-1747", to: "james-tibbotts-1778", type: "parent" },
    { from: "dianah-john-wife", to: "james-tibbotts-1778", type: "parent" },
    { from: "john-tibbotts-1747", to: "george-john-child-1", type: "parent" },
    { from: "dianah-john-wife", to: "george-john-child-1", type: "parent" },
    { from: "john-tibbotts-1747", to: "george-john-child-2", type: "parent" },
    { from: "dianah-john-wife", to: "george-john-child-2", type: "parent" },
    { from: "john-tibbotts-1747", to: "ann-john-child-2", type: "parent" },
    { from: "dianah-john-wife", to: "ann-john-child-2", type: "parent" },
    { from: "james-tibbotts-1778", to: "mary-ann-james-child", type: "parent" },
    { from: "ann-hacy-james-wife", to: "mary-ann-james-child", type: "parent" },
    { from: "james-tibbotts-1778", to: "george-tibbotts-1807", type: "parent" },
    { from: "ann-hacy-james-wife", to: "george-tibbotts-1807", type: "parent" },
    { from: "george-tibbotts-1807", to: "john-chislett-child", type: "parent" },
    { from: "hannah-coombes-george-wife", to: "john-chislett-child", type: "parent" },
    { from: "george-tibbotts-1807", to: "joseph-tibbotts-1846", type: "parent" },
    { from: "hannah-coombes-george-wife", to: "joseph-tibbotts-1846", type: "parent" },
    { from: "george-tibbotts-1807", to: "mary-ann-george-child", type: "parent" },
    { from: "hannah-coombes-george-wife", to: "mary-ann-george-child", type: "parent" },
    { from: "george-tibbotts-1807", to: "george-george-child", type: "parent" },
    { from: "hannah-coombes-george-wife", to: "george-george-child", type: "parent" },
    { from: "george-tibbotts-1807", to: "luke-coombes-tibbotts", type: "parent" },
    { from: "hannah-coombes-george-wife", to: "luke-coombes-tibbotts", type: "parent" },
    { from: "joseph-tibbotts-1846", to: "hubert-herbert-john-tibbotts", type: "parent" },
    { from: "emily-jane-croom", to: "hubert-herbert-john-tibbotts", type: "parent" },
    { from: "joseph-tibbotts-1846", to: "edward-hugh-child", type: "parent" },
    { from: "emily-jane-croom", to: "edward-hugh-child", type: "parent" },
    { from: "joseph-tibbotts-1846", to: "edith-mary-child", type: "parent" },
    { from: "emily-jane-croom", to: "edith-mary-child", type: "parent" },
    { from: "joseph-tibbotts-1846", to: "alice-maud-child", type: "parent" },
    { from: "emily-jane-croom", to: "alice-maud-child", type: "parent" },
    { from: "joseph-tibbotts-1846", to: "arthur-george-child", type: "parent" },
    { from: "emily-jane-croom", to: "arthur-george-child", type: "parent" },
    { from: "george-heath", to: "john-heath", type: "parent" },
    { from: "john-heath", to: "thomas-heath", type: "parent" },
    { from: "louisa-heath-wife", to: "thomas-heath", type: "parent" },
    { from: "thomas-heath", to: "louisa-eleanor-heath", type: "parent" },
    { from: "harriet-locker", to: "louisa-eleanor-heath", type: "parent" },
    { from: "thomas-heath", to: "george-t-heath", type: "parent" },
    { from: "harriet-locker", to: "george-t-heath", type: "parent" },
    { from: "thomas-heath", to: "john-mayer-heath", type: "parent" },
    { from: "harriet-locker", to: "john-mayer-heath", type: "parent" },
    { from: "thomas-heath", to: "annie-elizabeth-heath", type: "parent" },
    { from: "harriet-locker", to: "annie-elizabeth-heath", type: "parent" },
    { from: "joseph-tibbotts-1696", to: "ann-joseph-wife", type: "partner" },
    { from: "richard-tibbott-1718", to: "catherine-richard-wife", type: "partner" },
    { from: "john-tibbotts-1747", to: "dianah-john-wife", type: "partner" },
    { from: "james-tibbotts-1778", to: "ann-hacy-james-wife", type: "partner" },
    { from: "george-tibbotts-1807", to: "hannah-coombes-george-wife", type: "partner" },
    { from: "joseph-tibbotts-1846", to: "emily-jane-croom", type: "partner" },
    { from: "john-heath", to: "louisa-heath-wife", type: "partner", uncertain: true },
    { from: "thomas-heath", to: "harriet-locker", type: "partner" },
    { from: "hubert-herbert-john-tibbotts", to: "annie-elizabeth-heath", type: "partner" },
    { from: "hubert-herbert-john-tibbotts", to: "stanley-hubert-tibbotts", type: "parent" },
    { from: "annie-elizabeth-heath", to: "stanley-hubert-tibbotts", type: "parent" },
    { from: "hubert-herbert-john-tibbotts", to: "reginald-george-tibbotts", type: "parent" },
    { from: "annie-elizabeth-heath", to: "reginald-george-tibbotts", type: "parent" },
    { from: "hubert-herbert-john-tibbotts", to: "leonard-william-tibbotts", type: "parent" },
    { from: "annie-elizabeth-heath", to: "leonard-william-tibbotts", type: "parent" },
    { from: "hubert-herbert-john-tibbotts", to: "clifford-joseph-tibbotts", type: "parent" },
    { from: "annie-elizabeth-heath", to: "clifford-joseph-tibbotts", type: "parent" },
    { from: "hubert-herbert-john-tibbotts", to: "ronald-ethelbert-tibbotts", type: "parent" },
    { from: "annie-elizabeth-heath", to: "ronald-ethelbert-tibbotts", type: "parent" },
    { from: "hubert-herbert-john-tibbotts", to: "wilfred-murray-tibbotts", type: "parent", uncertain: true },
    { from: "annie-elizabeth-heath", to: "wilfred-murray-tibbotts", type: "parent", uncertain: true },
    { from: "hubert-herbert-john-tibbotts", to: "bernard-bernie-tibbotts", type: "parent", uncertain: true },
    { from: "annie-elizabeth-heath", to: "bernard-bernie-tibbotts", type: "parent", uncertain: true },
    { from: "reginald-george-tibbotts", to: "rachael-mcmurtrie", type: "partner", uncertain: true },
    { from: "reginald-george-tibbotts", to: "simon-reginald-child", type: "parent", uncertain: true },
    { from: "rachael-mcmurtrie", to: "simon-reginald-child", type: "parent", uncertain: true },
    { from: "reginald-george-tibbotts", to: "amanda-reginald-child", type: "parent", uncertain: true },
    { from: "rachael-mcmurtrie", to: "amanda-reginald-child", type: "parent", uncertain: true },
    { from: "reginald-george-tibbotts", to: "melanie-reginald-child", type: "parent", uncertain: true },
    { from: "rachael-mcmurtrie", to: "melanie-reginald-child", type: "parent", uncertain: true },
    { from: "reginald-george-tibbotts", to: "daniel-reginald-child", type: "parent", uncertain: true },
    { from: "rachael-mcmurtrie", to: "daniel-reginald-child", type: "parent", uncertain: true },
    { from: "ronald-ethelbert-tibbotts", to: "valmai-clara-shinn", type: "partner" },
    { from: "ronald-ethelbert-tibbotts", to: "raymond-john-child", type: "parent", uncertain: true },
    { from: "valmai-clara-shinn", to: "raymond-john-child", type: "parent", uncertain: true },
    { from: "ronald-ethelbert-tibbotts", to: "alan-joseph-child", type: "parent", uncertain: true },
    { from: "valmai-clara-shinn", to: "alan-joseph-child", type: "parent", uncertain: true },
    { from: "luke-coombes-tibbotts", to: "george-uk-cousin", type: "parent" },
    { from: "luke-coombes-tibbotts", to: "reginald-uk-cousin", type: "parent" },
    { from: "luke-coombes-tibbotts", to: "ann-luke-daughter", type: "parent" },
    { from: "ann-luke-daughter", to: "jonathan-ann-son", type: "parent" },
    { from: "george-uk-cousin", to: "miriam-uk-cousin", type: "parent" },
    { from: "george-uk-cousin", to: "audrey-uk-cousin", type: "parent" },
    { from: "george-uk-cousin", to: "judy-uk-cousin", type: "parent" }
  ]
};

export function loadTree() {
  const tree = structuredClone(sampleTree);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
    return { tree, warning: "" };
  } catch (error) {
    console.error("Could not reset the saved family tree to the source seed:", error);
    return {
      tree,
      warning: "The source family tree is loaded, but could not be saved in this browser."
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
    if (person) connections.push({
      person,
      label: relationship.uncertain ? `Possibly ${label.toLowerCase()}` : label
    });
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
