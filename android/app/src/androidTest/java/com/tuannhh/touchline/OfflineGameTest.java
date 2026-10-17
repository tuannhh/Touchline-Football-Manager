package com.tuannhh.touchline;

import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.os.Environment;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Device test: use rendered UI, then reload the app and read the stored career. */
@RunWith(AndroidJUnit4.class)
public class OfflineGameTest {
 private ActivityScenario<MainActivity> scenario;
 private String js(String script) throws Exception {
  CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
  scenario.onActivity(a->a.getBridge().getWebView().evaluateJavascript(script,value->{result.set(value);latch.countDown();}));
  assertTrue("JS response timeout",latch.await(30,TimeUnit.SECONDS));return result.get();
 }
 private void until(String expression,int seconds) throws Exception {
  long end=System.currentTimeMillis()+seconds*1000L;String last="";
  do {last=js(expression);if("true".equals(last))return;Thread.sleep(500);}while(System.currentTimeMillis()<end);
  fail("Timeout: "+expression+" = "+last+"\n"+js("document.body.innerText.slice(-1800)"));
 }
 private void clickText(String selector,String text) throws Exception {
  String expr="[...document.querySelectorAll('"+selector+"')].find(e=>e.textContent.trim()==="+org.json.JSONObject.quote(text)+")";
  until("Boolean("+expr+")",30);js(expr+".click()");
 }
 private void screenshot(String name) throws Exception {
  Thread.sleep(700);Bitmap shot=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
  File dir=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null),"qa");dir.mkdirs();try(FileOutputStream out=new FileOutputStream(new File(dir,name+".png"))){shot.compress(Bitmap.CompressFormat.PNG,100,out);}shot.recycle();
 }
 @Test public void offlineCareerAndTouchNavigation() throws Exception {
  try(ActivityScenario<MainActivity> active=ActivityScenario.launch(MainActivity.class)){
   scenario=active;
   until("!!document.querySelector('.start-mode-picker')",60);
   assertEquals("\"https://localhost\"",js("location.origin"));
   assertEquals("true",js("document.documentElement.scrollWidth<=innerWidth+2"));
   js("document.querySelector('.start-mode-picker button:first-child').click()");
   until("!!document.querySelector('.career-setup')",30);screenshot("01-start-portrait");
   js("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Trò chơi mới ·')).click()");
   until("!!document.querySelector('.mobile-bottom-nav')",120);
   until("document.querySelector('.save-state')?.textContent.includes('Đã lưu')",120);
   assertEquals("true",js("document.documentElement.scrollWidth<=innerWidth+2"));
   screenshot("02-office-portrait");
   js("document.querySelector('.world-search-trigger').click()");
   until("!!document.querySelector('.world-search input')",10);
   js("(()=>{let e=document.querySelector('.world-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'yamal');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
   until("document.querySelector('.world-search-results')?.textContent.includes('Yamal')",10);
   screenshot("03-search");js("document.querySelector('.world-search-results button').click()");
   until("!!document.querySelector('.player-dialog-hero')",10);screenshot("04-profile");
   scenario.onActivity(a->a.getOnBackPressedDispatcher().onBackPressed());until("!document.querySelector('[role=dialog]')",10);
   clickText(".mobile-bottom-nav button","Chiến thuật");until("!!document.querySelector('.tactical-board')",30);
   assertEquals("true",js("document.documentElement.scrollWidth<=innerWidth+2"));
   String benchName=js("document.querySelector('.matchday-bench-name:not(:disabled)').textContent");
   js("document.querySelector('.pitch-player[data-drop-slot=\"10\"]').click()");
   js("document.querySelector('.matchday-bench-name:not(:disabled)').click()");
   until("document.querySelector('.pitch-player[data-drop-slot=\"10\"]').getAttribute('aria-label').includes("+benchName+")",10);
   js("document.querySelector('.tactical-board').scrollIntoView({block:'start'})");screenshot("05-tactics-portrait");
   scenario.onActivity(a->a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));until("innerWidth>innerHeight",20);
   assertEquals("true",js("document.documentElement.scrollWidth<=innerWidth+2"));
   assertEquals("\"grid\"",js("getComputedStyle(document.querySelector('.mobile-bottom-nav')).display"));screenshot("06-tactics-landscape");
   scenario.onActivity(a->a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));until("innerHeight>innerWidth",20);
   js("document.querySelector('.save-state').click()");Thread.sleep(1500);until("document.querySelector('.save-state')?.textContent.includes('Đã lưu')",60);
   scenario.onActivity(a->a.getBridge().getWebView().reload());until("!!document.querySelector('.start-mode-picker')",60);
   js("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Tải trò chơi')&&e.textContent.includes('Saved Games')).click()");
   until("!!document.querySelector('.save-slot') || document.body.innerText.includes('Lưu lần cuối')",30);screenshot("07-offline-saves");
   clickText("main button","Tải trò chơi");until("!!document.querySelector('.mobile-bottom-nav')",120);
   screenshot("08-reloaded-career");
   clickText(".mobile-bottom-nav button","Thêm");clickText(".sidebar-tools button","Lưu & dữ liệu");
   clickText("main button","Xuất file sự nghiệp");
   File exported=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getCacheDir(),"Touchline-career.json");
   long shareDeadline=System.currentTimeMillis()+30000;boolean sharing=false;
   while(System.currentTimeMillis()<shareDeadline){
    android.view.accessibility.AccessibilityNodeInfo root=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
    sharing=root!=null&&!"com.tuannhh.touchline".contentEquals(root.getPackageName());
    if(sharing&&exported.exists()&&exported.length()>1000000)break;Thread.sleep(500);
   }
   assertTrue("Android share sheet opened",sharing);assertTrue("Exported JSON exists",exported.exists());
   int exportedPlayers=0;
   try(android.util.JsonReader reader=new android.util.JsonReader(new java.io.FileReader(exported))){
    reader.beginObject();while(reader.hasNext()){
     if(reader.nextName().equals("players")){reader.beginObject();while(reader.hasNext()){reader.nextName();reader.skipValue();exportedPlayers++;}reader.endObject();}
     else reader.skipValue();
    }reader.endObject();
   }
   assertTrue("Complete valid JSON with player database",exportedPlayers>1000);screenshot("08a-android-share");
   InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK);
   clickText(".mobile-bottom-nav button","Tổng quan");
   // Advance through the same calendar controls as the player; do not inject a match.
   for(int day=0;day<35;day++){
    if("true".equals(js("document.querySelector('.continue-button')?.textContent.includes('Chuẩn bị trận đấu')")))break;
    js("document.querySelector('.calendar-controls .secondary')?.click()");
    Thread.sleep(700);until("!document.querySelector('.busy-overlay')",180);
   }
   until("document.querySelector('.continue-button')?.textContent.includes('Chuẩn bị trận đấu')",10);
   js("document.querySelector('.continue-button').click()");until("!!document.querySelector('.prematch-heading')",30);
   assertEquals("false",js("document.querySelector('.prematch-actions .primary').disabled"));
   js("document.querySelector('.prematch-actions .primary').click()");until("!!document.querySelector('.match-canvas')",30);
   js("document.querySelector('.stadium-frame').scrollIntoView({block:'center'})");
   until("document.querySelector('.match-canvas').width>300",15);
   js("document.querySelector('.match-controls .primary').click()");Thread.sleep(3000);
   screenshot("09-match-offline");
   assertEquals("true",js("document.documentElement.scrollWidth<=innerWidth+2"));
   js("document.querySelector('.match-controls .primary').click()");
   String minute=js("document.querySelector('.minute-label').textContent");
   js("document.querySelector('.save-state').click()");Thread.sleep(1200);until("document.querySelector('.save-state')?.textContent.includes('Đã lưu')",60);
   scenario.onActivity(a->a.getBridge().getWebView().reload());until("!!document.querySelector('.start-mode-picker')",60);
   clickText("main button","Tải trò chơi");until("!!document.querySelector('.match-canvas')",120);
   assertEquals(minute,js("document.querySelector('.minute-label').textContent"));screenshot("10-match-restored");
  }
 }
}
