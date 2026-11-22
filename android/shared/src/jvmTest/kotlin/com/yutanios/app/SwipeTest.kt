package com.yutanios.app

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.test.swipeRight
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlin.test.Test

/** A swipe across the screen flips to the neighbouring section, and the strip's links still work. */
@OptIn(ExperimentalTestApi::class)
class SwipeTest {
    @Test fun swipingMovesBetweenSections() = runComposeUiTest {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        try {
            val app = Fixtures.app(scope)
            setContent { App(app) }
            // Text only each screen shows, so the strip's own labels cannot satisfy the checks.
            val overview = "Combined wallet".uppercase()
            val skills = "All characters"
            val clones = "Active clone"
            waitUntil(timeoutMillis = 10_000) { onAllNodesWithTextCount(overview) > 0 }
            onRoot().performTouchInput { swipeLeft() }
            waitUntil(timeoutMillis = 10_000) { onAllNodesWithTextCount(skills) > 0 }
            onNodeWithText(skills).assertIsDisplayed()
            onRoot().performTouchInput { swipeLeft() }
            waitUntil(timeoutMillis = 10_000) { onAllNodesWithTextCount(clones) > 0 }
            onNodeWithText(clones).assertIsDisplayed()
            onRoot().performTouchInput { swipeRight() }
            waitForIdle()
            onNodeWithText(skills).assertIsDisplayed()
            // Tapping a section in the strip still jumps straight to it.
            onNodeWithText("Wallet").performClick()
            waitUntil(timeoutMillis = 10_000) { onAllNodesWithTextCount("BALANCE") > 0 }
            onNodeWithText("BALANCE").assertIsDisplayed()
        } finally {
            scope.cancel()
        }
    }

    private fun androidx.compose.ui.test.ComposeUiTest.onAllNodesWithTextCount(text: String): Int =
        onAllNodes(androidx.compose.ui.test.hasText(text)).fetchSemanticsNodes().size
}
