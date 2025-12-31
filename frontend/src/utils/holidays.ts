// Czech public holidays for business day calculation
export const CZ_HOLIDAYS = [
    { m: 0, d: 1 },   // Nový rok
    { m: 4, d: 1 },   // Svátek práce
    { m: 4, d: 8 },   // Den vítězství
    { m: 6, d: 5 },   // Cyril/Metod
    { m: 6, d: 6 },   // Jan Hus
    { m: 8, d: 28 },  // Den české státnosti
    { m: 9, d: 28 },  // Vznik ČSR
    { m: 10, d: 17 }, // Den boje za svobodu
    { m: 11, d: 24 }, // Štědrý den
    { m: 11, d: 25 },
    { m: 11, d: 26 },
];

export const isCZHoliday = (date: Date) => {
    return CZ_HOLIDAYS.some(h => date.getMonth() === h.m && date.getDate() === h.d);
};
