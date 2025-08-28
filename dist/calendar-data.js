import { readFileSync } from 'fs';
import { join } from 'path';
export class CalendarData {
    data = [];
    constructor() {
        this.loadData();
    }
    loadData() {
        const csvPath = join(process.cwd(), 'kalender 2019_2028.csv');
        const csvContent = readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n');
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line)
                continue;
            const columns = line.split(';');
            if (columns.length < 20)
                continue;
            const entry = {
                date: columns[0],
                weekday: columns[1],
                isWeekend: columns[3] === '1',
                flanders: columns[4] === '1',
                wallonia: columns[6] === '1',
                northNetherlands: columns[8] === '1',
                middleNetherlands: columns[10] === '1',
                southNetherlands: columns[11] === '1',
                luxembourg: columns[12] === '1',
                holidayBelgium: columns[13] === '1',
                holidayNetherlands: columns[15] === '1',
                holidayLuxembourg: columns[17] === '1'
            };
            this.data.push(entry);
        }
    }
    isSchoolVacation(date, region) {
        const entry = this.data.find(e => e.date === date);
        if (!entry)
            return false;
        switch (region.toLowerCase()) {
            case 'flanders':
            case 'vlaanderen':
                return entry.flanders;
            case 'wallonia':
            case 'wallonië':
                return entry.wallonia;
            case 'north-netherlands':
            case 'noord-nederland':
                return entry.northNetherlands;
            case 'middle-netherlands':
            case 'midden-nederland':
                return entry.middleNetherlands;
            case 'south-netherlands':
            case 'zuid-nederland':
                return entry.southNetherlands;
            case 'luxembourg':
                return entry.luxembourg;
            default:
                throw new Error(`Unknown region: ${region}`);
        }
    }
    getVacationPeriods(region, year) {
        let filteredData = this.data;
        if (year) {
            filteredData = this.data.filter(entry => {
                const entryYear = new Date(entry.date.split('/').reverse().join('-')).getFullYear();
                return entryYear === year;
            });
        }
        const vacationDays = filteredData.filter(entry => {
            switch (region.toLowerCase()) {
                case 'flanders':
                case 'vlaanderen':
                    return entry.flanders;
                case 'wallonia':
                case 'wallonië':
                    return entry.wallonia;
                case 'north-netherlands':
                case 'noord-nederland':
                    return entry.northNetherlands;
                case 'middle-netherlands':
                case 'midden-nederland':
                    return entry.middleNetherlands;
                case 'south-netherlands':
                case 'zuid-nederland':
                    return entry.southNetherlands;
                case 'luxembourg':
                    return entry.luxembourg;
                default:
                    throw new Error(`Unknown region: ${region}`);
            }
        });
        // Group consecutive vacation days into periods
        const periods = [];
        let currentPeriod = null;
        for (const day of vacationDays) {
            if (!currentPeriod) {
                currentPeriod = { start: day.date, end: day.date };
            }
            else {
                const currentDate = new Date(day.date.split('/').reverse().join('-'));
                const lastDate = new Date(currentPeriod.end.split('/').reverse().join('-'));
                const dayAfterLast = new Date(lastDate);
                dayAfterLast.setDate(lastDate.getDate() + 1);
                if (currentDate.getTime() === dayAfterLast.getTime()) {
                    currentPeriod.end = day.date;
                }
                else {
                    periods.push(currentPeriod);
                    currentPeriod = { start: day.date, end: day.date };
                }
            }
        }
        if (currentPeriod) {
            periods.push(currentPeriod);
        }
        return periods;
    }
    getSupportedRegions() {
        return [
            'flanders',
            'wallonia',
            'north-netherlands',
            'middle-netherlands',
            'south-netherlands',
            'luxembourg'
        ];
    }
}
//# sourceMappingURL=calendar-data.js.map