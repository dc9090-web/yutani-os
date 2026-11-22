export type BlockState = "filled" | "empty" | "queued" | "training";

/**
 * A strip of 10px squares (redesign hand-off, DESIGN_SYSTEM.md "Level blocks"): five for a skill
 * level or a mastery, ten for implant slots. The strip is one image to assistive tech, so `label`
 * says what the colours show ("Level 4 of 5").
 */
export function LevelBlocks({ states, label }: { states: readonly BlockState[]; label: string }) {
  return (
    <span className="yo-blocks" role="img" aria-label={label}>
      {states.map((state, index) => (
        <span key={index} className={`yo-block${state === "empty" ? "" : ` is-${state}`}`} />
      ))}
    </span>
  );
}

/** `filled` of `total` blocks solid, the rest outlined — mastery levels and implant slots in use. */
export function filledBlocks(filled: number, total = 5): BlockState[] {
  return Array.from({ length: total }, (_, index) => (index < filled ? "filled" : "empty"));
}

/**
 * A skill on the sheet: trained levels solid; then `queued` further levels outlined in amber, the
 * first of them tinted and pulsing when it is the level in training right now.
 */
export function skillBlocks(trained: number, queued = 0, training = false): BlockState[] {
  return Array.from({ length: 5 }, (_, index): BlockState => {
    if (index < trained) return "filled";
    if (index < trained + queued) return training && index === trained ? "training" : "queued";
    return "empty";
  });
}

/** A training-queue entry: every level below the target solid, the target itself amber. */
export function queueBlocks(target: number, training: boolean): BlockState[] {
  return Array.from({ length: 5 }, (_, index): BlockState => {
    if (index < target - 1) return "filled";
    if (index === target - 1) return training ? "training" : "queued";
    return "empty";
  });
}
