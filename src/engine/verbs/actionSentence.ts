import { getGameSettings } from '../ConfigManager.js';
import { isGameplayInteractionRunning, onInteractionActivityEnded } from '../interaction/interactionActivity.js';
import { inventoryItemLabel } from './targetLabel.js';
import { composeVerbLineText } from './verbConfig.js';
import { emitBenneVerbContextChanged } from './verbContext.js';

/**
 * The verb line of the action that is running (decision 57). A dispatched verb ("Use Door", from a
 * right-click's default verb or an armed verb the click consumed) is what `pointer.sentence` shows
 * until the handlers it started finish, whatever the pointer is over by then.
 *
 * The sentence ends once no gameplay interaction is running. The check waits a macrotask, because
 * `unhandled()` starts the next handler in the chain only after the previous one has ended.
 */
let sentence: string | null = null;
let endCheckScheduled = false;

/** Called by the verb dispatchers: `verbId` on `targetDescription`, with the armed `itemId` when one is used. */
export function beginActionSentence(
  verbId: string,
  targetDescription: string | null | undefined,
  itemId: string | null = null,
): void {
  const next = composeVerbLineText(
    getGameSettings(),
    verbId,
    targetDescription ?? null,
    itemId ? inventoryItemLabel(itemId) : null,
  ).trim();
  if (next !== sentence) {
    sentence = next;
    emitBenneVerbContextChanged();
  }
  // A click that starts no handler ends its sentence straight away.
  scheduleEndCheck();
}

/** The running action's verb line, or `null` when no dispatched action is running. */
export function getActionSentence(): string | null {
  return sentence;
}

/** Room transition: the action that was running has been cancelled with its room. */
export function clearActionSentence(): void {
  if (sentence !== null) {
    sentence = null;
    emitBenneVerbContextChanged();
  }
}

function scheduleEndCheck(): void {
  if (endCheckScheduled || sentence === null) {
    return;
  }
  endCheckScheduled = true;
  setTimeout(() => {
    endCheckScheduled = false;
    if (!isGameplayInteractionRunning()) {
      clearActionSentence();
    }
  }, 0);
}

onInteractionActivityEnded(scheduleEndCheck);
