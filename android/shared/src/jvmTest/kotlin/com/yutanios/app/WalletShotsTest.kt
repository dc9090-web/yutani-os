package com.yutanios.app

import com.yutanios.app.screens.WalletScreen
import com.yutanios.app.ui.Section
import kotlin.test.Test

/** The Wallet states the default render does not show. Draws only with `-Pshots=<dir>`. */
class WalletShotsTest {
    @Test fun renderTransactionsTab() {
        if (!Shots.wanted) return
        Shots.shot("wallet-transactions", Section.Wallet) { WalletScreen(9000001L, initialTab = 1) }
    }
}
