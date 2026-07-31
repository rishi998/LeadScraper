import { closeAllChromeProcesses } from '../packages/providers/src/playwright-maps.js';

const killed = closeAllChromeProcesses();
console.log(killed > 0 ? `Closed ${killed} Chrome process(es).` : 'Chrome was not running.');
