// Renders docs/knowledge-graph.json into docs/knowledge-graph.md (Mermaid diagram + entity tables).
// Run with `npm run kg` after editing the JSON; the JSON is the source of truth.
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../docs/", import.meta.url);
const graph = JSON.parse(readFileSync(new URL("knowledge-graph.json", root), "utf8"));

const id = (name) => name.replace(/[^A-Za-z0-9]/g, "_");
const shape = {
  contract: (n) => `${id(n)}["${n}"]`,
  service: (n) => `${id(n)}(["${n}"])`,
  external: (n) => `${id(n)}[/"${n}"/]`,
  account: (n) => `${id(n)}{{"${n}"}}`,
  decision: (n) => `${id(n)}>"${n}"]`,
  project: (n) => `${id(n)}(("${n}"))`,
  evidence: (n) => `${id(n)}[("${n}")]`,
};

const lines = [
  "# Knowledge graph",
  "",
  `Generated from \`knowledge-graph.json\` by \`npm run kg\` (last updated ${graph.updated}). Edit the JSON, not this file.`,
  "",
  "```mermaid",
  "flowchart LR",
  ...graph.entities.map((e) => `  ${(shape[e.entityType] ?? shape.contract)(e.name)}`),
  ...graph.relations.map((r) => `  ${id(r.from)} -->|${r.relationType}| ${id(r.to)}`),
  "```",
  "",
];

const types = [...new Set(graph.entities.map((e) => e.entityType))];
for (const type of types) {
  lines.push(`## ${type[0].toUpperCase()}${type.slice(1)}s`, "");
  for (const entity of graph.entities.filter((e) => e.entityType === type)) {
    lines.push(`### ${entity.name}`, "", ...entity.observations.map((o) => `- ${o}`), "");
  }
}

writeFileSync(new URL("knowledge-graph.md", root), `${lines.join("\n").trimEnd()}\n`);
console.log(`knowledge-graph.md: ${graph.entities.length} entities, ${graph.relations.length} relations`);
