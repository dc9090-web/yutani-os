package com.yutanios.app

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.savedstate.read
import com.yutanios.app.model.Paths
import com.yutanios.app.resources.Res
import com.yutanios.app.resources.kana
import com.yutanios.app.resources.wordmark
import com.yutanios.app.screens.AssetsScreen
import com.yutanios.app.screens.ClonesScreen
import com.yutanios.app.screens.OverviewScreen
import com.yutanios.app.screens.ShipDetailScreen
import com.yutanios.app.screens.ShipsScreen
import com.yutanios.app.screens.SkillsScreen
import com.yutanios.app.screens.WalletScreen
import com.yutanios.app.ui.Btn
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.Header
import com.yutanios.app.ui.LocalApp
import com.yutanios.app.ui.LocalCharacters
import com.yutanios.app.ui.NavStrip
import com.yutanios.app.ui.Screen
import com.yutanios.app.ui.Section
import com.yutanios.app.ui.SyncStrip
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.YutaniTheme
import com.yutanios.app.ui.rememberCharacters
import com.yutanios.app.ui.type
import kotlinx.coroutines.launch

@Composable
fun App(app: AppContainer) {
    YutaniTheme {
        CompositionLocalProvider(LocalApp provides app) {
            Box(Modifier.fillMaxSize().background(Yo.bg).windowInsetsPadding(WindowInsets.safeDrawing)) {
                val signedIn by app.signedIn.collectAsState()
                if (signedIn) Shell() else SignIn()
            }
        }
    }
}

@Composable
private fun SignIn() {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Image(org.jetbrains.compose.resources.painterResource(Res.drawable.wordmark), "Yutani", Modifier.height(26.dp))
        Txt("OS", type.tag, Modifier.padding(top = 10.dp), Yo.accent)
        Image(org.jetbrains.compose.resources.painterResource(Res.drawable.kana), null, Modifier.padding(top = 10.dp).height(9.dp))
        Card(Modifier.padding(top = 28.dp).widthIn(max = 400.dp), padding = 24.dp) {
            Txt("Sign in", type.h2)
            Txt("Sign in with the Google account this site is set up for.", type.meta, Modifier.padding(top = 6.dp, bottom = 18.dp))
            if (!app.configured) Txt("This build has no site address. Set yutani.siteUrl in android/local.properties and rebuild.", type.meta, Modifier.padding(bottom = 12.dp), Yo.bad)
            Btn(if (busy) "Signing in…" else "Sign in with Google", primary = true, enabled = !busy && app.configured, onClick = {
                busy = true; error = null
                scope.launch { error = app.signIn(); busy = false }
            })
            error?.let { Txt(it, type.meta, Modifier.padding(top = 12.dp), Yo.bad) }
        }
        Txt("Private tool · only the owner's Google account can sign in.", type.meta, Modifier.padding(top = 18.dp), Yo.textDisabled)
    }
}

@Composable
private fun Shell() {
    val app = LocalApp.current
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val section = Section.entries.firstOrNull { it.route == route } ?: if (route?.startsWith("ship/") == true) Section.Ships else null
    // Opening the app is the moment to check for changes; the copy is on screen meanwhile.
    LaunchedEffect(Unit) { app.refresh() }
    CompositionLocalProvider(LocalCharacters provides rememberCharacters()) {
        val active = LocalCharacters.current.active
        Column(Modifier.fillMaxSize()) {
            Header()
            NavStrip(section, onSelect = { target ->
                nav.navigate(target.route) { popUpTo(Section.Overview.route) { saveState = true }; launchSingleTop = true; restoreState = true }
            })
            SyncStrip()
            NavHost(nav, startDestination = Section.Overview.route, modifier = Modifier.fillMaxWidth().weight(1f)) {
                composable(Section.Overview.route) { OverviewScreen() }
                composable(Section.Skills.route) { PerCharacter("Skills", active?.id) { SkillsScreen(it) } }
                composable(Section.Clones.route) { PerCharacter("Clones", active?.id) { ClonesScreen(it) } }
                composable(Section.Assets.route) { PerCharacter("Assets", active?.id) { AssetsScreen(it) } }
                composable(Section.Wallet.route) { PerCharacter("Wallet", active?.id) { WalletScreen(it) } }
                composable(Section.Ships.route) {
                    PerCharacter("Ships", active?.id) { id ->
                        ShipsScreen(
                            id,
                            onOpenAsset = { itemId -> nav.navigate("ship/asset/$id/$itemId") },
                            onOpenFit = { fittingId -> nav.navigate("ship/fit/$id/$fittingId") },
                        )
                    }
                }
                val ids = listOf(navArgument("character") { type = NavType.LongType }, navArgument("id") { type = NavType.LongType })
                composable("ship/asset/{character}/{id}", ids) { e ->
                    val (character, id) = e.arguments!!.read { getLong("character") to getLong("id") }
                    ShipDetailScreen(Paths.shipAsset(character, id), onBack = { nav.popBackStack() })
                }
                composable("ship/fit/{character}/{id}", ids) { e ->
                    val (character, id) = e.arguments!!.read { getLong("character") to getLong("id") }
                    ShipDetailScreen(Paths.shipFit(character, id), onBack = { nav.popBackStack() })
                }
            }
        }
    }
}

/** A per-character screen needs a character; before the first sync there is none to show. */
@Composable
private fun PerCharacter(title: String, characterId: Long?, content: @Composable (Long) -> Unit) {
    if (characterId != null) content(characterId)
    else Screen(title, perCharacter = false) { item { Card { Empty("No characters on this phone yet. They download the next time the site can be reached.") } } }
}
