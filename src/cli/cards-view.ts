import type { Card } from "../domain/cards.ts"
import type { Corpus } from "../domain/corpus.ts"
import type { NodeId } from "../domain/ids.ts"

export const nodeTitle = (corpus: Corpus, id: NodeId): string => {
  const node = corpus.nodes.find((item) => item.id === id)
  return node === undefined ? "unknown node" : node.title
}

export const formatQueueLine = (
  index: number,
  card: Card,
  corpus: Corpus,
): string =>
  `${index}. [${card._tag}] ${nodeTitle(corpus, card.nodeId)}\n${card.prompt}`

export const formatShow = (card: Card, corpus: Corpus): string => {
  const head = `[${card._tag}] ${nodeTitle(corpus, card.nodeId)}\n${card.prompt}`
  if (card._tag === "recall") {
    return `${head}\n${card.answer}`
  }
  return `${head}\nmust-hits: ${card.mustHits.join("; ")}`
}
