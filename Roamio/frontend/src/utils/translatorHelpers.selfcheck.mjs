import assert from "node:assert";
import { SOURCE_LANGUAGES, baseCode, speechLang, targetForBase } from "./translatorHelpers.js";

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
console.log("translatorHelpers: all assertions passed");
