package com.yutanios.app.screens

import androidx.compose.runtime.Composable
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.Screen

/** `path` is the API path of one ship's detail, for an owned ship or a saved fit. */
@Composable
fun ShipDetailScreen(path: String, onBack: () -> Unit) {
    Screen("Ship", perCharacter = false, back = onBack) { item { Card { Empty("Ship detail is not built yet.") } } }
}
