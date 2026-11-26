/** Prints the reel strips built from src/config/math.ts:  npm run strips */
import { STRIPS, FS_STRIPS, stripText } from '../src/engine/game';

console.log('BASE GAME\n' + stripText(STRIPS));
console.log('\nFREE SPINS\n' + stripText(FS_STRIPS));
