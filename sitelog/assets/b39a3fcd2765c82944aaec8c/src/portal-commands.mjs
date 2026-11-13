import { activeActor } from "./portal-access.mjs";
import { saveParty, savePartyContact, saveRepresentative, linkCommercialParties } from "./party-domain.mjs";
import { acceptQuotes, declineQuote } from "./portal-quote-domain.mjs";
import { authoriseWork, setJobReadiness } from "./work-authorisation-domain.mjs";
import { submitRecord, reviewRecord, acknowledgeInstruction } from "./structured-record-domain.mjs";
import { decideVariation } from "./portal-variation-domain.mjs";
import { uploadClientDocument, shareClientDocument } from "./portal-document-domain.mjs";
const commands = { saveParty, savePartyContact, saveRepresentative, linkCommercialParties, acceptQuotes, declineQuote, authoriseWork, setJobReadiness, submitRecord, reviewRecord, acknowledgeInstruction, decideVariation, uploadClientDocument, shareClientDocument };
export const PORTAL_COMMANDS = Object.freeze(Object.keys(commands));
export function executePortalCommand(data, stores, actor, command, input) {
  actor = activeActor(data, actor);
  if (!commands[command]) throw new Error("Unsupported structured workflow.");
  return commands[command](data, stores, actor, input);
}
