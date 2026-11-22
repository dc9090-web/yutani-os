package com.yutanios.app

import com.yutanios.app.data.ApiClient
import com.yutanios.app.data.ApiException
import com.yutanios.app.data.Repository
import com.yutanios.app.data.Store
import com.yutanios.app.data.SyncEngine
import com.yutanios.app.data.SyncOutcome
import com.yutanios.app.data.apiHttpClient
import io.ktor.client.engine.HttpClientEngine
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import okio.FileSystem
import okio.Path
import okio.Path.Companion.toPath
import kotlin.time.Clock

/** Where this phone's token lives. On Android it is encrypted with a key held by the system. */
interface TokenStore {
    fun get(): String?
    fun set(token: String?)
}

/** Asks the platform for a Google ID token for the owner's account. Throws when cancelled or refused. */
fun interface GoogleSignIn { suspend fun idToken(): String }

/** Everything the screens share: the copy on the phone, the sync, and whether anyone is signed in. */
class AppContainer(
    siteUrl: String,
    private val tokens: TokenStore,
    fs: FileSystem,
    dataDir: Path,
    httpEngine: HttpClientEngine,
    private val google: GoogleSignIn?,
    private val deviceName: String,
    val scope: CoroutineScope,
    val now: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) {
    val configured = siteUrl.isNotBlank()
    val store = Store(fs, dataDir)
    private val api = ApiClient(siteUrl, apiHttpClient(httpEngine)) { tokens.get() }
    val sync = SyncEngine(api, store, now)
    val repo = Repository(store, sync, api)

    private val _signedIn = MutableStateFlow(tokens.get() != null)
    val signedIn: StateFlow<Boolean> = _signedIn

    init { scope.launch { store.open() } }

    /** Starts a sync unless one is already running. Safe to call from anywhere, any number of times. */
    fun refresh(): Job = scope.launch { syncNow() }

    suspend fun syncNow(): SyncOutcome {
        if (tokens.get() == null) return SyncOutcome.SignedOut
        val outcome = sync.sync()
        if (outcome == SyncOutcome.SignedOut) forget()
        return outcome
    }

    /** Returns null on success, or one plain sentence saying what went wrong. */
    suspend fun signIn(): String? {
        val picker = google ?: return "Google sign-in is not available on this device."
        val idToken = try { picker.idToken() } catch (e: CancellationException) { throw e } catch (e: Exception) {
            return e.message ?: "Google sign-in was cancelled."
        }
        return try {
            tokens.set(api.signIn(idToken, deviceName).token)
            _signedIn.value = true
            refresh()
            null
        } catch (e: CancellationException) { throw e } catch (e: ApiException) {
            if (e.code == "not-allowed") "That Google account is not allowed on this site." else "The site refused the sign-in (${e.status})."
        } catch (e: Exception) {
            "The site could not be reached. Check that Tailscale is on, then try again."
        }
    }

    fun signOut() = scope.launch {
        runCatching { api.signOut() } // best effort: with no connection the token is revoked from Settings on the site
        forget()
    }

    private suspend fun forget() {
        tokens.set(null)
        store.clear()
        _signedIn.value = false
    }
}

/** Builds the container on the platform's own network stack and file system. `dataDir` is a private folder. */
fun createAppContainer(
    siteUrl: String, tokens: TokenStore, dataDir: String, google: GoogleSignIn?, deviceName: String, scope: CoroutineScope,
): AppContainer = AppContainer(siteUrl, tokens, platformFileSystem, dataDir.toPath(), platformHttpEngine(), google, deviceName, scope)
