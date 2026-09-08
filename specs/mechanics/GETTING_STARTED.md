Product invoke (this version, once the binary exists):

```
retention help
retention trees
retention queue "Biology II — seed tree"
retention show 1 "Biology II — seed tree"
retention grade 1 Good "Biology II — seed tree"    # asks before writing
```

Omit the title in an interactive terminal and the program lists titles and asks.

Developer stand-in until compile is wired — same arguments, still no environment variables:

```
bun src/cli/main.ts help
```

`grade` is the only impure command. It will ask. Say no → nothing is created.
