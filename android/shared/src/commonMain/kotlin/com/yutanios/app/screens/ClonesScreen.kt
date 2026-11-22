package com.yutanios.app.screens

import androidx.compose.runtime.Composable
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.Screen

@Composable
fun ClonesScreen(characterId: Long) {
    Screen("Clones", perCharacter = true) { item { Card { Empty("Clones is not built yet.") } } }
}
