import express, { Express, Request, Response } from 'express';
import { Registry, Gauge } from 'prom-client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';


const config = require('../config.json');
const csvFile = '../syukujitsu.csv';

const app: Express = express();

const registry = new Registry()

enum Days {
    SUNDAY,
    MONDAY,
    TUESDAY,
    WEDNESDAY,
    THURSDAY,
    FRIDAY,
    SATURDAY
}

const port: number = config.server.port != null
                   ? parseInt(config.server.port, 10)
                   : 9096;

const address: number = config.server.address != null
                   ? config.server.address
                   : "127.0.0.1";

registry.registerMetric( new Gauge({
    name:  'power_rate_buy',
    help: 'Electrical power kWh purchase rate',
    labelNames: ['supplier', 'plan', 'currency'],
}) );

registry.registerMetric( new Gauge({
    name:  'power_rate_sell',
    help: 'Electrical power kWh sell rate',
    labelNames: ['supplier', 'plan', 'currency'],
}) );

async function isHoliday(date: Date): Promise<boolean> {
    const csvFilePath = path.resolve(__dirname, csvFile);
    const csvContent = fs.readFileSync(csvFilePath, {encoding: 'utf-8'});

    const today = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

    const records = parse(csvContent, {delimiter: ',', from_line: 2});
    for(const row of records) {
        if(today === row[0]) {
            return true;
        }
    }

    return false;
}

app.get('/metrics', async (req: Request, res: Response) => {
    try {
        let registryMetric = {};

        const now = new Date();
        const nowTime =(now.getHours()*100) + now.getMinutes();
        const nowDay = await isHoliday(now) === true
            ? 'holiday'
            : Days[now.getDay()].toLowerCase();
        const dayRates = config["rates"][nowDay];
        
        for (const direction of ["buy", "sell"]) {
            let rate = 0;
            for (var time of Object.keys(dayRates[direction]).sort()) {
                const rateTime: number = +time;
                if (nowTime >= rateTime) {
                    rate = dayRates[direction][time];
                }
            };
 
            const metricName = `power_rate_${direction}`

            registryMetric[metricName] = registry.getSingleMetric(metricName) as Gauge<any>;
            registryMetric[metricName].set(
                {
                    supplier: config["supplier"],
                    plan: config["plan"],
                    currency: config["currency"],
                },
                rate,
            );
        }        

        const metrics = await registry.metrics();

        res.type('text/plain').send(metrics);
    } catch (e) {
        console.error(e)
        throw e 
    }
});

app.listen(port, () => {
    console.log(`Server is running at https://${address}:${port}`);
})