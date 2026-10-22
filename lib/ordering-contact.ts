// Kaya is the current ordering contact. Keep legacy recipient lists from
// sending supply notifications to the previous ordering contact.
export const ORDERING_EMAIL=(process.env.KAYA_EMAIL||"kayalivhuebner@gmail.com").trim().toLowerCase();
export function orderingRecipients(recipients:string[]){
  return [...new Set(recipients.map(email=>email.trim().toLowerCase()).filter(Boolean).map(email=>email==="brooklyncarter.0716@gmail.com"?ORDERING_EMAIL:email))];
}
