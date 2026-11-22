package com.yutanios.app.screens

import androidx.compose.runtime.Composable
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.Screen

@Composable
fun SkillsScreen(characterId: Long) {
    Screen("Skills", perCharacter = true) { item { Card { Empty("Skills is not built yet.") } } }
}
