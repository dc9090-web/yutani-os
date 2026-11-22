package com.yutanios.app

import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/**
 * Sign in with Google through Android's Credential Manager. The ID token is issued for the site's
 * *web* client, so the site verifies it exactly as it verifies a browser sign-in.
 */
class CredentialManagerSignIn(private val app: YutaniApp, private val webClientId: String) : GoogleSignIn {
    override suspend fun idToken(): String {
        if (webClientId.isBlank()) error("This build has no Google client ID. Set yutani.googleWebClientId in android/local.properties and rebuild.")
        val activity = app.activity.get() ?: error("Open the app to sign in.")
        val request = GetCredentialRequest.Builder().addCredentialOption(GetSignInWithGoogleOption.Builder(webClientId).build()).build()
        val credential = try {
            CredentialManager.create(activity).getCredential(activity, request).credential
        } catch (e: GetCredentialCancellationException) {
            error("Google sign-in was cancelled.")
        } catch (e: NoCredentialException) {
            error("No Google account is available on this phone. Add one in Android's settings, then try again.")
        } catch (e: GetCredentialException) {
            error("Google sign-in failed: ${e.message ?: e.type}")
        }
        if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            return GoogleIdTokenCredential.createFrom(credential.data).idToken
        }
        error("Google returned something other than an ID token.")
    }
}
