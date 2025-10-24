export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const LIST_PAGE_DELAY_MS = { min: 200, max: 500 };
export const DETAIL_PAGE_DELAY_MS = { min: 250, max: 650 };

export function todayISO(): string {
    return new Date().toISOString().split("T")[0];
}
