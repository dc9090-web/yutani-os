package com.yutanios.app.screens

import androidx.compose.runtime.Composable
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.Screen

@Composable
fun OverviewScreen() {
    Screen("Overview", perCharacter = false) { item { Card { Empty("Overview is not built yet.") } } }
}
