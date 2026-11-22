package com.yutanios.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.yutanios.app.model.CharacterOption
import com.yutanios.app.model.Me
import com.yutanios.app.model.Paths
import com.yutanios.app.resources.Res as R
import com.yutanios.app.resources.wordmark
import com.yutanios.app.time.relativeTime
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import org.jetbrains.compose.resources.painterResource

enum class Section(val route: String, val title: String) {
    Overview("overview", "Overview"), Skills("skills", "Skills"), Clones("clones", "Clones"),
    Ships("ships", "Ships"), Assets("assets", "Assets"), Wallet("wallet", "Wallet"),
}

/** The characters on the phone and which one the per-character screens show. */
class Characters(val all: List<CharacterOption>, val activeId: Long?, val select: (Long) -> Unit) {
    val active: CharacterOption? get() = all.firstOrNull { it.id == activeId } ?: all.firstOrNull()
}

val LocalCharacters = staticCompositionLocalOf { Characters(emptyList(), null) {} }

@Composable
fun rememberCharacters(): Characters {
    val app = LocalApp.current
    val list by resource(Paths.CHARACTERS, ListSerializer(CharacterOption.serializer()))
    val index by app.store.index.collectAsState()
    val scope = rememberCoroutineScope()
    val all = (list as? Res.Ready)?.data ?: emptyList()
    return Characters(all, index.activeCharacterId) { id -> scope.launch { app.store.setActiveCharacter(id) } }
}

/** The 56dp first row: wordmark with the amber OS chip, and the account button holding the owner's initials. */
@Composable
fun Header(modifier: Modifier = Modifier) {
    val app = LocalApp.current
    val me by resource(Paths.ME, Me.serializer())
    var menu by remember { mutableStateOf(false) }
    Row(modifier.fillMaxWidth().height(56.dp).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Image(painterResource(R.drawable.wordmark), "Yutani", Modifier.height(13.dp))
        Txt("OS", type.tag, Modifier.padding(start = 8.dp).border(1.dp, Yo.accent.copy(alpha = 0.6f), RoundedCornerShape(3.dp)).padding(horizontal = 4.dp, vertical = 1.dp), Yo.accent)
        Box(Modifier.weight(1f))
        Box {
            val initials = (me as? Res.Ready)?.data?.ownerInitials?.ifBlank { null } ?: "··"
            Box(
                Modifier.size(36.dp).clip(CircleShape).background(Yo.surfaceControl).border(1.dp, Yo.borderControl, CircleShape)
                    .clickable(role = Role.Button, onClickLabel = "Account") { menu = true },
                contentAlignment = Alignment.Center,
            ) { Txt(initials, type.tag, color = Yo.text) }
            DropdownMenu(menu, { menu = false }, containerColor = Yo.surface) {
                Column(Modifier.width(240.dp).padding(horizontal = 14.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    (me as? Res.Ready)?.data?.email?.ifBlank { null }?.let { Txt(it, type.meta, maxLines = 1) }
                    Btn("Sync now", { menu = false; app.refresh() }, Modifier.fillMaxWidth())
                    Btn("Sign out", { menu = false; app.signOut() }, Modifier.fillMaxWidth())
                }
            }
        }
    }
}

/** The 44dp second row: the six sections, scrolling sideways, the current one underlined in amber. */
@Composable
fun NavStrip(current: Section?, onSelect: (Section) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().height(44.dp).horizontalScroll(rememberScrollState()).padding(horizontal = 6.dp)) {
        Section.entries.forEach { section ->
            val on = section == current
            Box(
                Modifier.height(44.dp).clickable(role = Role.Tab) { onSelect(section) }.padding(horizontal = 10.dp)
                    .drawBehind { if (on) drawRect(Yo.accent, Offset(0f, size.height - 2.dp.toPx()), Size(size.width, 2.dp.toPx())) },
                contentAlignment = Alignment.Center,
            ) { Txt(section.title, type.nav, color = if (on) Yo.text else Yo.textMuted) }
        }
    }
}

/** The status strip: how old the copy on the phone is, and whether the last attempt reached the site. */
@Composable
fun SyncStrip(modifier: Modifier = Modifier) {
    val app = LocalApp.current
    val index by app.store.index.collectAsState()
    val progress by app.sync.progress.collectAsState()
    val now by rememberNow()
    val (dot, text) = when {
        progress.running && progress.total > 0 -> Yo.accent to "UPDATING ${progress.done}/${progress.total}"
        progress.running -> Yo.accent to "CHECKING FOR UPDATES"
        index.lastSuccessAt == null && index.lastAttemptFailed -> Yo.bad to "OFFLINE · NOTHING DOWNLOADED YET"
        index.lastSuccessAt == null -> Yo.textLabel to "NOT SYNCED YET"
        index.lastAttemptFailed -> Yo.bad to "OFFLINE · AS OF ${relativeTime(index.lastSuccessAt, now).uppercase()}"
        else -> Yo.good to "SYNCED ${relativeTime(index.lastSuccessAt, now).uppercase()}"
    }
    Row(
        modifier.fillMaxWidth().background(Yo.bg).drawBehind { drawRect(Yo.borderFaint, Offset(0f, 0f), Size(size.width, 1.dp.toPx())) }
            .padding(horizontal = 16.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(6.dp).background(dot, CircleShape))
        Txt(text, type.tag, Modifier.padding(start = 8.dp), maxLines = 1)
    }
}

/**
 * The dropdown under the page title on every per-character screen: monogram tile, name, chevron;
 * open, it lists each character with its MAIN/ALT tag and total SP.
 */
@Composable
fun CharacterSelect(modifier: Modifier = Modifier) {
    val characters = LocalCharacters.current
    val active = characters.active ?: return
    var open by remember { mutableStateOf(false) }
    Box(modifier) {
        val shape = RoundedCornerShape(6.dp)
        Row(
            Modifier.height(44.dp).clip(shape).background(Yo.surface).border(1.dp, Yo.borderControl, shape)
                .clickable(role = Role.DropdownList) { open = true }.padding(start = 6.dp, end = 12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Tile(EveImage.portrait(active.id, 64), 32.dp, description = null)
            Txt(active.name, type.bodyStrong, maxLines = 1)
            Chevron(open = true)
        }
        DropdownMenu(open, { open = false }, containerColor = Yo.surface) {
            characters.all.forEach { c ->
                Row(
                    Modifier.width(300.dp).background(if (c.id == active.id) Yo.surfaceControl else Yo.surface)
                        .clickable { open = false; characters.select(c.id) }.padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Tile(EveImage.portrait(c.id, 64), 32.dp)
                    Column(Modifier.weight(1f)) {
                        Txt(c.name, type.bodyStrong, maxLines = 1)
                        if (c.needsReauth) Txt("Needs re-authorising on the site", type.meta, color = Yo.bad, maxLines = 1)
                    }
                    c.tag?.let { Tag(it, if (it == "MAIN") TagTone.Main else TagTone.Outline) }
                    c.sp?.let { Txt(it, type.mono, color = Yo.textMuted) }
                }
            }
        }
    }
}

/**
 * The frame every screen sits in: page padding, the title, the character dropdown when the screen
 * is about one character, then the screen's own items. Pulling down starts a sync.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Screen(title: String, perCharacter: Boolean = true, back: (() -> Unit)? = null, content: LazyListScope.() -> Unit) {
    val app = LocalApp.current
    val progress by app.sync.progress.collectAsState()
    PullToRefreshBox(isRefreshing = progress.running, onRefresh = { app.refresh() }, modifier = Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 24.dp, bottom = 40.dp)) {
            item(key = "head") {
                Column(Modifier.padding(bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (back != null) Txt("‹ Back", type.nav, Modifier.clickable(role = Role.Button, onClick = back).padding(vertical = 6.dp), Yo.textMuted)
                    PageTitle(title)
                    if (perCharacter) CharacterSelect()
                }
            }
            content()
        }
    }
}

/** What a screen shows in place of its content while its resource is not on the phone. */
fun LazyListScope.whenMissing(state: Res<*>): Boolean {
    when (state) {
        is Res.Ready -> return false
        Res.Reading -> item(key = "reading") { Box(Modifier.height(1.dp)) }
        Res.Missing -> item(key = "missing") { Card { Empty("Not on this phone yet. It downloads the next time the site can be reached.") } }
    }
    return true
}
