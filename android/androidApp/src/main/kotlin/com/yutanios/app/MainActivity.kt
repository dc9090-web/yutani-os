package com.yutanios.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import java.lang.ref.WeakReference

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val app = application as YutaniApp
        app.activity = WeakReference(this)
        setContent { App(app.container) }
    }

    override fun onDestroy() {
        val app = application as YutaniApp
        if (app.activity.get() === this) app.activity = WeakReference(null)
        super.onDestroy()
    }
}
