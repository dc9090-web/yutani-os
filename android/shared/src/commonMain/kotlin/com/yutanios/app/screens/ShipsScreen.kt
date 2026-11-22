package com.yutanios.app.screens

import androidx.compose.runtime.Composable
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.Screen

@Composable
fun ShipsScreen(characterId: Long, onOpenAsset: (Long) -> Unit, onOpenFit: (Long) -> Unit) {
    Screen("Ships") { item { Card { Empty("Ships is not built yet.") } } }
}
