package com.yutanios.app.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.yutanios.app.model.Paths
import com.yutanios.app.model.SkillsData
import com.yutanios.app.model.TrainingData
import com.yutanios.app.model.TrainingOverview
import com.yutanios.app.model.at
import com.yutanios.app.ui.Gap
import com.yutanios.app.ui.Res
import com.yutanios.app.ui.Screen
import com.yutanios.app.ui.Tabs
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.rememberNow
import com.yutanios.app.ui.resource
import com.yutanios.app.ui.type
import com.yutanios.app.ui.whenMissing

/** The tabs in the site's order (src/app/skills/page.tsx): Overview is first and the default. */
object SkillsTab {
    const val OVERVIEW = 0
    const val SKILLS = 1
    const val TRAINING = 2
    val labels = listOf("Overview", "Skills", "Training")
}

/**
 * Skills: every chosen character's queue (Overview), then the active character's skill sheet and
 * training queue. Everything that moves with time is worked out here from the raw queue, so a copy
 * that is a day old still shows what is training now.
 */
@Composable
fun SkillsScreen(characterId: Long, initialTab: Int = SkillsTab.OVERVIEW) {
    var tab by rememberSaveable { mutableIntStateOf(initialTab) }
    // One description open at a time per list, as on the site.
    var open by remember(tab, characterId) { mutableStateOf<String?>(null) }
    val toggle = { key: String -> open = if (open == key) null else key }
    val now = rememberNow().value

    val overview = if (tab == SkillsTab.OVERVIEW) resource(Paths.TRAINING_OVERVIEW, TrainingOverview.serializer()).value else null
    val sheet = if (tab == SkillsTab.SKILLS) resource(Paths.skills(characterId), SkillsData.serializer()).value else null
    val training = if (tab == SkillsTab.TRAINING) resource(Paths.training(characterId), TrainingData.serializer()).value else null

    val queues = remember(overview, now) { (overview as? Res.Ready)?.data?.characters?.map { it.at(now) } }
    val sheetNow = remember(sheet, now) { (sheet as? Res.Ready)?.data?.at(now) }
    val trainingNow = remember(training, now) { (training as? Res.Ready)?.data?.at(now) }

    Screen("Skills", perCharacter = tab != SkillsTab.OVERVIEW) {
        // The Overview tab covers every character: the dropdown gives way to this line (DESIGN_SYSTEM.md).
        if (tab == SkillsTab.OVERVIEW) item(key = "all-characters") { Txt("All characters", type.body, Modifier.pullUp(8.dp), color = Yo.textMuted) }
        item(key = "tabs") {
            if (tab == SkillsTab.OVERVIEW) Gap(20.dp)
            Tabs(SkillsTab.labels, tab, { tab = it })
            Gap(20.dp)
        }
        when (tab) {
            SkillsTab.OVERVIEW -> if (!whenMissing(overview ?: Res.Reading)) overviewTab(queues.orEmpty())
            SkillsTab.SKILLS -> if (!whenMissing(sheet ?: Res.Reading)) sheetNow?.let { sheetTab(it, open, toggle) }
            else -> if (!whenMissing(training ?: Res.Reading)) trainingNow?.let { trainingTab(it, open, toggle) }
        }
    }
}
