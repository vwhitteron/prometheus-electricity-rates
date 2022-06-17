import express, { Express, Request, Response } from 'express';
import { Registry, Gauge } from 'prom-client';


const config = require('../config.json');

const app: Express = express();

const registry = new Registry()

enum Days {
    SUNDAY,
    MONDAY,
    TUESDAY,
    WEDNESDAY,
    THURSDAY,
    FRIDAY,
    SATURDAY,
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


app.get('/metrics', async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const nowDay = Days[now.getDay()].toLowerCase();
        const nowTime =(now.getHours()*100) + now.getMinutes();

        const dayRates = config["rates"][nowDay];

        let registryMetric = {};

        for (const direction of ["buy", "sell"]) {
            let rate = 0;
            for (var rateTime in dayRates[direction]) {
                if (nowTime.toString() >= rateTime) {
                    rate = dayRates[direction][rateTime];
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