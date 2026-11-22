package com.yutanios.app.screens

import androidx.compose.runtime.Composable
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.Screen

@Composable
fun WalletScreen(characterId: Long) {
    Screen("Wallet", perCharacter = true) { item { Card { Empty("Wallet is not built yet.") } } }
}
