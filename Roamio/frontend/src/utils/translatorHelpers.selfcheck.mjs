import assert from "node:assert";
import { SOURCE_LANGUAGES, baseCode, speechLang, targetForBase, tripLanguages } from "./translatorHelpers.js";

assert.equal(baseCode("EN-US"), "EN");
assert.equal(SOURCE_LANGUAGES.filter((l) => l.code === "EN").length, 1);
assert.equal(SOURCE_LANGUAGES.find((l) => l.code === "EN").name, "English");
assert.equal(SOURCE_LANGUAGES.find((l) => l.code === "ZH").name, "Chinese");
assert.equal(SOURCE_LANGUAGES.find((l) => l.code === "PT").name, "Portuguese");

assert.equal(targetForBase("en"), "EN-US");
assert.equal(targetForBase("PT"), "PT-BR");
assert.equal(targetForBase("fr"), "FR");
assert.equal(targetForBase("xx"), null);

assert.equal(speechLang("EN-US"), "en-US");
assert.equal(speechLang("PT-BR"), "pt-BR");
assert.equal(speechLang("FR"), "fr");
assert.equal(speechLang("ZH-HANT"), "zh-TW");
assert.equal(speechLang("ES-419"), "es-419");
// starting languages for a trip: from the destination's language into the saved preference
assert.deepEqual(tripLanguages("FR", "en"), { source: "FR", target: "EN-US" });
assert.deepEqual(tripLanguages("FR", "EN-GB"), { source: "FR", target: "EN-GB" });
assert.deepEqual(tripLanguages(null, "EN-GB"), { source: "auto", target: "EN-GB" }); // South Africa
assert.deepEqual(tripLanguages("EN", "EN-GB"), { source: "auto", target: "EN-GB" }); // nothing to translate
assert.deepEqual(tripLanguages("JA", undefined), { source: "JA", target: "EN-US" });
console.log("translatorHelpers: all assertions passed");
