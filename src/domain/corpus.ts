import { Schema } from "effect"
import { Card } from "./cards.ts"
import { CardId, NodeId, TreeId } from "./ids.ts"

export class Node extends Schema.Class<Node>("Node")({
  id: NodeId,
  title: Schema.String,
  cardIds: Schema.Array(CardId),
}) {}

/** `from` is a prerequisite of `to`. */
export class Edge extends Schema.Class<Edge>("Edge")({
  from: NodeId,
  to: NodeId,
}) {}

export const TreeKind = Schema.Literal("knowledge", "terms")
export type TreeKind = typeof TreeKind.Type

export class Corpus extends Schema.Class<Corpus>("Corpus")({
  treeId: TreeId,
  title: Schema.String,
  kind: TreeKind,
  summary: Schema.String,
  archived: Schema.Boolean,
  nodes: Schema.Array(Node),
  edges: Schema.Array(Edge),
  cards: Schema.Array(Card),
}) {}

export type TreeListing = {
  readonly treeId: TreeId
  readonly title: string
  readonly kind: TreeKind
  readonly summary: string
  readonly archived: boolean
  readonly nodeCount: number
  readonly cardCount: number
  readonly edgeCount: number
}
