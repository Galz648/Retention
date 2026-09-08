import { Schema } from "effect"

export const CardId = Schema.String.pipe(Schema.brand("CardId"))
export type CardId = typeof CardId.Type

export const NodeId = Schema.String.pipe(Schema.brand("NodeId"))
export type NodeId = typeof NodeId.Type

export const TreeId = Schema.String.pipe(Schema.brand("TreeId"))
export type TreeId = typeof TreeId.Type
