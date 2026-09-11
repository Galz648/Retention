declare module "node:fs" {
  export function readSync(fd: number, buffer: Uint8Array): number
  export function fstatSync(fd: number): { readonly mode: number }
}

declare module "node:tty" {
  export function isatty(fd: number): boolean
}
