/**
 * Read-only import from the Obsidian vault into corpus/<treeId>/.
 * Never writes to the vault. Re-run: `bun scripts/import-from-vault.ts`
 */
const VAULT = "/Users/galzafar/Documents/Obsidian-Vault"
const TREES = `${VAULT}/knowledge-trees`
const DECKS = `${VAULT}/term-decks`
const OUT = `${import.meta.dir}/../corpus`

const slug = (raw: string): string => {
  const trimmed = raw.trim().replace(/`/g, "")
  const ascii = trimmed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
  if (ascii.length > 0) return ascii.slice(0, 96)
  let hash = 0
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) | 0
  }
  return `n-${(hash >>> 0).toString(16)}`
}

type Concept = {
  readonly id: string
  readonly title: string
  readonly prereqs: ReadonlyArray<string>
  readonly source: string
  readonly abstraction: string
}

type Tree = {
  readonly treeId: string
  readonly title: string
  readonly nodes: Array<{
    id: string
    title: string
    cardIds: Array<string>
  }>
  readonly edges: Array<{ from: string; to: string }>
  readonly cards: Array<Record<string, unknown>>
}

const parseConcepts = (markdown: string): Array<Concept> => {
  const chunks = markdown.split(/^## /m).slice(1)
  const out: Array<Concept> = []
  for (const chunk of chunks) {
    const newline = chunk.indexOf("\n")
    const title = (newline < 0 ? chunk : chunk.slice(0, newline)).trim()
    const body = newline < 0 ? "" : chunk.slice(newline + 1)
    const idMatch = body.match(/^- id:\s*([^\s]+)/m)
    if (idMatch === null || idMatch[1] === undefined) continue
    const prereqMatch = body.match(/^- prereqs:\s*\[([^\]]*)\]/m)
    const sourceMatch = body.match(/^- source:\s*(.+)$/m)
    const absMatch = body.match(/^- target-abstraction:\s*(\S+)/m)
    const prereqs = (prereqMatch?.[1] ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    out.push({
      id: idMatch[1],
      title,
      prereqs,
      source: sourceMatch?.[1]?.trim() ?? "",
      abstraction: absMatch?.[1] ?? "mechanistic",
    })
  }
  return out
}

const parseFrontmatter = (
  text: string,
): { readonly meta: Record<string, string>; readonly body: string } => {
  if (!text.startsWith("---")) return { meta: {}, body: text }
  const end = text.indexOf("\n---", 3)
  if (end < 0) return { meta: {}, body: text }
  const block = text.slice(4, end)
  const meta: Record<string, string> = {}
  for (const line of block.split("\n")) {
    const cut = line.indexOf(":")
    if (cut < 0) continue
    meta[line.slice(0, cut).trim()] = line.slice(cut + 1).trim()
  }
  return { meta, body: text.slice(end + 4) }
}

const headingTitle = (markdown: string, fallback: string): string => {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match?.[1]?.trim() ?? fallback
}

const writeTree = async (tree: Tree): Promise<void> => {
  const dir = `${OUT}/${tree.treeId}`
  await Bun.write(
    `${dir}/meta.json`,
    `${JSON.stringify({ title: tree.title, archived: false }, null, 2)}\n`,
  )
  await Bun.write(
    `${dir}/nodes.jsonl`,
    `${tree.nodes.map((row) => JSON.stringify(row)).join("\n")}\n`,
  )
  await Bun.write(
    `${dir}/edges.jsonl`,
    tree.edges.length === 0
      ? ""
      : `${tree.edges.map((row) => JSON.stringify(row)).join("\n")}\n`,
  )
  await Bun.write(
    `${dir}/cards.jsonl`,
    `${tree.cards.map((row) => JSON.stringify(row)).join("\n")}\n`,
  )
}

const knowledgeTree = async (slugName: string): Promise<Tree | undefined> => {
  const seedPath = `${TREES}/${slugName}/seed.md`
  const seedFile = Bun.file(seedPath)
  if (!(await seedFile.exists())) return undefined
  const text = await seedFile.text()
  const concepts = parseConcepts(text)
  if (concepts.length === 0) return undefined

  const byId = new Map(concepts.map((concept) => [concept.id, concept]))

  const eventsDir = `${TREES}/${slugName}/events`
  const eventsGlob = new Bun.Glob("*.md")
  try {
    for await (const relative of eventsGlob.scan(eventsDir)) {
      if (relative === "README.md") continue
      const eventText = await Bun.file(`${eventsDir}/${relative}`).text()
      const { meta } = parseFrontmatter(eventText)
      if (meta["type"] !== "structure-change") continue
      if (meta["status"] !== "accepted") continue
      if (meta["action"] !== "add-node") continue
      const id = meta["concept"]
      if (id === undefined || byId.has(id)) continue
      const prereqMatch = eventText.match(/prereqs:\s*\[([^\]]*)\]/)
      const prereqs = (prereqMatch?.[1] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
      byId.set(id, {
        id,
        title: id.replace(/-/g, " "),
        prereqs,
        source: relative,
        abstraction: "mechanistic",
      })
      const extra = eventText.match(
        /add edge:\s*`?([a-z0-9-]+)`?\s*→\s*`?([a-z0-9-]+)`?/i,
      )
      if (extra?.[1] !== undefined && extra[2] !== undefined) {
        const from = extra[1]
        const to = extra[2]
        const target = byId.get(to)
        if (target !== undefined && !target.prereqs.includes(from)) {
          byId.set(to, { ...target, prereqs: [...target.prereqs, from] })
        }
      }
    }
  } catch {
    // no events directory
  }

  const nodes: Tree["nodes"] = []
  const edges: Tree["edges"] = []
  const cards: Tree["cards"] = []
  for (const concept of byId.values()) {
    const cardId =
      concept.abstraction === "intuitive"
        ? `rec-${concept.id}`
        : `der-${concept.id}`
    nodes.push({
      id: concept.id,
      title: concept.title,
      cardIds: [cardId],
    })
    for (const from of concept.prereqs) {
      if (byId.has(from)) {
        edges.push({ from, to: concept.id })
      }
    }
    if (concept.abstraction === "intuitive") {
      cards.push({
        _tag: "recall",
        id: cardId,
        nodeId: concept.id,
        prompt: `What is ${concept.title}?`,
        answer: concept.source.length > 0 ? concept.source : concept.title,
        tags: [slugName],
      })
    } else {
      cards.push({
        _tag: "derivation",
        id: cardId,
        nodeId: concept.id,
        prompt: `Explain ${concept.title} from scratch.`,
        tags: [slugName],
        mustHits:
          concept.source.length > 0 ? [concept.source.slice(0, 160)] : [],
      })
    }
  }

  return {
    treeId: slugName,
    title: headingTitle(text, slugName),
    nodes,
    edges,
    cards,
  }
}

type Table = {
  readonly headers: ReadonlyArray<string>
  readonly rows: ReadonlyArray<ReadonlyArray<string>>
}

const parseTables = (markdown: string): Array<Table> => {
  const lines = markdown.split("\n")
  const tables: Array<Table> = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line === undefined || !line.startsWith("|")) {
      i += 1
      continue
    }
    const header = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim())
    const next = lines[i + 1]
    if (next === undefined || !/^\|[-:\s|]+$/.test(next)) {
      i += 1
      continue
    }
    i += 2
    const rows: Array<Array<string>> = []
    while (i < lines.length) {
      const rowLine = lines[i]
      if (rowLine === undefined || !rowLine.startsWith("|")) break
      rows.push(
        rowLine
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
      )
      i += 1
    }
    tables.push({ headers: header, rows })
  }
  return tables
}

const col = (
  headers: ReadonlyArray<string>,
  row: ReadonlyArray<string>,
  name: string,
): string | undefined => {
  const index = headers.findIndex(
    (header) => header.toLowerCase() === name.toLowerCase(),
  )
  if (index < 0) return undefined
  return row[index]
}

const splitNeeds = (raw: string | undefined): Array<string> => {
  if (raw === undefined || raw === "—" || raw === "-" || raw.length === 0) {
    return []
  }
  return raw
    .split(/[·,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== "—")
}

const termDeck = async (fileName: string): Promise<Tree | undefined> => {
  const text = await Bun.file(`${DECKS}/${fileName}`).text()
  const deck = `terms-${fileName.replace(/\.state\.md$/, "")}`
  const tables = parseTables(text)
  type Entry = {
    id: string
    title: string
    prompt: string
    answer: string
    needs: Array<string>
  }
  const entries: Array<Entry> = []
  const titleToId = new Map<string, string>()

  const remember = (title: string, id: string) => {
    titleToId.set(title, id)
    titleToId.set(title.replace(/\s+/g, " "), id)
  }

  for (const table of tables) {
    const headers = table.headers
    const has = (name: string) =>
      headers.some((header) => header.toLowerCase() === name.toLowerCase())

    if (has("Term (he)") && has("English")) {
      for (const row of table.rows) {
        const he = col(headers, row, "Term (he)")
        const en = col(headers, row, "English")
        if (en === undefined || en.length === 0) continue
        const id = slug(en)
        remember(he ?? en, id)
        remember(en, id)
        entries.push({
          id,
          title: en,
          prompt: `What does ${en} mean / do?`,
          answer: he !== undefined && he.length > 0 ? `${en} — ${he}` : en,
          needs: splitNeeds(col(headers, row, "Needs")),
        })
      }
      continue
    }

    if (has("English") && has("Term (he)")) {
      for (const row of table.rows) {
        const he = col(headers, row, "Term (he)")
        const en = col(headers, row, "English")
        if (en === undefined || en.length === 0) continue
        const id = slug(en)
        remember(he ?? en, id)
        remember(en, id)
        entries.push({
          id,
          title: en,
          prompt: `What does ${en} mean / do?`,
          answer: he !== undefined && he.length > 0 ? `${en} — ${he}` : en,
          needs: splitNeeds(col(headers, row, "Needs")),
        })
      }
      continue
    }

    if (has("German") && has("English")) {
      for (const row of table.rows) {
        const de = col(headers, row, "German")
        const en = col(headers, row, "English")
        if (de === undefined || de.length === 0) continue
        const id = slug(de)
        remember(de, id)
        entries.push({
          id,
          title: de,
          prompt: `What does "${de}" mean?`,
          answer: en ?? de,
          needs: splitNeeds(col(headers, row, "Needs")),
        })
      }
      continue
    }

    if (has("Anchor") && has("Value")) {
      for (const row of table.rows) {
        const anchor = col(headers, row, "Anchor")
        const value = col(headers, row, "Value")
        if (anchor === undefined || anchor.length === 0) continue
        const picture =
          col(headers, row, "Picture") ??
          col(headers, row, "Picture / note") ??
          ""
        const id = slug(anchor)
        remember(anchor, id)
        entries.push({
          id,
          title: anchor,
          prompt: `Give the value of ${anchor} (one significant figure) and its picture.`,
          answer: picture.length > 0 ? `${value} — ${picture}` : (value ?? ""),
          needs: [],
        })
      }
      continue
    }

    if (has("Pattern")) {
      for (const row of table.rows) {
        const pattern = col(headers, row, "Pattern")
        if (pattern === undefined || pattern.length === 0) continue
        const id = slug(pattern)
        remember(pattern, id)
        entries.push({
          id,
          title: pattern,
          prompt: `Produce a new sentence that uses: ${pattern}`,
          answer: pattern,
          needs: splitNeeds(col(headers, row, "Needs")),
        })
      }
      continue
    }

    if (has("Problem") && has("Correct answer")) {
      for (const row of table.rows) {
        const problem = col(headers, row, "Problem")
        const answer = col(headers, row, "Correct answer")
        if (problem === undefined || problem.length === 0) continue
        const id = slug(problem)
        remember(problem, id)
        entries.push({
          id,
          title: problem,
          prompt: problem,
          answer: answer ?? "",
          needs: [],
        })
      }
    }
  }

  if (entries.length === 0) return undefined

  const idSet = new Set(entries.map((entry) => entry.id))
  const nodes: Tree["nodes"] = []
  const edges: Tree["edges"] = []
  const cards: Tree["cards"] = []
  for (const entry of entries) {
    const cardId = `rec-${deck}-${entry.id}`
    nodes.push({
      id: entry.id,
      title: entry.title,
      cardIds: [cardId],
    })
    for (const need of entry.needs) {
      const from = titleToId.get(need) ?? slug(need)
      if (idSet.has(from) && from !== entry.id) {
        edges.push({ from, to: entry.id })
      }
    }
    cards.push({
      _tag: "recall",
      id: cardId,
      nodeId: entry.id,
      prompt: entry.prompt,
      answer: entry.answer,
      tags: [deck],
    })
  }

  return {
    treeId: deck,
    title: headingTitle(text, deck),
    nodes,
    edges,
    cards,
  }
}

const main = async () => {
  const written: Array<string> = []

  const seeds = new Bun.Glob("*/seed.md")
  for await (const relative of seeds.scan(TREES)) {
    const name = relative.split("/")[0]
    if (name === undefined || name === "pilots") continue
    const tree = await knowledgeTree(name)
    if (tree === undefined) continue
    await writeTree(tree)
    written.push(
      `${tree.treeId}\tknowledge\t${tree.nodes.length} nodes\t${tree.edges.length} edges\t${tree.cards.length} cards`,
    )
  }

  const decks = new Bun.Glob("*.state.md")
  for await (const file of decks.scan(DECKS)) {
    const tree = await termDeck(file)
    if (tree === undefined) continue
    await writeTree(tree)
    written.push(
      `${tree.treeId}\tterms\t${tree.nodes.length} nodes\t${tree.edges.length} edges\t${tree.cards.length} cards`,
    )
  }

  for (const line of written.sort()) {
    console.log(line)
  }
}

await main()
