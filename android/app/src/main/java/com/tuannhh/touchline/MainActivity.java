package com.tuannhh.touchline;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import androidx.core.view.WindowCompat;

public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  int background=Color.rgb(16,25,18);
  getWindow().setBackgroundDrawable(new ColorDrawable(background));
  getWindow().getDecorView().setBackgroundColor(background);
  findViewById(android.R.id.content).setBackgroundColor(background);
  getWindow().setStatusBarColor(background);
  getWindow().setNavigationBarColor(background);
  WindowCompat.getInsetsController(getWindow(),getWindow().getDecorView()).setAppearanceLightStatusBars(false);
  WindowCompat.getInsetsController(getWindow(),getWindow().getDecorView()).setAppearanceLightNavigationBars(false);
 }
}
