export const aiSlopTerms = [
  "bounded",
  "seem",
  "honestly the truth",
  "absolutely you're right",
  "delve",
  "tapestry",
  "pivotal",
  "robust",
  "seamless",
  "leverage",
  "nuanced",
  "multifaceted",
  "crucial",
  "landscape",
  "underscores",
  "it's worth noting",
  "in conclusion",
  "at its core",
  "game changer",
  "unlock",
  "elevate",
  "navigate",
  "foster",
  "meticulous",
  "comprehensive",
  "holistic",
  "not only but also",
  "let's dive in",
  "great question",
  "certainly",
  "as an AI",
] as const;

export function aiSlopTerm(seed: string) {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return aiSlopTerms[hash % aiSlopTerms.length];
}
