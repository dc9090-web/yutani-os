package com.yutanios.app.data

import io.ktor.client.HttpClient
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.compression.ContentEncoding
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** What a GET came back with: a new body, or "you already have it". */
sealed interface Fetched {
    data class Body(val text: String, val etag: String?) : Fetched
    data object NotModified : Fetched
}

/** The site no longer accepts this phone's token (revoked, or the account left the allow-list). */
class SignedOutException : Exception("signed out")

/** The site answered, but not with what was asked for. `code` is the `{ error }` field when there is one. */
class ApiException(val status: Int, val code: String?) : Exception("HTTP $status${code?.let { " ($it)" } ?: ""}")

@Serializable private data class SignInBody(val idToken: String, val deviceName: String)
@Serializable data class SignInResult(val token: String, val email: String)
@Serializable private data class ErrorBody(val error: String? = null)

val AppJson = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true }

fun apiHttpClient(engine: HttpClientEngine): HttpClient = HttpClient(engine) {
    expectSuccess = false
    install(ContentEncoding) { gzip() }
    // Short connect, so "no reception" is noticed quickly and the copy on the phone is shown.
    install(HttpTimeout) { connectTimeoutMillis = 6_000; requestTimeoutMillis = 40_000; socketTimeoutMillis = 20_000 }
}

class ApiClient(baseUrl: String, private val http: HttpClient, private val token: () -> String?) {
    private val base = baseUrl.trimEnd('/')

    suspend fun get(path: String, etag: String? = null): Fetched {
        val res = http.get(base + path) {
            token()?.let { header("Authorization", "Bearer $it") }
            etag?.let { header("If-None-Match", it) }
        }
        return when (res.status.value) {
            200 -> Fetched.Body(res.bodyAsText(), res.headers["ETag"])
            304 -> Fetched.NotModified
            else -> throw failure(res)
        }
    }

    suspend fun signIn(idToken: String, deviceName: String): SignInResult {
        val res = http.post("$base/api/v1/auth/google") {
            contentType(ContentType.Application.Json)
            setBody(AppJson.encodeToString(SignInBody.serializer(), SignInBody(idToken, deviceName)))
        }
        if (res.status.value != 200) throw ApiException(res.status.value, errorCode(res))
        return AppJson.decodeFromString(SignInResult.serializer(), res.bodyAsText())
    }

    suspend fun signOut() {
        http.delete("$base/api/v1/auth/session") { token()?.let { header("Authorization", "Bearer $it") } }
    }

    private suspend fun failure(res: HttpResponse): Exception =
        if (res.status.value == 401) SignedOutException() else ApiException(res.status.value, errorCode(res))

    private suspend fun errorCode(res: HttpResponse): String? =
        runCatching { AppJson.decodeFromString(ErrorBody.serializer(), res.bodyAsText()).error }.getOrNull()
}
