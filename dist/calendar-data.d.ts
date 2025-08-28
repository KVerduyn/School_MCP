export declare class CalendarData {
    private data;
    constructor();
    private loadData;
    isSchoolVacation(date: string, region: string): boolean;
    getVacationPeriods(region: string, year?: number): Array<{
        start: string;
        end: string;
    }>;
    getSupportedRegions(): string[];
}
//# sourceMappingURL=calendar-data.d.ts.map