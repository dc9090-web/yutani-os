package com.yutanios.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.yutanios.app.resources.Res
import com.yutanios.app.resources.inter_medium
import com.yutanios.app.resources.inter_regular
import com.yutanios.app.resources.inter_semibold
import com.yutanios.app.resources.jetbrains_mono_medium
import com.yutanios.app.resources.jetbrains_mono_regular
import com.yutanios.app.resources.space_grotesk_bold
import com.yutanios.app.resources.space_grotesk_medium
import org.jetbrains.compose.resources.Font

/** The `--yo-` tokens from docs/design-handoff/tokens.css, name for name. Dark only, as the site is. */
object Yo {
    val bg = Color(0xFF0A0C0F)
    val surface = Color(0xFF111418)
    val surfaceSunken = Color(0xFF0E1114)
    val surfaceOpen = Color(0xFF141920)
    val surfaceControl = Color(0xFF1A1F26)

    val border = Color(0xFF1C2128)
    val borderRow = Color(0xFF171B21)
    val borderFaint = Color(0xFF14181D)
    val borderControl = Color(0xFF2A313B)
    val borderTile = Color(0xFF262C35)

    val text = Color(0xFFE6E9ED)
    val text2 = Color(0xFFC9CED6)
    val textMuted = Color(0xFF9AA3AE)
    val textLabel = Color(0xFF7C8794)
    val textDisabled = Color(0xFF4A5360)

    val accent = Color(0xFFF5A524)
    val good = Color(0xFF4FD1C5)
    val bad = Color(0xFFFF8A7A)

    val blockFilled = Color(0xFFC9CED6)
    val blockEmpty = Color(0xFF333B46)
    val track = Color(0xFF232932)

    val dmgEm = Color(0xFF5CC8FF)
    val dmgThermal = Color(0xFFFF8A7A)
    val dmgKinetic = Color(0xFF9AA3AE)
    val dmgExplosive = Color(0xFFF5A524)
}

/** The type scale from DESIGN_SYSTEM.md, at its mobile sizes. */
class YoType(ui: FontFamily, display: FontFamily, mono: FontFamily) {
    val h1 = TextStyle(fontFamily = display, fontWeight = FontWeight.SemiBold, fontSize = 26.sp, letterSpacing = (-0.01).em, color = Yo.text)
    val h2 = TextStyle(fontFamily = display, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, color = Yo.text)
    val h3 = TextStyle(fontFamily = ui, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, letterSpacing = 0.04.em, color = Yo.text2)
    val body = TextStyle(fontFamily = ui, fontWeight = FontWeight.Normal, fontSize = 13.5.sp, lineHeight = 19.sp, color = Yo.text)
    val bodyStrong = body.copy(fontWeight = FontWeight.Medium)
    val meta = TextStyle(fontFamily = ui, fontWeight = FontWeight.Normal, fontSize = 12.5.sp, lineHeight = 17.sp, color = Yo.textMuted)
    val label = TextStyle(fontFamily = ui, fontWeight = FontWeight.Medium, fontSize = 11.sp, letterSpacing = 0.1.em, color = Yo.textLabel)
    val figure = TextStyle(fontFamily = mono, fontWeight = FontWeight.Medium, fontSize = 20.sp, color = Yo.text)
    val mono = TextStyle(fontFamily = mono, fontWeight = FontWeight.Normal, fontSize = 12.5.sp, color = Yo.text)
    val tag = TextStyle(fontFamily = mono, fontWeight = FontWeight.Medium, fontSize = 10.sp, letterSpacing = 0.1.em, color = Yo.textMuted)
    val nav = TextStyle(fontFamily = ui, fontWeight = FontWeight.Medium, fontSize = 13.sp, color = Yo.textMuted)
}

val LocalYoType = staticCompositionLocalOf<YoType> { error("YutaniTheme is missing") }

@Composable
fun YutaniTheme(content: @Composable () -> Unit) {
    val ui = FontFamily(
        Font(Res.font.inter_regular, FontWeight.Normal),
        Font(Res.font.inter_medium, FontWeight.Medium),
        Font(Res.font.inter_semibold, FontWeight.SemiBold),
    )
    // Space Grotesk ships no static 600; its Bold stands in for the headings' weight.
    val display = FontFamily(Font(Res.font.space_grotesk_medium, FontWeight.Medium), Font(Res.font.space_grotesk_bold, FontWeight.SemiBold))
    val mono = FontFamily(Font(Res.font.jetbrains_mono_regular, FontWeight.Normal), Font(Res.font.jetbrains_mono_medium, FontWeight.Medium))
    val type = YoType(ui, display, mono)
    // Material is only here for the sheet, the menu and pull-to-refresh; its colours are pointed at the tokens.
    val scheme = darkColorScheme(
        primary = Yo.accent, onPrimary = Yo.bg, background = Yo.bg, onBackground = Yo.text,
        surface = Yo.surface, onSurface = Yo.text, surfaceVariant = Yo.surfaceControl, onSurfaceVariant = Yo.textMuted,
        surfaceContainer = Yo.surface, surfaceContainerHigh = Yo.surfaceControl, surfaceContainerLow = Yo.surface,
        outline = Yo.borderControl, outlineVariant = Yo.border,
    )
    MaterialTheme(colorScheme = scheme) { CompositionLocalProvider(LocalYoType provides type, content = content) }
}

val type: YoType @Composable get() = LocalYoType.current
