// Current ordering contacts, including the additional email requested by staff.
export const ORDERING_EMAIL=(process.env.KAYA_EMAIL||"kayalivhuebner@gmail.com").trim().toLowerCase();
export const ORDERING_EMAILS=[...new Set([ORDERING_EMAIL,"adean@baxterregional.org"])];
export function orderingRecipients(recipients:string[]){
  return [...new Set(recipients.map(email=>email.trim().toLowerCase()).filter(Boolean).flatMap(email=>email==="brooklyncarter.0716@gmail.com"||email===ORDERING_EMAIL?ORDERING_EMAILS:[email]))];
}
