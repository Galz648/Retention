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

export class Corpus extends Schema.Class<Corpus>("Corpus")({
  treeId: TreeId,
  archived: Schema.Boolean,
  nodes: Schema.Array(Node),
  edges: Schema.Array(Edge),
  cards: Schema.Array(Card),
}) {}
