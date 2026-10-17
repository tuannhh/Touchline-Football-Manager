import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {OFFLINE_APP} from './platform.mjs';
export async function setupMobile(){
 if(!OFFLINE_APP)return;
 document.documentElement.classList.add('mobile-app');
 void navigator.storage?.persist?.().catch(()=>{});
 if(!Capacitor.isNativePlatform())return;
 await App.addListener('backButton',()=>window.dispatchEvent(new Event('touchline-back')));
 await App.addListener('appStateChange',({isActive})=>{if(!isActive)window.dispatchEvent(new Event('touchline-background'));});
}
export async function minimizeMobile(){if(Capacitor.isNativePlatform())await App.minimizeApp();}
export async function exportMobileCareer(g){
 const {Filesystem,Directory,Encoding}=await import('@capacitor/filesystem'),{Share}=await import('@capacitor/share');
 const path='Touchline-career.json',text=JSON.stringify(g),chunk=512*1024;
 await Filesystem.writeFile({path,data:'',directory:Directory.Cache,encoding:Encoding.UTF8});
 for(let offset=0;offset<text.length;){let end=Math.min(offset+chunk,text.length);if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1]))end--;await Filesystem.appendFile({path,data:text.slice(offset,end),directory:Directory.Cache,encoding:Encoding.UTF8});offset=end;}
 const {uri}=await Filesystem.getUri({path,directory:Directory.Cache});
 await Share.share({title:g.saveName||'Touchline',files:[uri]});
}
