package com.yutanios.app.screens

import androidx.compose.runtime.Composable
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.Screen

@Composable
fun AssetsScreen(characterId: Long) {
    Screen("Assets", perCharacter = true) { item { Card { Empty("Assets is not built yet.") } } }
}
