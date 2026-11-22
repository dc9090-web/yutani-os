package com.yutanios.app

import com.yutanios.app.screens.SkillsScreen
import com.yutanios.app.screens.SkillsTab
import com.yutanios.app.ui.Section
import kotlin.test.Test

/** The three Skills tabs, drawn from the fixtures. Draws only with `-Pshots=<dir>`. */
class SkillsShotsTest {
    // Point this at 9000002 (paused, gaps) or 9000003 (nothing synced) to look at the empty states.
    private val character = 9000001L

    @Test fun renderEveryTab() {
        if (!Shots.wanted) return
        Shots.shot("skills-all", Section.Skills) { SkillsScreen(character, initialTab = SkillsTab.OVERVIEW) }
        Shots.shot("skills-sheet", Section.Skills) { SkillsScreen(character, initialTab = SkillsTab.SKILLS) }
        Shots.shot("skills-training", Section.Skills) { SkillsScreen(character, initialTab = SkillsTab.TRAINING) }
    }
}
