import axios from "axios";

import { getLocale, subscribe } from "../i18n/t.ts";

// Shared axios instance. The baseURL is RELATIVE on purpose: in development
// Vite proxies /api to the backend on :8000, and in production FastAPI serves
// the built frontend itself — same origin either way, so nothing here has to
// know which of the two it is running in, and CORS never enters the picture.
export const api = axios.create({
  baseURL: "",
});

// Which language the BACKEND should answer in. Every request carries it, so
// the words that come out of the server — a refusal, a survey question, what a
// chat card says it will do — arrive in the same language as the words the
// frontend wrote around them. Without this the app is bilingual at the seams:
// a Chinese button asking a question an English error answers.
function applyLanguage() {
  api.defaults.headers.common["Accept-Language"] =
    getLocale() === "zh" ? "zh-CN,zh;q=0.9" : "en-US,en;q=0.9";
}
applyLanguage();
subscribe(applyLanguage);
