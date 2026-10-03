// A saved world is its own source of truth. Loading a newer roster release must
// never import real-world moves into a career that has already started.
export function careerDatabase(g){
 return {meta:structuredClone(g.dbMeta||{}),leagues:structuredClone(g.leagues),clubs:structuredClone(Object.values(g.clubs)),players:structuredClone(Object.values(g.players)),competitions:structuredClone(g.cups||[])};
}
export function databaseFromRelease(payload){
 if(!payload?.database||!payload?.release)throw Error('Bản đội hình không hợp lệ.');
 return {...payload.database,homegrownIndex:payload.homegrown,release:payload.release};
}
export function stampCareerRelease(g,release){
 if(!release)return g;
 g.dbRelease={id:release.id,label:release.label||release.name,season:release.season,asOf:release.asOf,publishedAt:release.publishedAt};
 return g;
}
