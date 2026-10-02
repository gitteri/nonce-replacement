import { programmaticSignerRequirements, vectorRequirements, type Requirement } from "./requirements";

export interface Solution {
  slug: string;
  name: string;
  requirements: Requirement[];
  scriptCommand: (scriptFile: string) => string;
  testCommand: (testFile: string) => string;
}

const testName = (testFile: string) => testFile.replace(/\.rs$/, "");

export const vector: Solution = {
  slug: "vector",
  name: "Vector",
  requirements: vectorRequirements,
  scriptCommand: (f) => `pnpm --filter @nonce-replacement/vector-ts exec tsx scripts/${f}`,
  testCommand: (f) => `cargo test --package vector-tests --test ${testName(f)}`,
};

export const programmaticSigner: Solution = {
  slug: "programmatic-signer",
  name: "Programmatic Signer",
  requirements: programmaticSignerRequirements,
  scriptCommand: (f) => `cd solutions/programmatic-signer/ts && pnpm exec tsx scripts/${f}`,
  testCommand: (f) => `cd solutions/programmatic-signer/rust && cargo test --test ${testName(f)}`,
};

export function getRequirement(solution: Solution, slug: string): Requirement | undefined {
  return solution.requirements.find((r) => r.slug === slug);
}
