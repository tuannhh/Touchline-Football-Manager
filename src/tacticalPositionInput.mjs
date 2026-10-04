// The board points toward the top goal. This maps a dropped seat to its football
// position; it never modifies a player's natural position in their profile.
export function positionAtPoint(x,y){
 const left=x<27,right=x>73;
 if(y>=64)return left?'LB':right?'RB':'CB';
 if(y>=53)return left?'LWB':right?'RWB':'DM';
 if(y>=36)return left?'LM':right?'RM':'CM';
 if(y>=23)return left?'LW':right?'RW':'AM';
 return left?'LW':right?'RW':'ST';
}
export function pitchPoint(clientX,clientY,rect){
 if(!rect||rect.width<=0||rect.height<=0||![clientX,clientY].every(Number.isFinite))return null;
 const x=Math.round(Math.max(8,Math.min(92,(clientX-rect.left)/rect.width*100))),y=Math.round(Math.max(10,Math.min(80,(clientY-rect.top)/rect.height*100)));
 return {position:positionAtPoint(x,y),x,y};
}
