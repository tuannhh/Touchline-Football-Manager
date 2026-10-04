import {buildMatchScene} from './matchMotion.mjs';

// The worker needs the two match squads, never the whole career/database.
export function sceneGamePayload(game,before,after){
 const ids=new Set([...(before.lineups||[]).flat(),...(after.lineups||[]).flat()]);
 const players={};
 for(const id of ids){const p=game.players[id];if(p)players[id]={id:p.id,attributes:p.attributes,position:p.position,naturalPositions:p.naturalPositions,otherPositions:p.otherPositions};}
 return {players};
}

export function planMatchScene({game,before,after,previous}){
 return buildMatchScene(game,before,after,previous);
}
