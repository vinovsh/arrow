package com.arrowescape

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

/** One user-requested rewarded ad at a time. Rewards are settled after dismissal. */
class RewardedAdsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val handler = Handler(Looper.getMainLooper())
  private var pending: Promise? = null
  private var requestId = 0
  private var initialized = false
  private var showing = false
  private var earned = false
  private var timeout: Runnable? = null

  override fun getName() = "RewardedAds"

  @ReactMethod
  fun showRewarded(promise: Promise) {
    handler.post {
      if (pending != null) {
        promise.reject("AD_BUSY", "An ad is already loading or playing.")
        return@post
      }
      val activity = currentActivity
      if (activity == null || activity.isFinishing || activity.isDestroyed) {
        promise.reject("NO_ACTIVITY", "The game must be open to play an ad.")
        return@post
      }
      if (BuildConfig.REWARDED_AD_UNIT_ID.isBlank()) {
        promise.reject("AD_NOT_CONFIGURED", "Rewarded ads are not configured for this build.")
        return@post
      }
      pending = promise
      val id = ++requestId
      earned = false
      timeout = Runnable {
        if (isCurrent(id) && !showing) fail("AD_TIMEOUT", "The ad could not load. Please try again.")
      }.also { handler.postDelayed(it, 60000) }
      // Google's sample app IDs have no publisher consent message configured.
      if (BuildConfig.DEBUG) {
        initializeAndLoad(id)
      } else {
        val consent = UserMessagingPlatform.getConsentInformation(activity)
        consent.requestConsentInfoUpdate(activity, ConsentRequestParameters.Builder().build(), {
          if (!isCurrent(id)) return@requestConsentInfoUpdate
          UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { error ->
            if (isCurrent(id)) {
              if (consent.canRequestAds()) initializeAndLoad(id)
              else fail("AD_CONSENT", error?.message ?: "Ads are unavailable with your current privacy choices.")
            }
          }
        }, { error ->
          if (isCurrent(id)) {
            if (consent.canRequestAds()) initializeAndLoad(id)
            else fail("AD_CONSENT", error.message)
          }
        })
      }
    }
  }

  private fun isCurrent(id: Int) = pending != null && requestId == id

  private fun initializeAndLoad(id: Int) {
    if (!isCurrent(id)) return
    if (initialized) {
      load(id)
    } else {
      Thread {
        try {
          MobileAds.initialize(reactApplicationContext) {
            handler.post {
              initialized = true
              if (isCurrent(id)) load(id)
            }
          }
        } catch (error: Exception) {
          handler.post { if (isCurrent(id)) fail("AD_INITIALIZATION", error.message ?: "Ads are unavailable.") }
        }
      }.start()
    }
  }

  private fun load(id: Int) {
    RewardedAd.load(reactApplicationContext, BuildConfig.REWARDED_AD_UNIT_ID,
      AdRequest.Builder().build(), object : RewardedAdLoadCallback() {
        override fun onAdFailedToLoad(error: LoadAdError) {
          if (isCurrent(id)) fail("AD_LOAD_FAILED", "No ad is available right now. Please try again.")
        }
        override fun onAdLoaded(ad: RewardedAd) {
          if (!isCurrent(id)) return
          val activity = currentActivity
          if (activity == null || activity.isFinishing || activity.isDestroyed) {
            fail("NO_ACTIVITY", "Return to the game to play an ad.")
            return
          }
          ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() {
              if (isCurrent(id)) finish(earned)
            }
            override fun onAdFailedToShowFullScreenContent(error: AdError) {
              if (isCurrent(id)) fail("AD_SHOW_FAILED", "The ad could not play. Please try again.")
            }
          }
          // Stop the loading timeout before showing a potentially long video.
          timeout?.let { handler.removeCallbacks(it) }
          timeout = null
          showing = true
          try {
            ad.show(activity) { if (isCurrent(id)) earned = true }
          } catch (error: Exception) {
            fail("AD_SHOW_FAILED", "The ad could not play. Please try again.")
          }
        }
      })
  }

  private fun finish(reward: Boolean) {
    val promise = pending
    clearPending()
    promise?.resolve(reward)
  }
  private fun fail(code: String, message: String) {
    val promise = pending
    clearPending()
    promise?.reject(code, message)
  }
  private fun clearPending() {
    timeout?.let { handler.removeCallbacks(it) }
    timeout = null
    pending = null
    showing = false
    earned = false
  }

  @ReactMethod
  fun showPrivacyOptions(promise: Promise) {
    handler.post {
      val activity = currentActivity
      if (activity == null || pending != null) {
        promise.reject("AD_BUSY", "Please try again when no ad is playing.")
        return@post
      }
      UserMessagingPlatform.showPrivacyOptionsForm(activity) { error ->
        if (error == null) promise.resolve(null)
        else promise.reject("PRIVACY_OPTIONS", error.message)
      }
    }
  }

  override fun invalidate() {
    handler.post {
      requestId++
      clearPending()
    }
    super.invalidate()
  }
}
