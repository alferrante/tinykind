import { createMessage, reserveAuthEmail } from "../src/lib/store";
async function main(): Promise<void> {
const [mode, count] = process.argv.slice(2);
if (mode === "reserve") {
  console.log(JSON.stringify(await reserveAuthEmail("parallel@example.test")));
} else {
  for (let index = 0; index < Number(count); index++) {
    await createMessage({ senderName: "Worker", body: "Thanks for your kindness." });
  }
}

}
void main();
