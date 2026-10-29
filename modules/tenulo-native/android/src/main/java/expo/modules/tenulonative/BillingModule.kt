package expo.modules.tenulonative

import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Google Play Billing, used directly (no purchase backend). Handles one-time products only:
 * looking a product up, buying it, and listing what the user owns. Purchases are acknowledged
 * here, as Play requires, and confirmed by Play's own purchase state. Tenulo never sees who bought.
 *
 * All state lives on the main thread: every function runs on [Queues.MAIN] and every Play callback
 * is posted back to it, so no locking is needed.
 */
class BillingModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var client: BillingClient? = null
  private var connecting = false
  private val waiting = mutableListOf<(BillingResult) -> Unit>()
  private var purchasePromise: Promise? = null
  private var purchaseProductId: String? = null

  private val purchasesListener = PurchasesUpdatedListener { result, purchases ->
    main.post { onPurchasesUpdated(result, purchases.orEmpty()) }
  }

  override fun definition() = ModuleDefinition {
    Name("TenuloBilling")
    Events("onPurchasesUpdated")

    AsyncFunction("getProduct") { productId: String, promise: Promise ->
      withProduct(productId, promise) { details ->
        promise.resolve(
          details?.let {
            mapOf(
              "productId" to it.productId,
              "title" to it.name,
              "description" to it.description,
              "price" to price(it),
            )
          },
        )
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("purchase") { productId: String, promise: Promise ->
      if (purchasePromise != null) {
        promise.reject("E_IN_PROGRESS", "A purchase is already in progress", null)
        return@AsyncFunction
      }
      withProduct(productId, promise) { details ->
        val activity = appContext.currentActivity
        val c = client
        if (details == null || activity == null || c == null) {
          promise.reject("E_NO_PRODUCT", "This product is not available right now", null)
          return@withProduct
        }
        val params = BillingFlowParams.newBuilder()
          .setProductDetailsParamsList(
            listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build()),
          )
          .build()
        purchasePromise = promise
        purchaseProductId = productId
        val launched = c.launchBillingFlow(activity, params)
        if (launched.responseCode != BillingResponseCode.OK) {
          // The flow never opened, so no PurchasesUpdatedListener call will settle the promise.
          onPurchasesUpdated(launched, emptyList())
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("ownedProducts") { promise: Promise ->
      withClient(promise) { c ->
        val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
        c.queryPurchasesAsync(params) { result, purchases ->
          main.post {
            if (result.responseCode != BillingResponseCode.OK) {
              promise.reject("E_BILLING_${result.responseCode}", result.debugMessage, null)
              return@post
            }
            acknowledgeAll(purchases)
            promise.resolve(
              mapOf(
                "owned" to productsIn(purchases, Purchase.PurchaseState.PURCHASED),
                "pending" to productsIn(purchases, Purchase.PurchaseState.PENDING),
              ),
            )
          }
        }
      }
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      client?.endConnection()
      client = null
    }
  }

  private fun price(details: ProductDetails): String? {
    @Suppress("DEPRECATION")
    return details.oneTimePurchaseOfferDetails?.formattedPrice
  }

  private fun productsIn(purchases: List<Purchase>, state: Int): List<String> =
    purchases.filter { it.purchaseState == state }.flatMap { it.products }.distinct()

  private fun withProduct(productId: String, promise: Promise, block: (ProductDetails?) -> Unit) {
    withClient(promise) { c ->
      val params = QueryProductDetailsParams.newBuilder()
        .setProductList(
          listOf(
            QueryProductDetailsParams.Product.newBuilder()
              .setProductId(productId)
              .setProductType(BillingClient.ProductType.INAPP)
              .build(),
          ),
        )
        .build()
      c.queryProductDetailsAsync(params) { result, details ->
        main.post {
          if (result.responseCode != BillingResponseCode.OK) {
            promise.reject("E_BILLING_${result.responseCode}", result.debugMessage, null)
          } else {
            block(details.productDetailsList.firstOrNull { it.productId == productId })
          }
        }
      }
    }
  }

  private fun withClient(promise: Promise, block: (BillingClient) -> Unit) {
    val context = appContext.reactContext
    if (context == null) {
      promise.reject("E_NO_CONTEXT", "The app is not ready", null)
      return
    }
    val c = client ?: BillingClient.newBuilder(context)
      .setListener(purchasesListener)
      .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
      .enableAutoServiceReconnection()
      .build()
      .also { client = it }
    if (c.isReady) {
      block(c)
      return
    }
    waiting.add { result ->
      if (result.responseCode == BillingResponseCode.OK) {
        block(c)
      } else {
        promise.reject("E_BILLING_UNAVAILABLE", result.debugMessage.ifEmpty { "Google Play is not available" }, null)
      }
    }
    if (connecting) return
    connecting = true
    c.startConnection(object : BillingClientStateListener {
      override fun onBillingSetupFinished(result: BillingResult) {
        main.post { settleWaiting(result) }
      }

      override fun onBillingServiceDisconnected() {
        main.post {
          settleWaiting(
            BillingResult.newBuilder()
              .setResponseCode(BillingResponseCode.SERVICE_DISCONNECTED)
              .setDebugMessage("Google Play disconnected")
              .build(),
          )
        }
      }
    })
  }

  private fun settleWaiting(result: BillingResult) {
    connecting = false
    val pending = waiting.toList()
    waiting.clear()
    pending.forEach { it(result) }
  }

  private fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>) {
    val promise = purchasePromise
    val wanted = purchaseProductId
    purchasePromise = null
    purchaseProductId = null
    acknowledgeAll(purchases)
    when (result.responseCode) {
      BillingResponseCode.OK -> {
        val mine = purchases.firstOrNull { wanted == null || it.products.contains(wanted) }
        promise?.resolve(
          when (mine?.purchaseState) {
            Purchase.PurchaseState.PURCHASED -> "purchased"
            Purchase.PurchaseState.PENDING -> "pending"
            else -> "canceled"
          },
        )
      }
      BillingResponseCode.USER_CANCELED -> promise?.resolve("canceled")
      BillingResponseCode.ITEM_ALREADY_OWNED -> promise?.resolve("purchased")
      else -> promise?.reject("E_BILLING_${result.responseCode}", result.debugMessage, null)
    }
    sendEvent("onPurchasesUpdated", mapOf("responseCode" to result.responseCode))
  }

  /** Play refunds purchases that are not acknowledged within three days. */
  private fun acknowledgeAll(purchases: List<Purchase>) {
    val c = client ?: return
    for (p in purchases) {
      if (p.purchaseState != Purchase.PurchaseState.PURCHASED || p.isAcknowledged) continue
      val params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.purchaseToken).build()
      // A failed acknowledgement is retried on the next ownedProducts() call.
      c.acknowledgePurchase(params) { }
    }
  }
}
